from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import case, func, select
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
    event_count, total_budget, upcoming_count = db.execute(
        select(
            func.count(Event.id),
            func.coalesce(func.sum(Event.budget_cents), 0),
            func.coalesce(func.sum(case((Event.event_date >= now, 1), else_=0)), 0),
        ).where(Event.user_id == user.id)
    ).one()
    upcoming = db.execute(
        select(Event)
        .where(Event.user_id == user.id, Event.event_date >= now)
        .order_by(Event.event_date.asc())
        .limit(4)
    ).scalars().all()
    recent = db.execute(
        select(Event).where(Event.user_id == user.id).order_by(Event.created_at.desc()).limit(4)
    ).scalars().all()
    chart_events = db.execute(
        select(Event).where(Event.user_id == user.id).order_by(Event.event_date.asc()).limit(6)
    ).scalars().all()

    total_expenses = db.execute(
        select(func.coalesce(func.sum(Expense.amount_cents), 0))
        .join(Event, Expense.event_id == Event.id)
        .where(Event.user_id == user.id)
    ).scalar_one()
    open_task_count, done_task_count = db.execute(
        select(
            func.coalesce(func.sum(case((Task.done.is_(False), 1), else_=0)), 0),
            func.coalesce(func.sum(case((Task.done.is_(True), 1), else_=0)), 0),
        )
        .join(Event, Task.event_id == Event.id)
        .where(Event.user_id == user.id)
    ).one()

    risk_distribution = {"low": 0, "medium": 0, "high": 0, "unassessed": 0}
    for risk_level, count in db.execute(
        select(Event.risk_level, func.count(Event.id))
        .where(Event.user_id == user.id)
        .group_by(Event.risk_level)
    ):
        key = risk_level if risk_level in risk_distribution else "unassessed"
        risk_distribution[key] += count
    occasion_distribution = dict(
        db.execute(
            select(Event.event_type, func.count(Event.id))
            .where(Event.user_id == user.id)
            .group_by(Event.event_type)
        ).all()
    )

    plans_generated = db.execute(
        select(func.count(Plan.id))
        .join(Event, Plan.event_id == Event.id)
        .where(Event.user_id == user.id)
    ).scalar_one()
    ranked_plans = (
        select(
            Plan.id.label("plan_id"),
            func.row_number()
            .over(partition_by=Plan.event_id, order_by=(Plan.created_at.desc(), Plan.id.desc()))
            .label("plan_rank"),
        )
        .subquery()
    )
    plans = db.execute(
        select(Plan, Event)
        .join(ranked_plans, Plan.id == ranked_plans.c.plan_id)
        .join(Event, Plan.event_id == Event.id)
        .where(Event.user_id == user.id, ranked_plans.c.plan_rank == 1)
        .order_by(Plan.created_at.desc(), Plan.id.desc())
        .limit(4)
    ).all()

    upcoming_tasks = db.execute(
        select(Task, Event.name)
        .join(Event, Task.event_id == Event.id)
        .where(Event.user_id == user.id, Task.done.is_(False))
        .order_by(
            case((Task.due_date.is_(None), 1), else_=0),
            Task.due_date.asc(),
            Task.created_at.asc(),
        )
        .limit(6)
    ).all()

    return {
        "stats": {
            "event_count": event_count,
            "upcoming_count": upcoming_count,
            "total_budget_cents": total_budget,
            "total_expenses_cents": total_expenses,
            "tasks_open": open_task_count,
            "tasks_done": done_task_count,
            "plans_generated": plans_generated,
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
                "event_name": event_name,
                "title": t.title,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "category": t.category,
            }
            for t, event_name in upcoming_tasks
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
            for e in chart_events
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
