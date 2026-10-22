from __future__ import annotations

import json
import logging
from dataclasses import dataclass

import httpx

from app.core.config import get_settings

logger = logging.getLogger("eventora.ai")


class AIProviderError(RuntimeError):
    """Raised when the configured LLM provider fails or is misconfigured."""

    def __init__(self, message: str, *, retryable: bool = True):
        super().__init__(message)
        self.retryable = retryable


@dataclass
class LLMResponse:
    text: str
    model: str
    provider: str


class OpenAICompatibleProvider:
    """Minimal server-side client for OpenAI-compatible chat completions.

    - API key is read from server settings only and never logged or returned.
    - Hard timeout and output token ceiling prevent unbounded generations.
    - Provider errors are surfaced as generic messages.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.ai_base_url.rstrip("/")
        self.api_key = settings.ai_api_key
        self.model = settings.ai_model
        self.timeout = settings.ai_timeout_seconds
        self.max_tokens = settings.ai_max_output_tokens

    def complete(self, *, system: str, user: str, json_mode: bool = True) -> LLMResponse:
        if not self.api_key:
            raise AIProviderError("AI provider credentials are not configured.", retryable=False)
        payload: dict = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.35,
            "max_tokens": self.max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
                if response.status_code == 400 and json_mode:
                    # Some OpenAI-compatible servers reject response_format.
                    payload.pop("response_format", None)
                    response = client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise AIProviderError("The AI provider timed out.", retryable=True) from exc
        except httpx.HTTPError as exc:
            raise AIProviderError("The AI provider is unreachable.", retryable=True) from exc

        if response.status_code in {401, 403}:
            logger.warning("AI provider rejected credentials (status=%s)", response.status_code)
            raise AIProviderError("The AI provider rejected the configured credentials.", retryable=False)
        if response.status_code == 429:
            raise AIProviderError("The AI provider is rate limiting requests.", retryable=True)
        if response.status_code >= 400:
            logger.warning("AI provider error (status=%s)", response.status_code)
            raise AIProviderError("The AI provider returned an error.", retryable=True)

        try:
            body = response.json()
            content = body["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise AIProviderError("The AI provider returned an unexpected response shape.", retryable=True) from exc
        if not isinstance(content, str) or not content.strip():
            raise AIProviderError("The AI provider returned an empty response.", retryable=True)
        return LLMResponse(text=content, model=self.model, provider="openai-compatible")


def parse_json_object(text: str) -> dict:
    """Extract a JSON object from model output without executing anything."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model output")
    data = json.loads(cleaned[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("Model output was not a JSON object")
    return data


def get_provider() -> OpenAICompatibleProvider | None:
    settings = get_settings()
    if not settings.ai_configured:
        return None
    return OpenAICompatibleProvider()
