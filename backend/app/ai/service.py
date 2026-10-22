from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import ValidationError

from app.ai.fallback import fallback_chat, generate_fallback_plan
from app.ai.prompts import (
    CHAT_SYSTEM_PROMPT,
    PLAN_SYSTEM_PROMPT,
    neutralize_untrusted,
    untrusted_block,
)
from app.ai.provider import AIProviderError, get_provider, parse_json_object
from app.core.config import get_settings
from app.database.models import Event
from app.ml.service import engine as ml_engine
from app.schemas import EventPlanPayload

logger = logging.getLogger("eventora.ai")


def _context(event: Event) -> dict[str, Any]:
    return {
        "event_name": event.name,
        "event_type": event.event_type,
        "event_date": event.event_date.isoformat(),
        "city": event.city,
        "location_tier": event.location_tier,
        "guest_count": event.guest_count,
        "budget_cents": event.budget_cents,
        "currency": event.currency,
        "style": event.theme,
        "venue_type": event.venue_type,
        "catering_level": event.catering_level,
        "decor_level": event.decor_level,
        "photography": event.photography,
        "duration_hours": event.duration_hours,
        "accessibility": event.accessibility,
        "notes": event.notes,
        "predicted_cost_cents": event.predicted_cost_cents,
        "risk_level": event.risk_level,
    }


def _apply_budget_consistency(payload: dict[str, Any], budget_cents: int) -> dict[str, Any]:
    lines = payload.get("budget_breakdown") or []
    total = sum(int(line.get("amount_cents", 0)) for line in lines)
    warnings = list(payload.get("warnings") or [])
    if lines and budget_cents > 0:
        variance = (total - budget_cents) / budget_cents
        if abs(variance) > 0.05:
            warnings.append(
                f"Proposed budget lines total ${total / 100:,.0f}, which is {variance * 100:+.0f}% "
                f"versus the saved budget of ${budget_cents / 100:,.0f}. Reconcile before committing."
            )
    payload["warnings"] = warnings[:8]
    return payload


def _fallback(
    event: Event,
    recommendations: list[dict] | None,
    revision_notes: str,
    reason: str,
) -> tuple[dict[str, Any], str, str, list[str]]:
    payload = generate_fallback_plan(
        event,
        predicted_cost_cents=event.predicted_cost_cents,
        recommendations=recommendations,
        revision_notes=revision_notes,
    )
    payload.setdefault("warnings", [])
    payload["warnings"] = (payload["warnings"] + [reason])[:8]
    return payload, "fallback", "eventora-deterministic-v1", []


def generate_plan(
    event: Event,
    *,
    recommendations: list[dict] | None,
    focus: str = "",
    revision_notes: str = "",
) -> tuple[dict[str, Any], str, str, list[str]]:
    """Generate a validated plan.

    Returns (payload, engine, model, warnings). The AI provider is optional; any
    failure degrades to a labelled deterministic plan rather than an error page.
    """
    settings = get_settings()
    provider = get_provider()
    if provider is None:
        return _fallback(
            event,
            recommendations,
            revision_notes,
            "Generated with the deterministic fallback planner because no AI provider is configured.",
        )

    context = _context(event)
    user_prompt_parts = [
        untrusted_block("event", context),
        "Create a complete event plan for this event. Currency: USD.",
    ]
    if recommendations:
        rec_titles = [{"title": r["title"], "kind": r["kind"], "band": r["estimated_cost_band"]} for r in recommendations[:5]]
        user_prompt_parts.append(untrusted_block("catalogue_shortlist", rec_titles))
    if focus:
        user_prompt_parts.append(untrusted_block("focus", focus))
    if revision_notes:
        user_prompt_parts.append(untrusted_block("revision_request", revision_notes))
    user_prompt = "\n\n".join(user_prompt_parts)
    if len(user_prompt) > settings.ai_max_input_chars:
        user_prompt = user_prompt[: settings.ai_max_input_chars]

    warnings_out: list[str] = []
    for attempt in range(2):
        try:
            result = provider.complete(system=PLAN_SYSTEM_PROMPT, user=user_prompt, json_mode=True)
            raw = parse_json_object(result.text)
            payload = _apply_budget_consistency(raw, event.budget_cents)
            validated = EventPlanPayload.model_validate(payload)
            return validated.model_dump(), "ai", result.model, warnings_out
        except (json.JSONDecodeError, ValueError, ValidationError) as exc:
            logger.warning("AI plan validation failed (attempt=%s): %s", attempt + 1, type(exc).__name__)
            if attempt == 0:
                user_prompt += (
                    "\n\nYour previous response could not be validated. Return ONLY a JSON object that exactly "
                    "matches the required keys and value types."
                )
                continue
            return _fallback(
                event,
                recommendations,
                revision_notes,
                "The AI response could not be validated, so a deterministic plan was generated instead.",
            )
        except AIProviderError as exc:
            logger.warning("AI provider unavailable: %s", exc)
            return _fallback(
                event,
                recommendations,
                revision_notes,
                "The AI provider was unavailable, so a deterministic plan was generated instead.",
            )
    return _fallback(event, recommendations, revision_notes, "AI plan generation failed; deterministic fallback used.")


def chat(event: Event, message: str, history: list[dict[str, str]], plan_payload: dict | None) -> tuple[str, str, str, list[str]]:
    settings = get_settings()
    provider = get_provider()
    if provider is None:
        return (
            fallback_chat(event, message, plan_payload),
            "fallback",
            "eventora-deterministic-v1",
            ["Answered with the deterministic local assistant; no AI provider is configured."],
        )

    plan_excerpt = ""
    if plan_payload:
        plan_excerpt = json.dumps(
            {
                "event_summary": plan_payload.get("event_summary"),
                "theme": plan_payload.get("theme"),
                "budget_breakdown": plan_payload.get("budget_breakdown", [])[:5],
                "recommendations": plan_payload.get("recommendations", [])[:4],
                "preparation_timeline": plan_payload.get("preparation_timeline", [])[:3],
            },
            ensure_ascii=False,
        )[:4000]

    parts = [untrusted_block("event", _context(event))]
    if plan_excerpt:
        parts.append(untrusted_block("saved_plan_excerpt", plan_excerpt))
    if history:
        safe_history = [
            {"role": turn["role"], "content": neutralize_untrusted(turn["content"])[:1200]}
            for turn in history[-6:]
        ]
        parts.append(untrusted_block("recent_conversation", safe_history))
    parts.append(untrusted_block("user_message", message))
    parts.append("Reply in plain text under 220 words, grounded in this event and plan.")
    prompt = "\n\n".join(parts)
    if len(prompt) > settings.ai_max_input_chars:
        prompt = prompt[: settings.ai_max_input_chars]

    try:
        result = provider.complete(system=CHAT_SYSTEM_PROMPT, user=prompt, json_mode=False)
        reply = result.text.strip()[:4000]
        if not reply:
            raise AIProviderError("Empty reply")
        return reply, "ai", result.model, []
    except AIProviderError as exc:
        logger.warning("AI chat provider unavailable: %s", exc)
        return (
            fallback_chat(event, message, plan_payload),
            "fallback",
            "eventora-deterministic-v1",
            ["The AI provider was unavailable; this reply came from the deterministic local assistant."],
        )


def status() -> dict[str, Any]:
    settings = get_settings()
    return {
        "configured": settings.ai_configured,
        "provider": settings.ai_provider if settings.ai_configured else "none",
        "model": settings.ai_model if settings.ai_configured else None,
        "fallback_available": True,
        "fallback_engine": "eventora-deterministic-v1",
        "max_output_tokens": settings.ai_max_output_tokens,
        "timeout_seconds": settings.ai_timeout_seconds,
        "structured_output_schema": "event_plan.v1",
        "data_handling": (
            "Only event planning fields are sent to the provider. Chat transcripts are not persisted "
            "server-side. Prompts are not logged."
        ),
    }
