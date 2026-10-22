from __future__ import annotations

import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session as OrmSession

from app.auth.deps import (
    clear_session_cookies,
    get_current_session,
    get_current_user,
    new_session,
    require_csrf,
    revoke_session,
)
from app.core.config import get_settings
from app.core.rate_limit import check_rate_limit, client_key
from app.core.security import (
    generate_session_token,
    hash_password,
    hash_token,
    utcnow,
    verify_password,
)
from app.database.db import get_db
from app.database.models import AuthSession, PasswordResetToken, User
from app.schemas import (
    DeleteAccountRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    ProfileUpdate,
    SessionOut,
    SignInRequest,
    SignUpRequest,
    UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("eventora.auth")

# A valid hash used only to equalise timing for unknown accounts. It never
# corresponds to a usable credential.
_DUMMY_HASH = hash_password(generate_session_token())


def _user_out(user: User) -> UserOut:
    return UserOut(id=user.id, email=user.email, display_name=user.display_name, created_at=user.created_at)


@router.post("/signup", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def signup(
    payload: SignUpRequest,
    request: Request,
    response: Response,
    db: OrmSession = Depends(get_db),
) -> SessionOut:
    settings = get_settings()
    check_rate_limit(db, client_key(request, "auth"), settings.rate_limit_auth)
    check_rate_limit(db, f"auth-email:{hash_token(payload.email)[:24]}", settings.rate_limit_auth)

    existing = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if existing is not None:
        # Do not reveal whether the address is registered beyond the unavoidable
        # signup conflict; keep the message generic.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Try signing in instead.",
        )

    user = User(
        email=payload.email,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account could not be created.") from None
    db.refresh(user)

    csrf = new_session(db, user, response)
    logger.info("account created user_id=%s", user.id)
    return SessionOut(user=_user_out(user), csrf_token=csrf)


@router.post("/signin", response_model=SessionOut)
def signin(
    payload: SignInRequest,
    request: Request,
    response: Response,
    db: OrmSession = Depends(get_db),
) -> SessionOut:
    settings = get_settings()
    check_rate_limit(db, client_key(request, "auth"), settings.rate_limit_auth)
    check_rate_limit(db, f"auth-email:{hash_token(payload.email.lower())[:24]}", settings.rate_limit_auth)

    user = db.execute(select(User).where(User.email == payload.email.lower())).scalar_one_or_none()
    # Always run a hash comparison to reduce timing differences between unknown
    # accounts and wrong passwords.
    stored_hash = user.password_hash if user else _DUMMY_HASH
    valid = verify_password(payload.password, stored_hash)
    if user is None or not valid or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    csrf = new_session(db, user, response)
    return SessionOut(user=_user_out(user), csrf_token=csrf)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return _user_out(user)


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
def signout(
    response: Response,
    db: OrmSession = Depends(get_db),
    session: AuthSession = Depends(get_current_session),
    _csrf: None = Depends(require_csrf),
) -> Response:
    revoke_session(db, session, response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
def password_reset_request(
    payload: PasswordResetRequest,
    request: Request,
    db: OrmSession = Depends(get_db),
) -> dict:
    settings = get_settings()
    check_rate_limit(db, client_key(request, "auth-reset"), 5)

    user = db.execute(select(User).where(User.email == payload.email.lower())).scalar_one_or_none()
    dev_token: str | None = None
    if user is not None:
        token = generate_session_token()
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hash_token(token),
                expires_at=utcnow() + timedelta(minutes=30),
            )
        )
        db.commit()
        if settings.auth_dev_reset_echo and not settings.is_production:
            # Local development only: no email provider is configured, so the
            # token is returned once. Production must wire an email delivery
            # provider and set AUTH_DEV_RESET_ECHO=false.
            dev_token = token

    body = {"message": "If that email is registered, a reset link has been sent."}
    if dev_token:
        body["dev_reset_token"] = dev_token
        body["dev_notice"] = "Development-only token echo. Disabled in production."
    return body


@router.post("/password-reset/confirm", status_code=status.HTTP_200_OK)
def password_reset_confirm(
    payload: PasswordResetConfirm,
    request: Request,
    db: OrmSession = Depends(get_db),
) -> dict:
    check_rate_limit(db, client_key(request, "auth-reset"), 10)
    reset = db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(payload.token))
    ).scalar_one_or_none()
    if reset is None or reset.used_at is not None or reset.expires_at.replace(tzinfo=utcnow().tzinfo) <= utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset link is invalid or expired.")

    user = db.get(User, reset.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset link is invalid or expired.")

    user.password_hash = hash_password(payload.new_password)
    reset.used_at = utcnow()
    # Invalidate all existing sessions after a password reset.
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.commit()
    logger.info("password reset completed user_id=%s", user.id)
    return {"message": "Password updated. Sign in with your new password."}


@router.patch("/profile", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> UserOut:
    user.display_name = payload.display_name
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    payload: DeleteAccountRequest,
    response: Response,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
) -> Response:
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Password confirmation failed.")
    try:
        db.delete(user)  # cascades to events, plans, tasks, expenses, notes, sessions
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Account deletion failed. Try again.") from None
    clear_session_cookies(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
