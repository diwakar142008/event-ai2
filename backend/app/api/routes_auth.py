from __future__ import annotations

import logging
import base64
import hashlib
import secrets
from datetime import UTC, timedelta
from typing import Literal
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session as OrmSession
from starlette.responses import RedirectResponse

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
    is_valid_email,
    normalize_email,
    utcnow,
    verify_password,
)
from app.database.db import get_db
from app.database.models import AuthSession, OAuthIdentity, OAuthLoginAttempt, PasswordResetToken, User
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
OAUTH_CONFIG = {
    "google": {
        "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_endpoint": "https://oauth2.googleapis.com/token",
        "userinfo_endpoint": "https://openidconnect.googleapis.com/v1/userinfo",
        "scope": "openid email profile",
        "pkce": True,
    },
    "facebook": {
        "authorization_endpoint": "https://www.facebook.com/v22.0/dialog/oauth",
        "token_endpoint": "https://graph.facebook.com/v22.0/oauth/access_token",
        "userinfo_endpoint": "https://graph.facebook.com/v22.0/me",
        "scope": "email public_profile",
        "pkce": False,
    },
    "microsoft": {
        "authorization_endpoint": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "token_endpoint": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "userinfo_endpoint": "https://graph.microsoft.com/oidc/userinfo",
        "scope": "openid profile email",
        "pkce": True,
    },
}
OAUTH_STATE_TTL = timedelta(minutes=10)


def _user_out(user: User) -> UserOut:
    return UserOut(id=user.id, email=user.email, display_name=user.display_name, created_at=user.created_at)


def _oauth_client(provider: str) -> tuple[str, str]:
    client_id, client_secret = get_settings().oauth_providers[provider]
    return client_id.strip(), client_secret.strip()


def _oauth_redirect_uri(provider: str) -> str:
    frontend = get_settings().oauth_frontend_url.rstrip("/")
    return f"{frontend}/api/backend/auth/oauth/{provider}/callback"


def _oauth_return_url(return_to: str, error: str | None = None) -> str:
    frontend = get_settings().oauth_frontend_url.rstrip("/")
    path = "/sign-up" if return_to == "sign-up" else "/sign-in"
    query = f"?oauth_error={error}" if error else ""
    return f"{frontend}{path}{query}"


def _oauth_error_redirect(return_to: str, error: str, cookie_name: str) -> Response:
    response = RedirectResponse(_oauth_return_url(return_to, error), status_code=303)
    response.delete_cookie(cookie_name, path="/")
    return response


def _pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


@router.get("/oauth/providers")
def oauth_providers() -> dict[str, dict[str, dict[str, bool]]]:
    settings = get_settings()
    return {
        "providers": {
            name: {"enabled": bool(client_id.strip() and client_secret.strip())}
            for name, (client_id, client_secret) in settings.oauth_providers.items()
        }
    }


@router.get("/oauth/{provider}")
def start_oauth(
    provider: str,
    request: Request,
    db: OrmSession = Depends(get_db),
    return_to: Literal["sign-in", "sign-up"] = "sign-in",
) -> Response:
    config = OAUTH_CONFIG.get(provider)
    if config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sign-in provider not found.")

    settings = get_settings()
    client_id, client_secret = _oauth_client(provider)
    if not client_id or not client_secret:
        return RedirectResponse(_oauth_return_url(return_to, "provider_unavailable"), status_code=303)

    check_rate_limit(db, client_key(request, "oauth"), settings.rate_limit_auth)
    now = utcnow()
    db.execute(delete(OAuthLoginAttempt).where(OAuthLoginAttempt.expires_at <= now))

    state = generate_session_token()
    browser_token = generate_session_token()
    verifier, challenge = _pkce_pair() if config["pkce"] else (None, None)
    db.add(
        OAuthLoginAttempt(
            state_hash=hash_token(state),
            browser_hash=hash_token(browser_token),
            provider=provider,
            code_verifier=verifier,
            return_to=return_to,
            expires_at=now + OAUTH_STATE_TTL,
        )
    )
    db.commit()

    params = {
        "client_id": client_id,
        "redirect_uri": _oauth_redirect_uri(provider),
        "response_type": "code",
        "scope": config["scope"],
        "state": state,
    }
    if challenge:
        params.update({"code_challenge": challenge, "code_challenge_method": "S256"})
    if provider == "google":
        params["include_granted_scopes"] = "true"

    response = RedirectResponse(
        f"{config['authorization_endpoint']}?{urlencode(params)}",
        status_code=303,
    )
    response.set_cookie(
        key=f"eventora_oauth_{provider}",
        value=browser_token,
        max_age=int(OAUTH_STATE_TTL.total_seconds()),
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
    )
    return response


@router.get("/oauth/{provider}/callback")
def finish_oauth(
    provider: str,
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: OrmSession = Depends(get_db),
) -> Response:
    config = OAUTH_CONFIG.get(provider)
    if config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sign-in provider not found.")

    settings = get_settings()
    cookie_name = f"eventora_oauth_{provider}"
    browser_token = request.cookies.get(cookie_name)
    attempt = None
    if state:
        attempt = db.execute(
            select(OAuthLoginAttempt).where(
                OAuthLoginAttempt.state_hash == hash_token(state),
                OAuthLoginAttempt.provider == provider,
            )
        ).scalar_one_or_none()

    now = utcnow()
    if (
        attempt is None
        or attempt.expires_at.replace(tzinfo=UTC) <= now
        or not browser_token
        or not secrets.compare_digest(attempt.browser_hash, hash_token(browser_token))
    ):
        if attempt is not None:
            db.delete(attempt)
            db.commit()
        return _oauth_error_redirect("sign-in", "invalid_state", cookie_name)

    return_to = attempt.return_to
    code_verifier = attempt.code_verifier
    db.delete(attempt)
    db.commit()
    if error or not code:
        return _oauth_error_redirect(return_to, "cancelled", cookie_name)

    client_id, client_secret = _oauth_client(provider)
    token_payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": _oauth_redirect_uri(provider),
        "client_id": client_id,
        "client_secret": client_secret,
    }
    if code_verifier:
        token_payload["code_verifier"] = code_verifier

    try:
        with httpx.Client(timeout=10.0) as client:
            token_response = client.post(config["token_endpoint"], data=token_payload)
            token_response.raise_for_status()
            token_data = token_response.json()
            if not isinstance(token_data, dict):
                raise ValueError("Provider token response must be an object.")
            access_token = token_data.get("access_token")
            if not isinstance(access_token, str) or not access_token:
                raise ValueError("Provider token response did not contain an access token.")
            userinfo_response = client.get(
                config["userinfo_endpoint"],
                headers={"Authorization": f"Bearer {access_token}"},
                params={"fields": "id,name,email"} if provider == "facebook" else None,
            )
            userinfo_response.raise_for_status()
            identity_data = userinfo_response.json()
            if not isinstance(identity_data, dict):
                raise ValueError("Provider profile response must be an object.")
    except httpx.HTTPError:
        logger.warning("OAuth provider request failed provider=%s", provider)
        return _oauth_error_redirect(return_to, "provider_error", cookie_name)
    except ValueError:
        logger.warning("OAuth provider returned invalid JSON provider=%s", provider)
        return _oauth_error_redirect(return_to, "provider_error", cookie_name)

    subject = identity_data.get("sub") or identity_data.get("id")
    email = identity_data.get("email")
    display_name = identity_data.get("name") or identity_data.get("given_name") or ""
    if (
        not isinstance(subject, str)
        or not subject
        or not isinstance(email, str)
        or not email.strip()
        or not isinstance(display_name, str)
    ):
        return _oauth_error_redirect(return_to, "email_required", cookie_name)

    email = normalize_email(email)
    if len(email) > 254 or not is_valid_email(email):
        return _oauth_error_redirect(return_to, "email_required", cookie_name)
    display_name = "".join(character for character in display_name if character.isprintable()).strip()[:80]
    identity = db.execute(
        select(OAuthIdentity).where(
            OAuthIdentity.provider == provider,
            OAuthIdentity.subject == subject,
        )
    ).scalar_one_or_none()
    user = db.get(User, identity.user_id) if identity else None
    if user is None:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        email_verified = identity_data.get("email_verified") is True
        if user is not None and not email_verified:
            return _oauth_error_redirect(return_to, "account_conflict", cookie_name)
        if user is None:
            user = User(
                email=email,
                display_name=display_name or email.split("@", 1)[0],
                password_hash=hash_password(generate_session_token()),
            )
            db.add(user)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                return _oauth_error_redirect(return_to, "account_conflict", cookie_name)
        db.add(OAuthIdentity(user_id=user.id, provider=provider, subject=subject))
    if not user.is_active:
        db.rollback()
        return _oauth_error_redirect(return_to, "account_unavailable", cookie_name)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return _oauth_error_redirect(return_to, "account_conflict", cookie_name)

    final_response = RedirectResponse(
        f"{settings.oauth_frontend_url.rstrip('/')}/dashboard",
        status_code=303,
    )
    new_session(db, user, final_response)
    final_response.delete_cookie(cookie_name, path="/")
    logger.info("oauth sign-in completed provider=%s user_id=%s", provider, user.id)
    return final_response


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
