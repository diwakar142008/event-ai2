from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session as OrmSession

from app import __version__
from app.core.config import get_settings
from app.database.db import get_db
from app.ml.service import engine as ml_engine

router = APIRouter(tags=["system"])


@router.get("/health")
def health(response: Response, db: OrmSession = Depends(get_db)) -> dict:
    settings = get_settings()
    database_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - health must report, not raise
        database_ok = False
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    metrics = ml_engine.metrics()
    return {
        "status": "ok" if database_ok else "degraded",
        "version": __version__,
        "environment": settings.app_env,
        "database": "ok" if database_ok else "unavailable",
        "ai_configured": settings.ai_configured,
        "ai_provider": settings.ai_provider if settings.ai_configured else "none",
        "models_trained": metrics["trained"],
    }


@router.get("/api/config/status")
def config_status() -> dict:
    settings = get_settings()
    metrics = ml_engine.metrics()
    return {
        "environment": settings.app_env,
        "auth_mode": "self-hosted sessions (Argon2id + opaque HttpOnly cookies)",
        "ai": {
            "configured": settings.ai_configured,
            "provider": settings.ai_provider if settings.ai_configured else "none",
            "model": settings.ai_model if settings.ai_configured else None,
            "fallback": "eventora-deterministic-v1",
        },
        "models": metrics["trained"],
        "currency": "USD",
        "limitations": [
            "Self-hosted auth is intended for this deployment profile; Supabase Auth is the documented hosted upgrade.",
            "AI provider is optional; fallback planning is deterministic and clearly labelled.",
        ],
    }
