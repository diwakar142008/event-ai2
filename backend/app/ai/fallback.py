from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.database.models import Event
from app.ml.catalog import STYLE_LABELS

CATEGORY_BY_EVENT = {
    "wedding": "full-service wedding",
    "engagement": "engagement celebration",
    "birthday": "birthday celebration",
    "anniversary": "anniversary dinner",
    "college_festival": "college festival",
    "cultural_event": "cultural programme",
    "community_celebration": "community celebration",
    "corporate_event": "corporate gathering",
    "private_party": "private party",
}

# Planning envelope weights per event type. They sum to 1.0 and are applied to
# the user's budget, not presented as market rates.
BUDGET_WEIGHTS = {
    "wedding": {"Venue": 0.26, "Catering": 0.30, "Photography": 0.11, "Decor & florals": 0.12, "Music & entertainment": 0.07, "Attire & beauty": 0.05, "Stationery & favours": 0.03, "Contingency": 0.06},
    "engagement": {"Venue": 0.28, "Catering": 0.28, "Photography": 0.12, "Decor & florals": 0.13, "Music & entertainment": 0.07, "Contingency": 0.12},
    "birthday": {"Venue": 0.22, "Catering": 0.30, "Decor": 0.14, "Music & entertainment": 0.12, "Cake & desserts": 0.08, "Photography": 0.05, "Contingency": 0.09},
    "anniversary": {"Venue": 0.27, "Catering": 0.32, "Decor & florals": 0.13, "Music": 0.09, "Photography": 0.08, "Contingency": 0.11},
    "college_festival": {"Venue & permissions": 0.18, "Production & stage": 0.24, "Food stalls": 0.18, "Performers": 0.16, "Marketing & signage": 0.08, "Volunteer support": 0.06, "Contingency": 0.10},
    "cultural_event": {"Venue": 0.20, "Production & stage": 0.22, "Catering": 0.17, "Performers": 0.15, "Decor": 0.10, "Documentation": 0.06, "Contingency": 0.10},
    "community_celebration": {"Venue": 0.16, "Catering": 0.28, "Decor": 0.12, "Activities": 0.14, "Sound & lighting": 0.12, "Volunteer support": 0.06, "Contingency": 0.12},
    "corporate_event": {"Venue": 0.24, "Catering": 0.26, "Production & AV": 0.16, "Speaker & hosting": 0.10, "Branding & print": 0.08, "Photography": 0.05, "Contingency": 0.11},
    "private_party": {"Venue": 0.23, "Catering & bar": 0.32, "Music": 0.12, "Decor": 0.12, "Photography": 0.05, "Contingency": 0.16},
}

SCHEDULE_BY_EVENT = {
    "wedding": [
        ("09:00", "Hair, makeup and getting-ready portraits", "Attire lead"),
        ("11:30", "Vendor load-in and final venue walkthrough", "Coordinator"),
        ("13:00", "Guest arrival and welcome drinks", "Host team"),
        ("14:00", "Ceremony", "Officiant"),
        ("15:00", "Group portraits and canapés", "Photographer"),
        ("17:00", "Dinner service", "Catering lead"),
        ("18:30", "Speeches", "Host"),
        ("19:30", "First dance and live set", "Band"),
        ("21:00", "Late-night bites and DJ", "Catering / DJ"),
        ("23:00", "Guest send-off and vendor load-out", "Coordinator"),
    ],
    "corporate_event": [
        ("08:00", "Venue access, AV check and registration build", "Production lead"),
        ("09:00", "Guest registration and coffee", "Front of house"),
        ("09:30", "Opening remarks", "Host"),
        ("10:00", "Keynote and panel", "Programme lead"),
        ("12:00", "Lunch service", "Catering lead"),
        ("13:30", "Breakouts and workshops", "Facilitators"),
        ("15:30", "Closing session and Q&A", "Host"),
        ("16:30", "Networking reception", "Front of house"),
        ("18:00", "Load-out and asset reconciliation", "Production lead"),
    ],
    "college_festival": [
        ("08:00", "Stage, sound and stall build", "Production crew"),
        ("10:00", "Gates open and registration", "Volunteer lead"),
        ("11:00", "Opening act and welcome", "Stage manager"),
        ("13:00", "Food stall peak and open-mic", "Volunteer lead"),
        ("15:00", "Headline performance", "Stage manager"),
        ("17:00", "Cultural showcase", "Programme lead"),
        ("19:00", "Closing set and prize announcements", "Host"),
        ("21:00", "Site clear-down", "Operations lead"),
    ],
    "default": [
        ("10:00", "Final setup and supplier handoff", "Coordinator"),
        ("11:00", "Sound check and lighting focus", "Production"),
        ("12:00", "Catering setup and allergen check", "Catering lead"),
        ("15:00", "Vendor readiness walkthrough", "Coordinator"),
        ("16:00", "Guest arrival and welcome", "Host"),
        ("17:00", "Main programme and entertainment", "Host"),
        ("19:00", "Food service", "Catering lead"),
        ("21:00", "Closing remarks and send-off", "Host"),
        ("22:00", "Load-out", "Coordinator"),
    ],
}


def _money(cents: int) -> str:
    return f"${cents / 100:,.0f}"


def budget_breakdown(event: Event) -> list[dict[str, Any]]:
    weights = BUDGET_WEIGHTS.get(event.event_type, BUDGET_WEIGHTS["private_party"])
    lines: list[dict[str, Any]] = []
    allocated = 0
    items = list(weights.items())
    for index, (category, weight) in enumerate(items):
        if index == len(items) - 1:
            amount = event.budget_cents - allocated
        else:
            amount = int(round(event.budget_cents * weight))
            allocated += amount
        lines.append(
            {
                "category": category,
                "amount_cents": max(0, amount),
                "note": f"{weight * 100:.0f}% planning envelope",
            }
        )
    return lines


def generate_fallback_plan(
    event: Event,
    *,
    predicted_cost_cents: int | None,
    recommendations: list[dict] | None = None,
    revision_notes: str = "",
) -> dict[str, Any]:
    style = STYLE_LABELS.get(event.theme, event.theme.replace("_", " "))
    budget = event.budget_cents
    breakdown = budget_breakdown(event)
    date_label = event.event_date.strftime("%d %B %Y")
    recommendation_titles = [r["title"] for r in (recommendations or [])][:4]

    summary = (
        f"A {CATEGORY_BY_EVENT.get(event.event_type, event.event_type.replace('_', ' '))} for "
        f"{event.guest_count:,} guests in {event.city}, planned around a {style.lower()} direction. "
        f"The working budget is {_money(budget)} and the plan below sequences confirmed priorities first: "
        f"venue, food, and the moments guests remember."
    )
    if predicted_cost_cents:
        summary += (
            f" The ML planning estimate for this scope is {_money(predicted_cost_cents)}, "
            f"which is a modelled planning range rather than a quote."
        )

    recommendations_list = [
        f"Anchor the room in the {style.lower()} direction: one strong focal installation and restrained table styling.",
        "Ask for written quotes with service charges, overtime, and tax separated so comparison is honest.",
        f"Set a guest-list ceiling of {event.guest_count:,} and treat any addition as a budget decision.",
        "Book the venue before suppliers; the date and access rules constrain everything else.",
    ]
    if recommendation_titles:
        recommendations_list.insert(1, "Catalogue concepts worth exploring: " + "; ".join(recommendation_titles) + ".")
    if event.accessibility:
        recommendations_list.append(f"Confirm accessibility requirements in writing: {event.accessibility}.")
    if event.photography != "none":
        recommendations_list.append("Agree a photo shot list and a backup indoor location for weather or light changes.")

    event_date = event.event_date
    if event_date.tzinfo is None:
        event_date = event_date.replace(tzinfo=UTC)
    days_out = (event_date - datetime.now(UTC)).days
    weeks = max(4, min(52, int(days_out / 7)))
    timeline = [
        {"phase": "Lock the brief", "timing": f"{weeks} weeks out", "actions": ["Confirm budget ceiling and guest ceiling", "Agree decision-makers and approvals"]},
        {"phase": "Venue and core suppliers", "timing": f"{max(weeks - 2, 8)} weeks out", "actions": ["Shortlist three venues", "Request itemised quotes", "Check accessibility and load-in rules"]},
        {"phase": "Creative direction", "timing": f"{max(weeks - 5, 6)} weeks out", "actions": [f"Approve the {style.lower()} palette and typography", "Finalise floor plan and focal installation"]},
        {"phase": "Food and service", "timing": f"{max(weeks - 7, 4)} weeks out", "actions": ["Tasting and menu lock", "Collect dietary and allergen requirements"]},
        {"phase": "Confirm and rehearse", "timing": "2 weeks out", "actions": ["Issue run sheet to every supplier", "Confirm arrival times and contacts", "Test sound and lighting cues"]},
        {"phase": "Final week", "timing": "7 days out", "actions": ["Confirm headcounts in writing", "Prepare supplier payments and tips", "Pack the day-of kit"]},
    ]

    schedule = [
        {"time": time, "activity": activity, "owner": owner}
        for time, activity, owner in SCHEDULE_BY_EVENT.get(event.event_type, SCHEDULE_BY_EVENT["default"])
    ]

    checklist = [
        {"item": "Signed venue contract with access and cancellation terms", "category": "venue", "priority": "must"},
        {"item": "Catering quote including staff, service charge and dietary handling", "category": "catering", "priority": "must"},
        {"item": "Certificate of insurance and vendor load-in passes", "category": "operations", "priority": "must"},
        {"item": "Deposit schedule with final payment dates", "category": "budget", "priority": "must"},
        {"item": "Run sheet shared with every supplier", "category": "operations", "priority": "should"},
        {"item": "Accessibility, parking and transport notes sent to guests", "category": "guest experience", "priority": "should"},
        {"item": "Backup plan for weather, power and late arrivals", "category": "risk", "priority": "should"},
        {"item": "Photo and video shot list agreed", "category": "content", "priority": "nice"},
        {"item": "Tip and gratuity envelopes prepared", "category": "budget", "priority": "nice"},
    ]

    savings = [
        "Move the event to a shoulder-season weekday; venue and supplier rates are usually more negotiable.",
        "Reduce the guest list by 10% — catering, rentals, and favours scale directly with headcount.",
        "Use statement florals at the entrance and ceremony only, then repurpose them at dinner.",
        "Choose family-style or grazing service over plated courses to lower staffing requirements.",
        "Cap the bar to a signature serve plus wine and beer rather than a full open bar.",
    ]

    assumptions = [
        "Figures are planning allocations in USD, not vendor quotes.",
        "Venue, catering, and production availability has not been checked.",
        "Prices exclude travel, permits, and taxes unless a supplier states otherwise.",
        f"Guest count is held at {event.guest_count:,} for all calculations.",
    ]
    warnings: list[str] = []
    if predicted_cost_cents and predicted_cost_cents > budget:
        warnings.append(
            f"The ML estimate ({_money(predicted_cost_cents)}) exceeds the budget ({_money(budget)}); "
            "reduce scope or raise the ceiling before signing contracts."
        )
    if event.budget_cents / max(event.guest_count, 1) < 5000:
        warnings.append("The per-guest envelope is tight for full-service catering; expect trade-offs.")
    if revision_notes:
        assumptions.append("Revision request applied as planning guidance only; no supplier has been contacted.")

    return {
        "event_summary": summary,
        "theme": f"{style} — refined celebration with a clear focal moment",
        "budget_breakdown": breakdown,
        "recommendations": recommendations_list,
        "preparation_timeline": timeline,
        "event_day_schedule": schedule,
        "vendor_checklist": checklist,
        "cost_saving_suggestions": savings,
        "assumptions": assumptions,
        "warnings": warnings,
    }


def fallback_chat(event: Event, question: str, plan: dict | None) -> str:
    q = question.lower()
    date_label = event.event_date.strftime("%d %B %Y")
    budget = _money(event.budget_cents)
    per_guest = _money(int(event.budget_cents / max(event.guest_count, 1)))

    if any(word in q for word in ("budget", "cost", "spend", "cheap", "save", "expensive")):
        savings = (plan or {}).get("cost_saving_suggestions") or [
            "Trim the guest list first; it drives catering and rentals.",
            "Shift to a weekday or shoulder season for venue flexibility.",
        ]
        return (
            f"Your working budget is {budget} for {event.guest_count:,} guests, about {per_guest} per guest. "
            "The three largest lines are usually venue, catering, and production. "
            "Ways to protect the ceiling:\n- " + "\n- ".join(savings[:4]) +
            "\n\nThese are planning suggestions; ask suppliers for itemised quotes before committing."
        )
    if any(word in q for word in ("timeline", "when", "schedule", "weeks", "plan ahead")):
        phases = (plan or {}).get("preparation_timeline") or []
        if phases:
            lines = [f"{p['phase']} ({p['timing']}): {', '.join(p['actions'][:2])}" for p in phases[:5]]
            return "Working backwards from " + date_label + ":\n- " + "\n- ".join(lines)
        return f"Work backwards from {date_label}: lock venue and budget first, then catering, then creative details, with a full supplier run sheet two weeks out."
    if any(word in q for word in ("vendor", "supplier", "book", "availab")):
        return (
            "I can't check availability or make bookings, so treat this as a process checklist: "
            "shortlist three suppliers per category, request itemised written quotes, confirm insurance and "
            "load-in rules, and put deposits on a schedule. The workspace vendor checklist tracks the items "
            "you still need to confirm directly."
        )
    if any(word in q for word in ("theme", "decor", "design", "style", "colour", "color")):
        style = STYLE_LABELS.get(event.theme, event.theme)
        return (
            f"Your direction is {style}. Keep it coherent by choosing one focal installation, one repeated "
            "material (linen, candle, or seasonal stem), and one accent colour. Spend where guests gather and "
            "keep secondary areas quiet. The Recommendations page has catalogue concepts ranked for this event."
        )
    if any(word in q for word in ("guest", "accessib", "dietary", "parking")):
        return (
            f"With {event.guest_count:,} guests, confirm accessibility, dietary, and transport needs early and in writing. "
            "Collect requirements with the RSVP, then send a consolidated brief to catering and the venue. "
            "Keep a small buffer above the final headcount."
        )
    summary = (plan or {}).get("event_summary")
    base = summary or f"This is a {CATEGORY_BY_EVENT.get(event.event_type, event.event_type)} on {date_label} in {event.city}, with a {budget} budget."
    return (
        base + "\n\nI can help with budget trade-offs, preparation sequencing, creative direction, or the vendor checklist. "
        "Ask about any of those and I'll use this event's saved details."
    )
