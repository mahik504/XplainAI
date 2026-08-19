"""Allowlisted chat models exposed to the UI and validated on chat.send."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class ChatModelInfo:
    id: str
    label: str
    description: str
    tier: str  # fast | advanced | general
    provider: str = "openai"  # openai | anthropic | google | custom

    def as_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "label": self.label,
            "description": self.description,
            "tier": self.tier,
            "provider": self.provider,
        }


# Curated models supported across OpenAI, Anthropic, Google, and Custom providers.
_REGISTRY: tuple[ChatModelInfo, ...] = (
    # OpenAI
    ChatModelInfo(
        id="gpt-4o",
        label="GPT-4o",
        description="Flagship multimodal intelligence",
        tier="general",
        provider="openai",
    ),
    ChatModelInfo(
        id="gpt-4o-mini",
        label="GPT-4o mini",
        description="Fast & lightweight reasoning",
        tier="fast",
        provider="openai",
    ),
    ChatModelInfo(
        id="gpt-4.1-mini",
        label="GPT-4.1 mini",
        description="Fast synthesis & search",
        tier="fast",
        provider="openai",
    ),
    ChatModelInfo(
        id="gpt-4.1",
        label="GPT-4.1",
        description="Deep academic reasoning",
        tier="advanced",
        provider="openai",
    ),
    # Anthropic
    ChatModelInfo(
        id="claude-3-7-sonnet",
        label="Claude 3.7 Sonnet",
        description="Hybrid reasoning & code synthesis",
        tier="advanced",
        provider="anthropic",
    ),
    ChatModelInfo(
        id="claude-3-5-haiku",
        label="Claude 3.5 Haiku",
        description="Ultra-fast responsive research",
        tier="fast",
        provider="anthropic",
    ),
    # Google
    ChatModelInfo(
        id="gemini-2.5-pro",
        label="Gemini 2.5 Pro",
        description="Deep multimodal reasoning & math",
        tier="advanced",
        provider="google",
    ),
    ChatModelInfo(
        id="gemini-2.5-flash",
        label="Gemini 2.5 Flash",
        description="High-throughput frontier speed",
        tier="fast",
        provider="google",
    ),
)


def list_chat_models(*, default_model: str) -> list[dict[str, Any]]:
    models = list(_REGISTRY)
    known_ids = {item.id for item in models}
    if default_model and default_model not in known_ids:
        models.append(
            ChatModelInfo(
                id=default_model,
                label=default_model,
                description="Configured deployment default",
                tier="general",
                provider="custom",
            )
        )
    return [item.as_dict() for item in models]


def is_allowed_model(model_id: str | None, *, default_model: str) -> bool:
    if model_id is None or not model_id.strip():
        return True
    cleaned = model_id.strip()
    if cleaned.startswith("custom:") or cleaned.startswith("local:"):
        return True
    allowed = {item.id for item in _REGISTRY}
    allowed.add(default_model)
    return cleaned in allowed


def resolve_allowed_model(requested: str | None, *, default_model: str) -> str:
    if requested and is_allowed_model(requested, default_model=default_model):
        return requested.strip()
    return default_model

