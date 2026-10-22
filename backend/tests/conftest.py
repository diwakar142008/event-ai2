from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
TEST_DB = BACKEND_DIR / "tests" / "test_eventora.db"
for suffix in ("", "-wal", "-shm"):
    Path(str(TEST_DB) + suffix).unlink(missing_ok=True)

os.environ.update(
    {
        "APP_ENV": "test",
        "DATABASE_URL": f"sqlite:///{TEST_DB}",
        "AUTO_CREATE_TABLES": "true",
        "FRONTEND_ORIGINS": "http://testserver,http://localhost:3000",
        "AUTH_DEV_RESET_ECHO": "true",
        "AI_PROVIDER": "none",
        "AI_API_KEY": "",
        "ML_ARTIFACTS_DIR": str(BACKEND_DIR / "ml_artifacts"),
        "RATE_LIMIT_AUTH": "200",
        "RATE_LIMIT_AI": "200",
        "RATE_LIMIT_ML": "400",
        "APP_SECRET": "test-secret-not-a-production-value",
    }
)

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings  # noqa: E402
from app.database.db import Base, engine  # noqa: E402
from app.database.models import (  # noqa: E402
    AuthSession,
    Event,
    Expense,
    Note,
    PasswordResetToken,
    Plan,
    RateLimitBucket,
    Task,
    User,
)
from app.main import app  # noqa: E402

ORIGIN = "http://testserver"


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.create_all(bind=engine)
    yield
    # SQLite keeps WAL handles open until SQLAlchemy releases pooled
    # connections. Dispose before cleanup so this works reliably on Windows.
    engine.dispose()
    Path(str(TEST_DB) + "-wal").unlink(missing_ok=True)
    Path(str(TEST_DB) + "-shm").unlink(missing_ok=True)


@pytest.fixture(autouse=True)
def clean_database():
    with engine.begin() as connection:
        for model in (RateLimitBucket, Note, Expense, Task, Plan, PasswordResetToken, AuthSession, Event, User):
            connection.execute(model.__table__.delete())
    yield


@pytest.fixture
def client():
    with TestClient(app, base_url="http://testserver") as test_client:
        yield test_client


class Account:
    def __init__(self, client: TestClient, email: str, password: str, name: str = "Test Planner"):
        self.client = client
        self.email = email
        self.password = password
        response = client.post(
            "/api/auth/signup",
            json={"email": email, "password": password, "display_name": name},
            headers={"Origin": ORIGIN},
        )
        assert response.status_code == 201, response.text
        self.user = response.json()["user"]
        self.csrf = client.cookies.get("eventora_csrf")
        assert self.csrf

    def headers(self, csrf: bool = True) -> dict:
        headers = {"Origin": ORIGIN}
        if csrf:
            headers["X-CSRF-Token"] = self.csrf or ""
        return headers

    def create_event(self, **overrides) -> dict:
        payload = {
            "name": "Aster House Dinner",
            "event_type": "wedding",
            "event_date": "2027-08-14T17:00:00Z",
            "city": "Lisbon",
            "location_tier": "metro",
            "guest_count": 120,
            "budget_cents": 3_800_000,
            "currency": "USD",
            "theme": "romantic_garden",
            "venue_type": "garden_outdoor",
            "catering_level": "full",
            "decor_level": "classic",
            "photography": "full",
            "duration_hours": 6,
            "accessibility": "Step-free access",
            "notes": "Sunset ceremony",
        }
        payload.update(overrides)
        response = self.client.post("/api/events", json=payload, headers=self.headers())
        assert response.status_code == 201, response.text
        return response.json()


@pytest.fixture
def account(client):
    return Account(client, "maya@example.test", "Atelier2026!", "Maya Rao")


@pytest.fixture
def other_account():
    # A separate client means a separate cookie jar, so tests can prove that one
    # account cannot read another account's records.
    with TestClient(app, base_url="http://testserver") as other_client:
        yield Account(other_client, "noah@example.test", "Studio2026!", "Noah Vale")


@pytest.fixture
def settings():
    return get_settings()
