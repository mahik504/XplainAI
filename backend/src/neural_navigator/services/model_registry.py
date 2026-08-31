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
        description="Flagship multimodal intelligence & reasoning",
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
        id="o3-mini",
        label="o3-mini",
        description="STEM & competitive reasoning",
        tier="advanced",
        provider="openai",
    ),
    # Anthropic
    ChatModelInfo(
        id="claude-3-7-sonnet",
        label="Claude 3.7 Sonnet",
        description="Hybrid reasoning & dialectic synthesis",
        tier="advanced",
        provider="anthropic",
    ),
    ChatModelInfo(
        id="claude-3-5-sonnet",
        label="Claude 3.5 Sonnet",
        description="State-of-the-art research analysis",
        tier="advanced",
        provider="anthropic",
    ),
    ChatModelInfo(
        id="claude-3-5-haiku",
        label="Claude 3.5 Haiku",
        description="Ultra-fast responsive retrieval",
        tier="fast",
        provider="anthropic",
    ),
    # Google
    ChatModelInfo(
        id="gemini-2.0-flash",
        label="Gemini 2.0 Flash",
        description="High-throughput multimodal speed",
        tier="fast",
        provider="google",
    ),
    ChatModelInfo(
        id="gemini-1.5-pro",
        label="Gemini 1.5 Pro",
        description="Long-context research reasoning",
        tier="advanced",
        provider="google",
    ),
    # DeepSeek
    ChatModelInfo(
        id="deepseek-reasoner",
        label="DeepSeek R1",
        description="Open-weight mathematical reasoning",
        tier="advanced",
        provider="custom",
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
