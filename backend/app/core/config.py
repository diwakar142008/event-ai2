from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime configuration.

    All values are read from environment variables (optionally a .env file).
    Secrets never leave the server: only values prefixed with PUBLIC_ would be
    safe to expose, and this project exposes none of those.
    """

    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_DIR / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Eventora AI"
    app_env: str = "development"  # development | test | production
    log_level: str = "INFO"

    # --- Persistence -----------------------------------------------------
    database_url: str = f"sqlite:///{BACKEND_DIR / 'eventora.db'}"
    auto_create_tables: bool = True

    # --- Browser / session ----------------------------------------------
    frontend_origins: str = "http://localhost:3000"
    session_cookie_name: str = "eventora_session"
    csrf_cookie_name: str = "eventora_csrf"
    session_ttl_days: int = 7
    cookie_secure: bool | None = None  # inferred from app_env when unset
    app_secret: str = "dev-only-insecure-secret-change-me"
    auth_dev_reset_echo: bool = True  # local development only
    oauth_frontend_url: str = "http://localhost:3000"
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    facebook_oauth_client_id: str = ""
    facebook_oauth_client_secret: str = ""
    microsoft_oauth_client_id: str = ""
    microsoft_oauth_client_secret: str = ""

    # --- Request limits --------------------------------------------------
    max_request_bytes: int = 512_000
    max_page_size: int = 50

    # --- Rate limits (requests per window seconds) -----------------------
    rate_limit_auth: int = 10
    rate_limit_ai: int = 12
    rate_limit_ml: int = 60
    rate_limit_window_seconds: int = 60

    # --- Machine learning ------------------------------------------------
    ml_artifacts_dir: str = str(BACKEND_DIR / "ml_artifacts")

    # --- Generative AI ---------------------------------------------------
    ai_provider: str = "none"  # none | openai (any OpenAI-compatible endpoint)
    ai_api_key: str = ""
    ai_base_url: str = "https://api.openai.com/v1"
    ai_model: str = "gpt-4o-mini"
    ai_timeout_seconds: float = 30.0
    ai_max_output_tokens: int = 2600
    ai_max_input_chars: int = 12_000

    @field_validator("app_env")
    @classmethod
    def _validate_env(cls, value: str) -> str:
        allowed = {"development", "test", "production"}
        if value not in allowed:
            raise ValueError(f"app_env must be one of {sorted(allowed)}")
        return value

    @field_validator("ai_provider")
    @classmethod
    def _validate_provider(cls, value: str) -> str:
        allowed = {"none", "openai"}
        if value not in allowed:
            raise ValueError(f"ai_provider must be one of {sorted(allowed)}")
        return value

    @model_validator(mode="after")
    def _validate_production_security(self) -> "Settings":
        """Fail early when a production deployment is missing critical controls."""
        if not self.is_production:
            return self

        has_placeholder_secret = self.app_secret.startswith("dev-only") or self.app_secret == "replace-with-a-long-random-secret"
        if has_placeholder_secret or len(self.app_secret) < 32:
            raise ValueError("APP_SECRET must be a unique random value of at least 32 characters in production")
        if self.cookie_secure is False:
            raise ValueError("COOKIE_SECURE must be true in production")
        if self.auth_dev_reset_echo:
            raise ValueError("AUTH_DEV_RESET_ECHO must be false in production")
        if not self.allowed_origins:
            raise ValueError("FRONTEND_ORIGINS must contain at least one HTTPS origin in production")
        if any(not origin.startswith("https://") for origin in self.allowed_origins):
            raise ValueError("FRONTEND_ORIGINS must use HTTPS origins in production")
        oauth_configured = any(
            client_id or client_secret
            for client_id, client_secret in self.oauth_providers.values()
        )
        if oauth_configured and not self.oauth_frontend_url.startswith("https://"):
            raise ValueError("OAUTH_FRONTEND_URL must use HTTPS in production")
        return self

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.frontend_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def secure_cookies(self) -> bool:
        if self.cookie_secure is not None:
            return self.cookie_secure
        return self.is_production

    @property
    def ai_configured(self) -> bool:
        return self.ai_provider != "none" and bool(self.ai_api_key.strip())

    @property
    def oauth_providers(self) -> dict[str, tuple[str, str]]:
        return {
            "google": (self.google_oauth_client_id, self.google_oauth_client_secret),
            "facebook": (self.facebook_oauth_client_id, self.facebook_oauth_client_secret),
            "microsoft": (self.microsoft_oauth_client_id, self.microsoft_oauth_client_secret),
        }

    @property
    def artifacts_path(self) -> Path:
        """Resolve relative artifact paths against the backend directory.

        This keeps `python backend/scripts/train_models.py` from the repository
        root and `uvicorn app.main:app` from backend/ pointing at the same files.
        """
        path = Path(self.ml_artifacts_dir)
        return path if path.is_absolute() else BACKEND_DIR / path

    def warn_if_insecure(self) -> list[str]:
        warnings: list[str] = []
        if self.is_production and self.app_secret.startswith("dev-only"):
            warnings.append("APP_SECRET is still the development default in production.")
        if self.is_production and not self.allowed_origins:
            warnings.append("No FRONTEND_ORIGINS configured for production.")
        for origin in self.allowed_origins:
            if self.is_production and not origin.startswith("https://"):
                warnings.append(f"Non-HTTPS frontend origin configured: {origin}")
        return warnings


@lru_cache
def get_settings() -> Settings:
    return Settings()


def reset_settings_cache() -> None:
    get_settings.cache_clear()
    os.environ.pop("_EVENTORA_TEST", None)
