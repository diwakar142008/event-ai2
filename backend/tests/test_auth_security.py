from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import ORIGIN, Account


def test_health_reports_status_without_secrets(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "ai_api_key" not in body
    assert "secret" not in str(body).lower()
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Cache-Control"] == "no-store"


def test_signup_signin_me_signout_flow(client: TestClient):
    account = Account(client, "flow@example.test", "Flowpass2026!")
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "flow@example.test"

    out = client.post("/api/auth/signout", headers=account.headers())
    assert out.status_code == 204
    assert client.get("/api/auth/me").status_code == 401

    bad = client.post("/api/auth/signin", json={"email": "flow@example.test", "password": "wrong-password"}, headers={"Origin": ORIGIN})
    assert bad.status_code == 401
    assert "invalid email or password" in bad.json()["error"]["message"].lower()

    good = client.post(
        "/api/auth/signin",
        json={"email": "flow@example.test", "password": "Flowpass2026!"},
        headers={"Origin": ORIGIN},
    )
    assert good.status_code == 200
    assert good.json()["user"]["email"] == "flow@example.test"
    assert client.get("/api/auth/me").status_code == 200


def test_session_cookie_is_httponly_and_csrf_is_readable(client: TestClient):
    Account(client, "cookie@example.test", "Cookiepass2026!")
    raw = client.get("/api/auth/me").headers
    set_cookie = client.cookies.get("eventora_session")
    assert set_cookie
    # Cookie jar does not expose flags, so inspect the raw sign-in response.
    signin = client.post(
        "/api/auth/signin",
        json={"email": "cookie@example.test", "password": "Cookiepass2026!"},
        headers={"Origin": ORIGIN},
    )
    cookies = signin.headers.get_list("set-cookie")
    session_cookie = next(cookie for cookie in cookies if cookie.startswith("eventora_session="))
    csrf_cookie = next(cookie for cookie in cookies if cookie.startswith("eventora_csrf="))
    assert "HttpOnly" in session_cookie
    assert "HttpOnly" not in csrf_cookie
    assert "SameSite=lax" in session_cookie
    assert raw is not None


def test_signup_rejects_weak_input_and_duplicate_email(client: TestClient):
    weak = client.post(
        "/api/auth/signup",
        json={"email": "weak@example.test", "password": "aaaaaaaaaa", "display_name": "Weak"},
        headers={"Origin": ORIGIN},
    )
    assert weak.status_code == 422
    assert weak.json()["error"]["code"] == "validation_error"

    invalid_email = client.post(
        "/api/auth/signup",
        json={"email": "not-an-email", "password": "Strongpass2026!", "display_name": "Weak"},
        headers={"Origin": ORIGIN},
    )
    assert invalid_email.status_code == 422

    Account(client, "dupe@example.test", "Strongpass2026!")
    duplicate = client.post(
        "/api/auth/signup",
        json={"email": "dupe@example.test", "password": "Strongpass2026!", "display_name": "Dupe"},
        headers={"Origin": ORIGIN},
    )
    assert duplicate.status_code == 409


def test_csrf_header_required_for_mutations(client: TestClient):
    account = Account(client, "csrf@example.test", "Csrfpass2026!")
    payload = {"title": "Confirm venue", "category": "venue"}
    missing = client.post("/api/events/does-not-matter/tasks", json=payload, headers={"Origin": ORIGIN})
    assert missing.status_code in {401, 403}

    event = account.create_event()
    no_header = client.post(
        f"/api/events/{event['id']}/tasks",
        json=payload,
        headers={"Origin": ORIGIN},
    )
    assert no_header.status_code == 403
    assert no_header.json()["error"]["code"] == "forbidden"

    wrong = client.post(
        f"/api/events/{event['id']}/tasks",
        json=payload,
        headers={"Origin": ORIGIN, "X-CSRF-Token": "not-the-token"},
    )
    assert wrong.status_code == 403


def test_origin_is_enforced_for_mutations(client: TestClient):
    account = Account(client, "origin@example.test", "Originpass2026!")
    event = account.create_event()
    rejected = client.post(
        f"/api/events/{event['id']}/tasks",
        json={"title": "Confirm venue", "category": "venue"},
        headers={"Origin": "https://evil.example", "X-CSRF-Token": account.csrf or ""},
    )
    assert rejected.status_code == 403
    assert rejected.json()["error"]["code"] == "origin_rejected"

    missing = client.post(
        f"/api/events/{event['id']}/tasks",
        json={"title": "Confirm venue", "category": "venue"},
        headers={"X-CSRF-Token": account.csrf or ""},
    )
    assert missing.status_code == 403


def test_cross_user_event_access_is_denied(client: TestClient):
    from app.main import app as fastapi_app

    with TestClient(fastapi_app, base_url="http://testserver") as owner_client, TestClient(
        fastapi_app, base_url="http://testserver"
    ) as intruder_client:
        owner = Account(owner_client, "owner@example.test", "Ownerpass2026!", "Owner")
        intruder = Account(intruder_client, "intruder@example.test", "Intruderpass2026!", "Intruder")
        event = owner.create_event()

        assert intruder.client.get(f"/api/events/{event['id']}").status_code == 404
        assert intruder.client.put(
            f"/api/events/{event['id']}",
            json={"name": "Hijacked"},
            headers=intruder.headers(),
        ).status_code == 404
        assert intruder.client.delete(f"/api/events/{event['id']}", headers=intruder.headers()).status_code == 404
        assert intruder.client.get(f"/api/events/{event['id']}/tasks").status_code == 404
        assert intruder.client.post(
            f"/api/events/{event['id']}/tasks",
            json={"title": "Injected task", "category": "general"},
            headers=intruder.headers(),
        ).status_code == 404
        assert intruder.client.post(
            f"/api/events/{event['id']}/expenses",
            json={"label": "Injected expense", "amount_cents": 100},
            headers=intruder.headers(),
        ).status_code == 404
        assert intruder.client.get(f"/api/events/{event['id']}/plan").status_code == 404
        assert intruder.client.post(
            "/api/ai/generate-plan",
            json={"event_id": event["id"]},
            headers=intruder.headers(),
        ).status_code == 404

        listing = intruder.client.get("/api/events").json()
        assert listing["total"] == 0

        owner_listing = owner.client.get("/api/events").json()
        assert owner_listing["total"] == 1



def test_authentication_required_for_private_routes(client: TestClient):
    for path in ("/api/events", "/api/dashboard", "/api/account/export", "/api/ai/status"):
        assert client.get(path).status_code == 401


def test_rate_limit_on_auth_endpoint(client: TestClient, monkeypatch, settings):
    monkeypatch.setattr(settings, "rate_limit_auth", 2)
    payload = {"email": "nobody@example.test", "password": "whatever"}
    codes = []
    for _ in range(4):
        response = client.post("/api/auth/signin", json=payload, headers={"Origin": ORIGIN})
        codes.append(response.status_code)
    assert 429 in codes
    limited = client.post("/api/auth/signin", json=payload, headers={"Origin": ORIGIN})
    assert limited.status_code == 429
    assert "Retry-After" in limited.headers
    assert limited.json()["error"]["code"] == "rate_limited"


def test_oversized_body_is_rejected(client: TestClient):
    huge = "x" * 600_000
    response = client.post(
        "/api/auth/signup",
        json={"email": "big@example.test", "password": "Strongpass2026!", "display_name": huge},
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 413


def test_input_length_limits_and_unexpected_fields(client: TestClient, account: Account):
    too_long = account.client.post(
        "/api/events",
        json={
            "name": "N" * 121,
            "event_type": "wedding",
            "event_date": "2027-08-14T17:00:00Z",
            "city": "Lisbon",
            "location_tier": "metro",
            "guest_count": 100,
            "budget_cents": 1_000_000,
            "currency": "USD",
            "theme": "romantic_garden",
            "venue_type": "garden_outdoor",
            "catering_level": "full",
            "decor_level": "classic",
            "photography": "full",
        },
        headers=account.headers(),
    )
    assert too_long.status_code == 422

    extra = account.client.post(
        "/api/events",
        json={
            "name": "Valid name",
            "event_type": "wedding",
            "event_date": "2027-08-14T17:00:00Z",
            "city": "Lisbon",
            "location_tier": "metro",
            "guest_count": 100,
            "budget_cents": 1_000_000,
            "currency": "USD",
            "theme": "romantic_garden",
            "venue_type": "garden_outdoor",
            "catering_level": "full",
            "decor_level": "classic",
            "photography": "full",
            "user_id": "someone-else",
        },
        headers=account.headers(),
    )
    assert extra.status_code == 422
    assert "user_id" in str(extra.json())


def test_sql_injection_and_xss_payloads_are_stored_as_data(client: TestClient, account: Account):
    injection = "Robert'); DROP TABLE events;--"
    xss = "<script>alert('xss')</script>"
    event = account.create_event(name=injection, notes=xss, city="Lisbon")

    fetched = account.client.get(f"/api/events/{event['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == injection
    assert fetched.json()["notes"] == xss
    assert fetched.headers["content-type"].startswith("application/json")
    # The table still exists and pagination search is parameterised.
    listing = account.client.get("/api/events", params={"q": "'; DROP TABLE events;--"}).json()
    assert listing["total"] >= 0
    assert account.client.get("/api/events").status_code == 200


def test_cors_only_allows_configured_origins(client: TestClient):
    allowed = client.options(
        "/api/events",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert allowed.status_code == 200
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert allowed.headers.get("access-control-allow-credentials") == "true"

    blocked = client.options(
        "/api/events",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert blocked.headers.get("access-control-allow-origin") is None


def test_password_reset_flow_invalidates_sessions(client: TestClient):
    account = Account(client, "reset@example.test", "Resetpass2026!")
    request = client.post(
        "/api/auth/password-reset/request",
        json={"email": "reset@example.test"},
        headers={"Origin": ORIGIN},
    )
    assert request.status_code == 202
    token = request.json().get("dev_reset_token")
    assert token

    unknown = client.post(
        "/api/auth/password-reset/request",
        json={"email": "unknown@example.test"},
        headers={"Origin": ORIGIN},
    )
    assert unknown.status_code == 202
    assert "dev_reset_token" not in unknown.json()

    confirm = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": token, "new_password": "Newreset2026!"},
        headers={"Origin": ORIGIN},
    )
    assert confirm.status_code == 200
    assert client.get("/api/auth/me").status_code == 401

    old_login = client.post(
        "/api/auth/signin",
        json={"email": "reset@example.test", "password": "Resetpass2026!"},
        headers={"Origin": ORIGIN},
    )
    assert old_login.status_code == 401
    new_login = client.post(
        "/api/auth/signin",
        json={"email": "reset@example.test", "password": "Newreset2026!"},
        headers={"Origin": ORIGIN},
    )
    assert new_login.status_code == 200

    reuse = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": token, "new_password": "Another2026!"},
        headers={"Origin": ORIGIN},
    )
    assert reuse.status_code == 400


def test_account_deletion_requires_password_and_deletes_records(client: TestClient, account: Account):
    event = account.create_event()
    wrong = account.client.request(
        "DELETE",
        "/api/auth/account",
        json={"password": "not-it", "confirmation": "DELETE"},
        headers=account.headers(),
    )
    assert wrong.status_code == 403

    deleted = account.client.request(
        "DELETE",
        "/api/auth/account",
        json={"password": "Atelier2026!", "confirmation": "DELETE"},
        headers=account.headers(),
    )
    assert deleted.status_code == 204
    assert account.client.get("/api/auth/me").status_code == 401

    new_account = Account(account.client, "fresh@example.test", "Freshpass2026!")
    assert new_account.client.get(f"/api/events/{event['id']}").status_code == 404


def test_frontend_source_has_no_obvious_secret_leakage():
    from pathlib import Path

    frontend = Path(__file__).resolve().parents[2] / "frontend"
    scanned = []
    for path in list(frontend.glob("app/**/*.ts*")) + list(frontend.glob("components/**/*.ts*")) + list(frontend.glob("lib/**/*.ts*")):
        if "node_modules" in str(path) or ".next" in str(path):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        scanned.append(path)
        assert "AI_API_KEY" not in text, path
        assert "NEXT_PUBLIC_" + "AI_" not in text, path
        assert "sk-proj-" not in text, path
        assert "SUPABASE_SERVICE_ROLE" not in text, path
    assert scanned, "no frontend source files were scanned"


def test_database_failure_returns_safe_generic_error(client: TestClient):
    from sqlalchemy.exc import OperationalError

    from app.database.db import get_db
    from app.main import app as fastapi_app

    with TestClient(fastapi_app, base_url="http://testserver", raise_server_exceptions=False) as safe_client:
        safe_account = Account(safe_client, "dbfail@example.test", "Dbfail2026!")

        def broken_db():
            raise OperationalError("SELECT secret FROM private", {}, Exception("boom"))
            yield  # pragma: no cover

        fastapi_app.dependency_overrides[get_db] = broken_db
        try:
            response = safe_account.client.get("/api/events")
        finally:
            fastapi_app.dependency_overrides.clear()
    assert response.status_code == 500
    body = response.json()
    assert body["error"]["code"] == "internal_error"
    assert "SELECT" not in str(body)
    assert "OperationalError" not in str(body)
