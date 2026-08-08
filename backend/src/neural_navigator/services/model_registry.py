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

    def as_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "label": self.label,
            "description": self.description,
            "tier": self.tier,
        }


# Curated OpenAI models supported by this deployment. Env DEFAULT_CHAT_MODEL
# must resolve to one of these (or be appended as a fallback entry).
_REGISTRY: tuple[ChatModelInfo, ...] = (
    ChatModelInfo(
        id="gpt-4.1-mini",
        label="GPT-4.1 mini",
        description="Fast / efficient",
        tier="fast",
    ),
    ChatModelInfo(
        id="gpt-4.1",
        label="GPT-4.1",
        description="Advanced reasoning",
        tier="advanced",
    ),
    ChatModelInfo(
        id="gpt-4o-mini",
        label="GPT-4o mini",
        description="Fast / lightweight",
        tier="fast",
    ),
    ChatModelInfo(
        id="gpt-4o",
        label="GPT-4o",
        description="General multimodal-capable model",
        tier="general",
    ),
)


def list_chat_models(*, default_model: str) -> list[dict[str, Any]]:
    models = list(_REGISTRY)
    if default_model and default_model not in {item.id for item in models}:
        models.append(
            ChatModelInfo(
                id=default_model,
                label=default_model,
                description="Configured default",
                tier="general",
            )
        )
    return [item.as_dict() for item in models]


def is_allowed_model(model_id: str | None, *, default_model: str) -> bool:
    if model_id is None or not model_id.strip():
        return True
    allowed = {item.id for item in _REGISTRY}
    allowed.add(default_model)
    return model_id.strip() in allowed


def resolve_allowed_model(requested: str | None, *, default_model: str) -> str:
    if requested and is_allowed_model(requested, default_model=default_model):
        return requested.strip()
    return default_model
