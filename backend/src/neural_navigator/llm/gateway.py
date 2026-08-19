"""Provider-neutral Capability Model Gateway.

Allows domain services and agents to request models by semantic capability
(e.g., 'research', 'synthesis', 'fast', 'reasoning') rather than hardcoding vendor IDs.
Adapters handle vendor-specific request/response framing and streaming.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator, Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Protocol

import structlog

from neural_navigator.core.config import Settings
from neural_navigator.schemas.base import ChatMessage, Usage
from neural_navigator.services.llm import (
    EchoProvider,
    LLMChunk,
    LLMCompletion,
    LLMError,
    LLMProvider,
    OpenAICompatibleProvider,
)
from neural_navigator.utils.constants import FinishReason, LLMProviderName, Role

_logger = structlog.stdlib.get_logger(__name__)


class ModelCapability(StrEnum):
    FAST = "fast"
    BALANCED = "balanced"
    RESEARCH = "research"
    REASONING = "reasoning"
    SYNTHESIS = "synthesis"


@dataclass(frozen=True, slots=True)
class CapabilityProfile:
    capability: ModelCapability
    recommended_model: str
    temperature: float
    max_output_tokens: int
    system_instruction_style: str


CAPABILITY_PROFILES: dict[ModelCapability, CapabilityProfile] = {
    ModelCapability.FAST: CapabilityProfile(
        capability=ModelCapability.FAST,
        recommended_model="gpt-4o-mini",
        temperature=0.3,
        max_output_tokens=1024,
        system_instruction_style="concise_direct",
    ),
    ModelCapability.BALANCED: CapabilityProfile(
        capability=ModelCapability.BALANCED,
        recommended_model="gpt-4o-mini",
        temperature=0.6,
        max_output_tokens=2048,
        system_instruction_style="structured_evidence",
    ),
    ModelCapability.RESEARCH: CapabilityProfile(
        capability=ModelCapability.RESEARCH,
        recommended_model="gpt-4o-mini",
        temperature=0.4,
        max_output_tokens=4096,
        system_instruction_style="deep_academic_rigor",
    ),
    ModelCapability.REASONING: CapabilityProfile(
        capability=ModelCapability.REASONING,
        recommended_model="gpt-4o-mini",
        temperature=0.2,
        max_output_tokens=4096,
        system_instruction_style="stepwise_verification",
    ),
    ModelCapability.SYNTHESIS: CapabilityProfile(
        capability=ModelCapability.SYNTHESIS,
        recommended_model="gpt-4o-mini",
        temperature=0.5,
        max_output_tokens=3072,
        system_instruction_style="grounded_synthesis",
    ),
}


class ModelGateway:
    """Central gateway for capability-driven LLM requests."""

    def __init__(self, *, default_provider: LLMProvider, settings: Settings) -> None:
        self._default_provider = default_provider
        self._settings = settings
        self._providers: dict[str, LLMProvider] = {
            default_provider.name: default_provider,
        }

    def register_provider(self, name: str, provider: LLMProvider) -> None:
        self._providers[name] = provider
        _logger.info("model_gateway.provider_registered", provider=name)

    def get_provider(self, name: str | None = None) -> LLMProvider:
        if name and name in self._providers:
            return self._providers[name]
        return self._default_provider

    def resolve_model_for_capability(
        self, capability: ModelCapability | str, requested_model: str | None = None
    ) -> str:
        if requested_model:
            return requested_model
        cap_enum = ModelCapability(capability) if isinstance(capability, str) else capability
        profile = CAPABILITY_PROFILES.get(cap_enum, CAPABILITY_PROFILES[ModelCapability.BALANCED])
        return self._settings.default_chat_model or profile.recommended_model

    async def stream_capability(
        self,
        capability: ModelCapability | str,
        messages: Sequence[ChatMessage],
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_output_tokens: int | None = None,
        provider_name: str | None = None,
    ) -> AsyncGenerator[LLMChunk, None]:
        cap_enum = ModelCapability(capability) if isinstance(capability, str) else capability
        profile = CAPABILITY_PROFILES.get(cap_enum, CAPABILITY_PROFILES[ModelCapability.BALANCED])
        resolved_model = self.resolve_model_for_capability(cap_enum, requested_model=model)
        resolved_temp = temperature if temperature is not None else profile.temperature
        resolved_max = max_output_tokens or profile.max_output_tokens

        provider = self.get_provider(provider_name)
        _logger.info(
            "model_gateway.stream_capability",
            capability=cap_enum.value,
            model=resolved_model,
            provider=provider.name,
        )

        async for chunk in provider.stream_chat(
            messages,
            model=resolved_model,
            temperature=resolved_temp,
            max_output_tokens=resolved_max,
        ):
            yield chunk

    async def aclose(self) -> None:
        for provider in self._providers.values():
            await provider.aclose()