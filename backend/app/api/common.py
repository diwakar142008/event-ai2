from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from app.database.models import Event, User
from app.ml.service import ModelNotTrained
from app.ml.service import engine as ml_engine


def get_owned_event(db: OrmSession, user: User, event_id: str) -> Event:
    """Fetch an event *only* if the authenticated user owns it.

    Returning 404 (not 403) for other users' IDs avoids confirming that a record
    exists, which limits enumeration of private event data.
    """
    event = db.execute(
        select(Event).where(Event.id == event_id, Event.user_id == user.id)
    ).scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    return event


def refresh_event_estimate(db: OrmSession, event: Event) -> None:
    """Refresh stored ML estimate and risk. Missing artifacts never break CRUD."""
    try:
        prediction = ml_engine.predict_cost(
            {
                "event_type": event.event_type,
                "guest_count": event.guest_count,
                "location_tier": event.location_tier,
                "venue_type": event.venue_type,
                "duration_hours": event.duration_hours or 5.0,
                "catering_level": event.catering_level,
                "decor_level": event.decor_level,
                "photography": event.photography,
            }
        )
        event.predicted_cost_cents = prediction["predicted_cost_cents"]
        risk = ml_engine.budget_risk(
            event_type=event.event_type,
            guest_count=event.guest_count,
            budget_cents=event.budget_cents,
            predicted_cost_cents=prediction["predicted_cost_cents"],
            contingency_pct=8.0,
        )
        event.risk_level = risk["risk_level"]
        db.add(event)
        db.commit()
    except ModelNotTrained:
        event.predicted_cost_cents = None
        event.risk_level = None
        db.add(event)
        db.commit()
    except Exception:  # noqa: BLE001 - estimation must never break event persistence
        db.rollback()


def serialize_event(event: Event) -> dict:
    return {
        "id": event.id,
        "name": event.name,
        "event_type": event.event_type,
        "event_date": event.event_date,
        "city": event.city,
        "location_tier": event.location_tier,
        "guest_count": event.guest_count,
        "budget_cents": event.budget_cents,
        "currency": event.currency,
        "theme": event.theme,
        "venue_type": event.venue_type,
        "catering_level": event.catering_level,
        "decor_level": event.decor_level,
        "photography": event.photography,
        "duration_hours": event.duration_hours,
        "accessibility": event.accessibility,
        "notes": event.notes,
        "predicted_cost_cents": event.predicted_cost_cents,
        "risk_level": event.risk_level,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
    }
