from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session as OrmSession

from app.core.config import get_settings
from app.core.security import hash_ip
from app.database.models import RateLimitBucket

logger = logging.getLogger("eventora.ratelimit")


def _now() -> datetime:
    return datetime.now(UTC)


def _raise_limited(retry_after: int) -> None:
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many requests. Please wait a moment and try again.",
        headers={"Retry-After": str(max(1, retry_after))},
    )


def check_rate_limit(db: OrmSession, key: str, limit: int, window_seconds: int | None = None) -> None:
    """Increment a fixed-window counter and raise 429 when the limit is exceeded.

    The counter lives in the database so limits are shared between workers in a
    multi-instance deployment (SQLite locally, Postgres in production).
    Failures of the limiter itself fail closed for expensive/AI routes rather
    than silently disabling protection.
    """
    if limit <= 0:
        return
    settings = get_settings()
    window = window_seconds or settings.rate_limit_window_seconds
    now = _now()
    window_start = now - timedelta(seconds=window)

    try:
        bucket = db.execute(
            select(RateLimitBucket).where(RateLimitBucket.bucket_key == key)
        ).scalar_one_or_none()

        if bucket is None:
            bucket = RateLimitBucket(bucket_key=key, window_start=now, count=1)
            db.add(bucket)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                bucket = db.execute(
                    select(RateLimitBucket).where(RateLimitBucket.bucket_key == key)
                ).scalar_one()
            else:
                return

        if bucket.window_start.replace(tzinfo=UTC) < window_start:
            bucket.window_start = now
            bucket.count = 1
            db.commit()
            return

        bucket.count += 1
        exceeded = bucket.count > limit
        retry_after = int((bucket.window_start.replace(tzinfo=UTC) + timedelta(seconds=window) - now).total_seconds())
        db.commit()
        if exceeded:
            _raise_limited(retry_after)
    except HTTPException:
        raise
    except SQLAlchemyError:
        db.rollback()
        logger.exception("rate limiter storage failure")
        # Fail closed: an unavailable limiter must not become an open door for
        # expensive AI/ML endpoints.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Request protection is temporarily unavailable. Please retry shortly.",
        ) from None


def client_key(request, scope: str) -> str:
    """Pseudonymised IP key. Raw addresses are never persisted."""
    settings = get_settings()
    client_ip = request.client.host if request.client else "unknown"
    return f"{scope}:ip:{hash_ip(client_ip, settings.app_secret)}"


def user_key(user_id: str, scope: str) -> str:
    return f"{scope}:user:{user_id}"
