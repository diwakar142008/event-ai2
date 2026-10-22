from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session as OrmSession

from app.ai.service import chat as ai_chat
from app.ai.service import generate_plan as ai_generate_plan
from app.ai.service import status as ai_status
from app.api.common import get_owned_event, refresh_event_estimate
from app.auth.deps import get_current_user, require_csrf
from app.core.config import get_settings
from app.core.rate_limit import check_rate_limit, client_key, user_key
from app.database.db import get_db
from app.database.models import Event, Plan, Task, User
from app.ml.service import ModelNotTrained
from app.ml.service import engine as ml_engine
from app.schemas import (
    ChatRequest,
    ChatResponse,
    EventPlanPayload,
    GeneratePlanRequest,
    PlanOut,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])
logger = logging.getLogger("eventora.ai")


def _ai_guard(request: Request, db: OrmSession, user: User) -> None:
    settings = get_settings()
    check_rate_limit(db, user_key(user.id, "ai"), settings.rate_limit_ai)
    check_rate_limit(db, client_key(request, "ai-ip"), settings.rate_limit_ai * 3)


def _recommendations(event: Event) -> list[dict]:
    try:
        result = ml_engine.recommend(
            style=event.theme,
            event_type=event.event_type,
            venue_type=event.venue_type,
            guest_count=event.guest_count,
            budget_cents=event.budget_cents,
            limit=5,
        )
        return result["items"]
    except ModelNotTrained:
        return []
    except Exception:  # noqa: BLE001 - recommendations are optional context
        logger.exception("recommendation lookup failed")
        return []


@router.get("/status")
def ai_config_status(user: User = Depends(get_current_user)) -> dict:
    return ai_status()


@router.post("/generate-plan", response_model=PlanOut)
def generate_plan(
    payload: GeneratePlanRequest,
    request: Request,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> PlanOut:
    _ai_guard(request, db, user)
    # The event is addressed explicitly: a client-supplied ID is accepted only
    # after ownership verification.
    event = get_owned_event(db, user, payload.event_id)

    recommendations = _recommendations(event)
    if event.predicted_cost_cents is None:
        refresh_event_estimate(db, event)
        db.refresh(event)

    result, engine, model, warnings = ai_generate_plan(
        event,
        recommendations=recommendations,
        focus=payload.focus,
        revision_notes=payload.revision_notes,
    )
    if warnings:
        result["warnings"] = list(result.get("warnings", [])) + warnings

    # Validate once more before persisting: nothing unvalidated reaches the DB.
    validated = EventPlanPayload.model_validate(result)
    if engine == "ai":
        event.risk_level = event.risk_level or "medium"
    plan = Plan(
        event_id=event.id,
        payload=validated.model_dump(),
        engine=engine,
        model=model,
        schema_version="1.0",
    )
    db.add(plan)
    db.flush()

    # Seed the workspace checklist from the generated vendor checklist exactly
    # once, so regeneration does not duplicate tasks.
    existing_tasks = db.execute(select(func.count(Task.id)).where(Task.event_id == event.id)).scalar() or 0
    if existing_tasks == 0:
        for item in validated.vendor_checklist:
            db.add(
                Task(
                    event_id=event.id,
                    title=item.item,
                    category=item.category[:40],
                    done=False,
                )
            )
    db.commit()
    db.refresh(plan)
    return PlanOut(
        id=plan.id,
        event_id=plan.event_id,
        engine=plan.engine,
        model=plan.model,
        schema_version=plan.schema_version,
        created_at=plan.created_at,
        plan=validated,
        ai_configured=get_settings().ai_configured,
    )


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    request: Request,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> ChatResponse:
    _ai_guard(request, db, user)
    event = get_owned_event(db, user, payload.event_id)

    plan = db.execute(
        select(Plan).where(Plan.event_id == event.id).order_by(Plan.created_at.desc()).limit(1)
    ).scalar_one_or_none()
    plan_payload = plan.payload if plan else None

    reply, engine, model, warnings = ai_chat(
        event,
        payload.message,
        [turn.model_dump() for turn in payload.history],
        plan_payload,
    )
    return ChatResponse(
        reply=reply,
        engine=engine,
        model=model,
        grounded_on=event.name,
        warnings=warnings,
    )
