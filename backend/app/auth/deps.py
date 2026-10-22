from __future__ import annotations

from datetime import UTC, datetime

from fastapi import Cookie, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session as OrmSession

from app.core.config import get_settings
from app.core.security import constant_time_equal, generate_session_token, hash_token, session_expiry
from app.database.db import get_db
from app.database.models import AuthSession, User

SESSION_COOKIE = "eventora_session"
CSRF_COOKIE = "eventora_csrf"


def _cookie_settings() -> dict:
    settings = get_settings()
    return {
        "httponly": True,
        "secure": settings.secure_cookies,
        "samesite": "lax",
        "path": "/",
    }


def set_session_cookies(response: Response, token: str, csrf_token: str, max_age_days: int) -> None:
    settings = get_settings()
    max_age = max_age_days * 24 * 60 * 60
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=max_age,
        **_cookie_settings(),
    )
    # CSRF token is intentionally readable by same-origin JavaScript: it is a
    # double-submit value, not a credential on its own.
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        max_age=max_age,
        httponly=False,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
    )


def clear_session_cookies(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie(settings.csrf_cookie_name, path="/")


def new_session(db: OrmSession, user: User, response: Response) -> str:
    settings = get_settings()
    token = generate_session_token()
    csrf_token = generate_session_token()
    session = AuthSession(
        user_id=user.id,
        token_hash=hash_token(token),
        csrf_hash=hash_token(csrf_token),
        expires_at=session_expiry(settings.session_ttl_days),
    )
    db.add(session)
    db.commit()
    set_session_cookies(response, token, csrf_token, settings.session_ttl_days)
    return csrf_token


def revoke_session(db: OrmSession, session: AuthSession, response: Response) -> None:
    db.delete(session)
    db.commit()
    clear_session_cookies(response)


def get_current_session(
    request: Request,
    db: OrmSession = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> AuthSession:
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    token_hash = hash_token(session_token)
    session = db.execute(select(AuthSession).where(AuthSession.token_hash == token_hash)).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    if session.expires_at.replace(tzinfo=UTC) <= datetime.now(UTC):
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please sign in again.")
    return session


def get_current_user(
    request: Request,
    db: OrmSession = Depends(get_db),
    session: AuthSession = Depends(get_current_session),
) -> User:
    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return user


def get_optional_user(
    db: OrmSession = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> User | None:
    """Return the user when a valid session cookie is present, else None.

    Used by public-but-rate-limited ML demo endpoints. Any error is treated as
    unauthenticated rather than an exception.
    """
    if not session_token:
        return None
    session = db.execute(
        select(AuthSession).where(AuthSession.token_hash == hash_token(session_token))
    ).scalar_one_or_none()
    if session is None or session.expires_at.replace(tzinfo=UTC) <= datetime.now(UTC):
        return None
    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        return None
    return user


def require_csrf(
    db: OrmSession = Depends(get_db),
    session: AuthSession = Depends(get_current_session),
    csrf_header: str | None = Header(default=None, alias="X-CSRF-Token"),
) -> None:
    """Double-submit CSRF check for cookie-authenticated mutations."""
    if not csrf_header or not constant_time_equal(hash_token(csrf_header), session.csrf_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Request verification failed. Refresh the page and try again.",
        )
