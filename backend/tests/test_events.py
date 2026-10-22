from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.conftest import Account


def test_event_crud_with_ml_estimate(account: Account):
    event = account.create_event()
    assert event["predicted_cost_cents"] is not None
    assert event["risk_level"] in {"low", "medium", "high"}
    assert event["predicted_cost_cents"] > 0

    fetched = account.client.get(f"/api/events/{event['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Aster House Dinner"

    updated = account.client.put(
        f"/api/events/{event['id']}",
        json={"name": "Aster House Supper", "guest_count": 160, "budget_cents": 4_400_000},
        headers=account.headers(),
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["name"] == "Aster House Supper"
    assert body["guest_count"] == 160
    assert body["predicted_cost_cents"] is not None
    assert body["predicted_cost_cents"] != event["predicted_cost_cents"]

    deleted = account.client.delete(f"/api/events/{event['id']}", headers=account.headers())
    assert deleted.status_code == 204
    assert account.client.get(f"/api/events/{event['id']}").status_code == 404


@pytest.mark.parametrize(
    "overrides",
    [
        {"event_type": "rave"},
        {"guest_count": 0},
        {"guest_count": 5001},
        {"budget_cents": 99},
        {"budget_cents": 2_000_000_001},
        {"event_date": "1999-01-01T00:00:00Z"},
        {"event_date": "2099-01-01T00:00:00Z"},
        {"theme": "cyberpunk"},
        {"notes": "x" * 2001},
        {"duration_hours": 25},
        {"currency": "EUR"},
    ],
)
def test_event_validation_rejects_bad_values(account: Account, overrides: dict):
    payload = {
        "name": "Valid Event",
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
    }
    payload.update(overrides)
    response = account.client.post("/api/events", json=payload, headers=account.headers())
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "validation_error"


def test_non_finite_numbers_are_rejected(account: Account):
    raw = (
        '{"name":"NaN event","event_type":"wedding","event_date":"2027-08-14T17:00:00Z",'
        '"city":"Lisbon","location_tier":"metro","guest_count":NaN,"budget_cents":1000000,'
        '"currency":"USD","theme":"romantic_garden","venue_type":"garden_outdoor",'
        '"catering_level":"full","decor_level":"classic","photography":"full"}'
    )
    response = account.client.post(
        "/api/events",
        content=raw,
        headers={**account.headers(), "Content-Type": "application/json"},
    )
    assert response.status_code == 422


def test_update_rejects_unowned_fields(account: Account):
    event = account.create_event()
    response = account.client.put(
        f"/api/events/{event['id']}",
        json={"user_id": "another-user", "id": "another-id"},
        headers=account.headers(),
    )
    assert response.status_code == 422

    empty = account.client.put(f"/api/events/{event['id']}", json={}, headers=account.headers())
    assert empty.status_code == 400


def test_event_pagination_and_search(account: Account):
    created = [account.create_event(name=f"Occasion {index}") for index in range(5)]
    page = account.client.get("/api/events", params={"page": 1, "page_size": 2}).json()
    assert page["total"] == 5
    assert page["pages"] == 3
    assert len(page["items"]) == 2

    second = account.client.get("/api/events", params={"page": 2, "page_size": 2}).json()
    assert {item["id"] for item in second["items"]}.isdisjoint({item["id"] for item in page["items"]})

    search = account.client.get("/api/events", params={"q": "Occasion 3"}).json()
    assert search["total"] == 1
    assert search["items"][0]["id"] == created[3]["id"]

    capped = account.client.get("/api/events", params={"page_size": 500}).json()
    assert capped["page_size"] <= 50


def test_tasks_expenses_notes_crud(account: Account):
    event = account.create_event()
    base = f"/api/events/{event['id']}"

    task = account.client.post(
        f"{base}/tasks",
        json={"title": "Confirm the venue walkthrough", "category": "venue", "due_date": "2027-07-01"},
        headers=account.headers(),
    )
    assert task.status_code == 201
    task_id = task.json()["id"]
    toggled = account.client.patch(f"{base}/tasks/{task_id}", json={"done": True}, headers=account.headers())
    assert toggled.status_code == 200
    assert toggled.json()["done"] is True

    expense = account.client.post(
        f"{base}/expenses",
        json={"label": "Venue deposit", "category": "venue", "amount_cents": 500_000, "paid": True},
        headers=account.headers(),
    )
    assert expense.status_code == 201
    expense_id = expense.json()["id"]
    patched = account.client.patch(
        f"{base}/expenses/{expense_id}",
        json={"amount_cents": 550_000, "paid": False},
        headers=account.headers(),
    )
    assert patched.status_code == 200
    assert patched.json()["amount_cents"] == 550_000

    note = account.client.post(f"{base}/notes", json={"body": "Aunt Lina needs step-free access."}, headers=account.headers())
    assert note.status_code == 201
    note_id = note.json()["id"]
    assert len(account.client.get(f"{base}/notes").json()) == 1

    assert account.client.delete(f"{base}/notes/{note_id}", headers=account.headers()).status_code == 204
    assert account.client.delete(f"{base}/expenses/{expense_id}", headers=account.headers()).status_code == 204
    assert account.client.delete(f"{base}/tasks/{task_id}", headers=account.headers()).status_code == 204


def test_nested_resource_ownership_checks(account: Account, other_account: Account):
    event = account.create_event()
    task = account.client.post(
        f"/api/events/{event['id']}/tasks",
        json={"title": "Private task", "category": "general"},
        headers=account.headers(),
    ).json()
    expense = account.client.post(
        f"/api/events/{event['id']}/expenses",
        json={"label": "Private expense", "amount_cents": 1000},
        headers=account.headers(),
    ).json()

    assert account.client.get(f"/api/events/{event['id']}/tasks").status_code == 200
    assert account.client.get(f"/api/events/{event['id']}/expenses").status_code == 200
    # Using the owner's event ID with another account's cookie must not work.
    assert other_account.client.patch(
        f"/api/events/{event['id']}/tasks/{task['id']}",
        json={"done": True},
        headers=other_account.headers(),
    ).status_code == 404
    assert other_account.client.patch(
        f"/api/events/{event['id']}/expenses/{expense['id']}",
        json={"paid": True},
        headers=other_account.headers(),
    ).status_code == 404
    assert other_account.client.delete(
        f"/api/events/{event['id']}/tasks/{task['id']}",
        headers=other_account.headers(),
    ).status_code == 404


def test_dashboard_aggregates_only_own_records(account: Account, other_account: Account):
    event = account.create_event(budget_cents=2_000_000)
    account.client.post(
        f"/api/events/{event['id']}/tasks",
        json={"title": "Book the florist", "category": "decor"},
        headers=account.headers(),
    )
    other_account.create_event(name="Other event", budget_cents=9_000_000)

    dashboard = account.client.get("/api/dashboard").json()
    assert dashboard["stats"]["event_count"] == 1
    assert dashboard["stats"]["total_budget_cents"] == 2_000_000
    assert dashboard["stats"]["total_expenses_cents"] == 0
    assert dashboard["stats"]["tasks_open"] == 1
    assert len(dashboard["upcoming"]) == 1
    assert dashboard["risk_distribution"]["unassessed"] == 0
    assert sum(dashboard["risk_distribution"].values()) == 1
    assert len(dashboard["budget_chart"]) == 1


def test_export_and_data_deletion(account: Account):
    event = account.create_event()
    account.client.post(
        f"/api/events/{event['id']}/expenses",
        json={"label": "Deposit", "amount_cents": 100_000},
        headers=account.headers(),
    )
    export = account.client.get(f"/api/events/{event['id']}/export")
    assert export.status_code == 200
    assert "attachment" in export.headers["content-disposition"]
    body = export.json()
    assert body["event"]["id"] == event["id"]
    assert body["expenses"][0]["amount_cents"] == 100_000

    account_export = account.client.get("/api/account/export")
    assert account_export.status_code == 200
    assert account_export.json()["account"]["email"] == account.email

    wipe = account.client.delete("/api/account/data", headers=account.headers())
    assert wipe.status_code == 204
    assert account.client.get("/api/events").json()["total"] == 0
    assert account.client.get("/api/auth/me").status_code == 200


def test_event_delete_cascades_children(account: Account):
    event = account.create_event()
    account.client.post(
        f"/api/events/{event['id']}/tasks",
        json={"title": "Cascade me", "category": "general"},
        headers=account.headers(),
    )
    assert account.client.delete(f"/api/events/{event['id']}", headers=account.headers()).status_code == 204

    from sqlalchemy import func, select

    from app.database.db import SessionLocal
    from app.database.models import Expense, Note, Plan, Task

    with SessionLocal() as session:
        assert session.execute(select(func.count(Task.id))).scalar() == 0
        assert session.execute(select(func.count(Expense.id))).scalar() == 0
        assert session.execute(select(func.count(Plan.id))).scalar() == 0
        assert session.execute(select(func.count(Note.id))).scalar() == 0


def test_plan_requires_authentication_on_owner_event(account: Account):
    event = account.create_event()
    assert account.client.get(f"/api/events/{event['id']}/plan").json() == {"plan": None}
    assert account.client.get(f"/api/events/{event['id']}/plan").status_code == 200


def test_search_cannot_be_used_to_escape_owner_scope(account: Account):
    account.create_event(name="Searchable One")
    result = account.client.get("/api/events", params={"q": "' OR 1=1 --"}).json()
    assert result["total"] == 0
