from __future__ import annotations

import math
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session as OrmSession

from app.api.common import get_owned_event, refresh_event_estimate, serialize_event
from app.auth.deps import get_current_user, require_csrf
from app.core.config import get_settings
from app.core.rate_limit import check_rate_limit, user_key
from app.database.db import get_db
from app.database.models import Event, Expense, Note, Plan, Task, User
from app.schemas import (
    EventCreate,
    EventListOut,
    EventOut,
    EventUpdate,
    ExpenseCreate,
    ExpenseOut,
    ExpenseUpdate,
    NoteCreate,
    NoteOut,
    PlanOut,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)

router = APIRouter(prefix="/api/events", tags=["events"])


def _limit_crud(db: OrmSession, user: User) -> None:
    check_rate_limit(db, user_key(user.id, "crud"), 240)


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> EventOut:
    _limit_crud(db, user)
    event = Event(user_id=user.id, **payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    refresh_event_estimate(db, event)
    db.refresh(event)
    return EventOut(**serialize_event(event))


@router.get("", response_model=EventListOut)
def list_events(
    page: int = Query(default=1, ge=1, le=10_000),
    page_size: int = Query(default=12, ge=1, le=500),
    q: str | None = Query(default=None, max_length=100),
    event_type: str | None = Query(default=None, max_length=40),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EventListOut:
    page_size = min(page_size, get_settings().max_page_size)
    stmt = select(Event).where(Event.user_id == user.id)
    count_stmt = select(func.count(Event.id)).where(Event.user_id == user.id)
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(Event.name.ilike(pattern) | Event.city.ilike(pattern))
        count_stmt = count_stmt.where(Event.name.ilike(pattern) | Event.city.ilike(pattern))
    if event_type:
        stmt = stmt.where(Event.event_type == event_type)
        count_stmt = count_stmt.where(Event.event_type == event_type)

    total = int(db.execute(count_stmt).scalar() or 0)
    events = (
        db.execute(stmt.order_by(Event.event_date.asc()).offset((page - 1) * page_size).limit(page_size))
        .scalars()
        .all()
    )
    return EventListOut(
        items=[EventOut(**serialize_event(e)) for e in events],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/{event_id}", response_model=EventOut)
def get_event(
    event_id: str,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EventOut:
    event = get_owned_event(db, user, event_id)
    return EventOut(**serialize_event(event))


@router.put("/{event_id}", response_model=EventOut)
def update_event(
    event_id: str,
    payload: EventUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> EventOut:
    _limit_crud(db, user)
    event = get_owned_event(db, user, event_id)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No supported fields were provided.")
    for field, value in updates.items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    estimate_fields = {"guest_count", "budget_cents", "venue_type", "catering_level", "decor_level", "photography", "location_tier", "event_type"}
    if estimate_fields & set(updates):
        refresh_event_estimate(db, event)
        db.refresh(event)
    return EventOut(**serialize_event(event))


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> Response:
    _limit_crud(db, user)
    event = get_owned_event(db, user, event_id)
    db.delete(event)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


@router.post("/{event_id}/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    event_id: str,
    payload: TaskCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> TaskOut:
    _limit_crud(db, user)
    event = get_owned_event(db, user, event_id)
    task = Task(event_id=event.id, **payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task, from_attributes=True)


@router.get("/{event_id}/tasks", response_model=list[TaskOut])
def list_tasks(
    event_id: str,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TaskOut]:
    event = get_owned_event(db, user, event_id)
    tasks = db.execute(select(Task).where(Task.event_id == event.id).order_by(Task.done.asc(), Task.created_at.asc())).scalars().all()
    return [TaskOut.model_validate(t, from_attributes=True) for t in tasks]


@router.patch("/{event_id}/tasks/{task_id}", response_model=TaskOut)
def update_task(
    event_id: str,
    task_id: str,
    payload: TaskUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> TaskOut:
    _limit_crud(db, user)
    event = get_owned_event(db, user, event_id)
    task = db.execute(select(Task).where(Task.id == task_id, Task.event_id == event.id)).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task, from_attributes=True)


@router.delete("/{event_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    event_id: str,
    task_id: str,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> Response:
    event = get_owned_event(db, user, event_id)
    task = db.execute(select(Task).where(Task.id == task_id, Task.event_id == event.id)).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    db.delete(task)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------


@router.post("/{event_id}/expenses", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    event_id: str,
    payload: ExpenseCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> ExpenseOut:
    _limit_crud(db, user)
    event = get_owned_event(db, user, event_id)
    expense = Expense(event_id=event.id, **payload.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return ExpenseOut.model_validate(expense, from_attributes=True)


@router.get("/{event_id}/expenses", response_model=list[ExpenseOut])
def list_expenses(
    event_id: str,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ExpenseOut]:
    event = get_owned_event(db, user, event_id)
    expenses = db.execute(select(Expense).where(Expense.event_id == event.id).order_by(Expense.created_at.desc())).scalars().all()
    return [ExpenseOut.model_validate(e, from_attributes=True) for e in expenses]


@router.patch("/{event_id}/expenses/{expense_id}", response_model=ExpenseOut)
def update_expense(
    event_id: str,
    expense_id: str,
    payload: ExpenseUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> ExpenseOut:
    _limit_crud(db, user)
    event = get_owned_event(db, user, event_id)
    expense = db.execute(
        select(Expense).where(Expense.id == expense_id, Expense.event_id == event.id)
    ).scalar_one_or_none()
    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)
    db.commit()
    db.refresh(expense)
    return ExpenseOut.model_validate(expense, from_attributes=True)


@router.delete("/{event_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    event_id: str,
    expense_id: str,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> Response:
    event = get_owned_event(db, user, event_id)
    expense = db.execute(
        select(Expense).where(Expense.id == expense_id, Expense.event_id == event.id)
    ).scalar_one_or_none()
    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found.")
    db.delete(expense)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------


@router.post("/{event_id}/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(
    event_id: str,
    payload: NoteCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> NoteOut:
    _limit_crud(db, user)
    event = get_owned_event(db, user, event_id)
    note = Note(event_id=event.id, body=payload.body)
    db.add(note)
    db.commit()
    db.refresh(note)
    return NoteOut.model_validate(note, from_attributes=True)


@router.get("/{event_id}/notes", response_model=list[NoteOut])
def list_notes(
    event_id: str,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[NoteOut]:
    event = get_owned_event(db, user, event_id)
    notes = db.execute(select(Note).where(Note.event_id == event.id).order_by(Note.created_at.desc())).scalars().all()
    return [NoteOut.model_validate(n, from_attributes=True) for n in notes]


@router.delete("/{event_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    event_id: str,
    note_id: str,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> Response:
    event = get_owned_event(db, user, event_id)
    note = db.execute(select(Note).where(Note.id == note_id, Note.event_id == event.id)).scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found.")
    db.delete(note)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Plan + export
# ---------------------------------------------------------------------------


@router.get("/{event_id}/plan")
def get_latest_plan(
    event_id: str,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    event = get_owned_event(db, user, event_id)
    plan = db.execute(
        select(Plan).where(Plan.event_id == event.id).order_by(Plan.created_at.desc()).limit(1)
    ).scalar_one_or_none()
    if plan is None:
        return {"plan": None}
    try:
        payload = PlanOut(
            id=plan.id,
            event_id=plan.event_id,
            engine=plan.engine,
            model=plan.model,
            schema_version=plan.schema_version,
            created_at=plan.created_at,
            plan=plan.payload,
            ai_configured=False,
        )
    except Exception:  # noqa: BLE001 - stored payload may predate the schema
        return {"plan": None}
    from app.core.config import get_settings as _get_settings

    payload.ai_configured = _get_settings().ai_configured
    return {"plan": payload.model_dump()}


@router.get("/{event_id}/export")
def export_event(
    event_id: str,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JSONResponse:
    event = get_owned_event(db, user, event_id)
    tasks = db.execute(select(Task).where(Task.event_id == event.id)).scalars().all()
    expenses = db.execute(select(Expense).where(Expense.event_id == event.id)).scalars().all()
    notes = db.execute(select(Note).where(Note.event_id == event.id)).scalars().all()
    plans = db.execute(select(Plan).where(Plan.event_id == event.id).order_by(Plan.created_at.desc())).scalars().all()
    data = {
        "exported_at": datetime.now(UTC).isoformat(),
        "event": serialize_event(event),
        "tasks": [TaskOut.model_validate(t, from_attributes=True).model_dump(mode="json") for t in tasks],
        "expenses": [ExpenseOut.model_validate(e, from_attributes=True).model_dump(mode="json") for e in expenses],
        "notes": [NoteOut.model_validate(n, from_attributes=True).model_dump(mode="json") for n in notes],
        "plans": [
            {
                "id": p.id,
                "engine": p.engine,
                "model": p.model,
                "created_at": p.created_at.isoformat(),
                "plan": p.payload,
            }
            for p in plans
        ],
    }
    return JSONResponse(
        content=_jsonable(data),
        headers={"Content-Disposition": f'attachment; filename="eventora-{event.id}.json"'},
    )


def _jsonable(value):
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    if isinstance(value, datetime):
        return value.isoformat()
    return value
