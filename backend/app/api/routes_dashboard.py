from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session as OrmSession

from app.api.common import serialize_event
from app.auth.deps import get_current_user, require_csrf
from app.database.db import get_db
from app.database.models import Event, Expense, Note, Plan, Task, User
from app.schemas import EventOut

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
def dashboard(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    now = datetime.now(UTC)
    events = db.execute(select(Event).where(Event.user_id == user.id).order_by(Event.event_date.asc())).scalars().all()

    def as_aware(value: datetime) -> datetime:
        return value if value.tzinfo else value.replace(tzinfo=UTC)

    upcoming = [e for e in events if as_aware(e.event_date) >= now][:4]
    recent = sorted(events, key=lambda e: as_aware(e.created_at), reverse=True)[:4]
    total_budget = sum(e.budget_cents for e in events)

    expenses = db.execute(
        select(Expense).join(Event, Expense.event_id == Event.id).where(Event.user_id == user.id)
    ).scalars().all()
    total_expenses = sum(e.amount_cents for e in expenses)

    tasks = db.execute(
        select(Task).join(Event, Task.event_id == Event.id).where(Event.user_id == user.id)
    ).scalars().all()
    open_tasks = [t for t in tasks if not t.done]

    risk_distribution = {"low": 0, "medium": 0, "high": 0, "unassessed": 0}
    occasion_distribution: dict[str, int] = {}
    for event in events:
        key = event.risk_level if event.risk_level in risk_distribution else "unassessed"
        risk_distribution[key] += 1
        occasion_distribution[event.event_type] = occasion_distribution.get(event.event_type, 0) + 1

    plan_rows = db.execute(
        select(Plan, Event)
        .join(Event, Plan.event_id == Event.id)
        .where(Event.user_id == user.id)
        .order_by(Plan.created_at.desc())
        .limit(24)
    ).all()
    plans = []
    seen_events: set[str] = set()
    for plan, event in plan_rows:
        if plan.event_id in seen_events:
            continue
        seen_events.add(plan.event_id)
        plans.append((plan, event))
        if len(plans) == 4:
            break

    event_names = {e.id: e.name for e in events}
    upcoming_tasks = sorted(
        open_tasks,
        key=lambda t: (t.due_date is None, t.due_date or now.date(), t.created_at),
    )[:6]

    return {
        "stats": {
            "event_count": len(events),
            "upcoming_count": len([e for e in events if as_aware(e.event_date) >= now]),
            "total_budget_cents": total_budget,
            "total_expenses_cents": total_expenses,
            "tasks_open": len(open_tasks),
            "tasks_done": len(tasks) - len(open_tasks),
            "plans_generated": len(plans),
        },
        "upcoming": [EventOut(**serialize_event(e)).model_dump(mode="json") for e in upcoming],
        "recent": [EventOut(**serialize_event(e)).model_dump(mode="json") for e in recent],
        "risk_distribution": risk_distribution,
        "occasion_distribution": [
            {"event_type": event_type, "count": count}
            for event_type, count in sorted(occasion_distribution.items(), key=lambda item: (-item[1], item[0]))
        ],
        "tasks": [
            {
                "id": t.id,
                "event_id": t.event_id,
                "event_name": event_names.get(t.event_id, "Event"),
                "title": t.title,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "category": t.category,
            }
            for t in upcoming_tasks
        ],
        "recent_plans": [
            {
                "id": plan.id,
                "event_id": plan.event_id,
                "event_name": event.name,
                "engine": plan.engine,
                "created_at": plan.created_at.isoformat(),
            }
            for plan, event in plans
        ],
        "budget_chart": [
            {
                "name": e.name[:18],
                "budget": round(e.budget_cents / 100, 2),
                "estimated": round((e.predicted_cost_cents or 0) / 100, 2),
            }
            for e in events[:6]
        ],
    }


@router.get("/account/export")
def export_account(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    events = db.execute(select(Event).where(Event.user_id == user.id)).scalars().all()
    return {
        "account": {"id": user.id, "email": user.email, "display_name": user.display_name, "created_at": user.created_at.isoformat()},
        "events": [EventOut(**serialize_event(e)).model_dump(mode="json") for e in events],
    }


@router.delete("/account/data", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_event_data(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> Response:
    """Delete every event and its plan/tasks/expenses/notes, keeping the account."""
    event_ids = [row[0] for row in db.execute(select(Event.id).where(Event.user_id == user.id)).all()]
    if event_ids:
        for model in (Note, Expense, Task, Plan):
            db.execute(model.__table__.delete().where(model.event_id.in_(event_ids)))
        db.execute(Event.__table__.delete().where(Event.id.in_(event_ids)))
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
