"""Unit tests for LangGraph state machine runtime and orchestration helpers."""

from typing import Any

import pytest

from neural_navigator.agents.runtime import execute_research_graph
from neural_navigator.core.config import Settings
from neural_navigator.domain.models.research import OrchestrationResult
from neural_navigator.orchestration.analyzers import (
    _decompose_research_tasks,
    _latest_user_text,
    analyze_query,
    decompose_research_tasks,
    latest_user_text,
)
from neural_navigator.orchestration.augmenters import (
    _build_augmented_messages,
    build_augmented_messages,
)
from neural_navigator.orchestration.citations import (
    parse_citation_markers,
    resolve_inline_citations,
)
from neural_navigator.orchestration.egi import compute_egi_score
from neural_navigator.orchestration.extractors import (
    _extract_domain_sources_and_evidence,
    extract_domain_sources_and_evidence,
)
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.orchestration.stages import OrchestrationStage
from neural_navigator.schemas.base import ChatMessage
from neural_navigator.services.llm import EchoProvider, LLMService
from neural_navigator.utils.constants import Role


def test_orchestration_helper_exports() -> None:
    # Verify all modular helper functions exist and are callable
    assert callable(analyze_query)
    assert callable(decompose_research_tasks)
    assert callable(_decompose_research_tasks)
    assert callable(latest_user_text)
    assert callable(_latest_user_text)
    assert callable(build_augmented_messages)
    assert callable(_build_augmented_messages)
    assert callable(extract_domain_sources_and_evidence)
    assert callable(_extract_domain_sources_and_evidence)
    assert callable(resolve_inline_citations)
    assert callable(compute_egi_score)
    assert callable(parse_citation_markers)


@pytest.mark.asyncio
async def test_execute_research_graph_fast_mode() -> None:
    settings = Settings(llm_provider="echo")
    llm = LLMService(provider=EchoProvider(), settings=settings)

    stages_emitted: list[OrchestrationStage] = []

    async def emit_stage(stage: OrchestrationStage, meta: dict[str, Any] | None) -> None:
        stages_emitted.append(stage)

    messages = [ChatMessage(role=Role.USER, content="Hello XplainAI")]

    chunks = []
    final_result: OrchestrationResult | None = None

    async for item in execute_research_graph(
        messages=messages,
        mode=RunMode.FAST,
        llm=llm,
        settings=settings,
        emit_stage=emit_stage,
    ):
        if isinstance(item, OrchestrationResult):
            final_result = item
        else:
            chunks.append(item.delta)

    assert final_result is not None
    assert final_result.mode is RunMode.FAST
    assert len(chunks) > 0
    assert OrchestrationStage.QUERY_ANALYZED in stages_emitted
    assert OrchestrationStage.GENERATION_COMPLETED in stages_emitted
    assert OrchestrationStage.COMPLETED in stages_emitted
    assert final_result.egi_score >= 0.0


@pytest.mark.asyncio
async def test_execute_research_graph_deep_mode() -> None:
    settings = Settings(llm_provider="echo")
    llm = LLMService(provider=EchoProvider(), settings=settings)

    stages_emitted: list[OrchestrationStage] = []

    async def emit_stage(stage: OrchestrationStage, meta: dict[str, Any] | None) -> None:
        stages_emitted.append(stage)

    messages = [
        ChatMessage(role=Role.USER, content="Evaluate 15 * 4 and analyze quantum error correction")
    ]

    final_result: OrchestrationResult | None = None
    async for item in execute_research_graph(
        messages=messages,
        mode=RunMode.DEEP_RESEARCH,
        llm=llm,
        settings=settings,
        emit_stage=emit_stage,
    ):
        if isinstance(item, OrchestrationResult):
            final_result = item

    assert final_result is not None
    assert final_result.mode is RunMode.DEEP_RESEARCH
    has_research = (
        OrchestrationStage.TOOL_STARTED in stages_emitted
        or OrchestrationStage.RESEARCH_STARTED in stages_emitted
    )
    assert has_research is True
    assert final_result.domain_graph is not None
    assert final_result.egi_score > 0.0
