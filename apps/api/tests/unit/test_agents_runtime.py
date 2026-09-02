"""Unit tests for LangGraph state machine execution runtime (agents/runtime.py)."""

from typing import Any

import pytest

from neural_navigator.agents.runtime import execute_research_graph
from neural_navigator.core.config import Settings
from neural_navigator.domain.models.research import OrchestrationResult
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.orchestration.stages import OrchestrationStage
from neural_navigator.schemas.base import ChatMessage
from neural_navigator.services.llm import EchoProvider, LLMChunk, LLMService
from neural_navigator.utils.constants import Role


@pytest.mark.asyncio
async def test_execute_research_graph_modes_and_streaming() -> None:
    settings = Settings(llm_provider="echo")
    llm = LLMService(provider=EchoProvider(), settings=settings)

    # 1. Fast Mode
    stages_emitted: list[OrchestrationStage] = []

    async def emit_stage(stage: OrchestrationStage, meta: dict[str, Any] | None) -> None:
        stages_emitted.append(stage)

    messages = [ChatMessage(role=Role.USER, content="Explain quantum superposition")]

    tokens: list[str] = []
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
        elif isinstance(item, LLMChunk) and item.delta:
            tokens.append(item.delta)

    assert final_result is not None
    assert final_result.mode is RunMode.FAST
    assert len(tokens) > 0
    assert OrchestrationStage.QUERY_ANALYZED in stages_emitted
    assert OrchestrationStage.GENERATION_COMPLETED in stages_emitted
    assert OrchestrationStage.STRUCTURE_READY in stages_emitted
    assert OrchestrationStage.COMPLETED in stages_emitted
    assert final_result.egi_score >= 0.0

    # 2. Balanced Mode
    stages_emitted.clear()
    tokens.clear()
    final_result = None

    async for item in execute_research_graph(
        messages=[
            ChatMessage(
                role=Role.USER, content="Calculate 25 * 4 and analyze quantum error correction"
            )
        ],
        mode=RunMode.BALANCED,
        llm=llm,
        settings=settings,
        emit_stage=emit_stage,
    ):
        if isinstance(item, OrchestrationResult):
            final_result = item
        elif isinstance(item, LLMChunk) and item.delta:
            tokens.append(item.delta)

    assert final_result is not None
    assert final_result.mode is RunMode.BALANCED
    assert OrchestrationStage.RESEARCH_STARTED in stages_emitted
    assert len(final_result.tool_results) >= 1
    assert final_result.domain_graph is not None

    # 3. Complex Mode
    stages_emitted.clear()
    final_result = None

    async for item in execute_research_graph(
        messages=[
            ChatMessage(
                role=Role.USER, content="Comprehensive analysis of topological quantum computing"
            )
        ],
        mode=RunMode.COMPLEX,
        llm=llm,
        settings=settings,
        emit_stage=emit_stage,
    ):
        if isinstance(item, OrchestrationResult):
            final_result = item

    assert final_result is not None
    assert final_result.mode is RunMode.COMPLEX
    assert OrchestrationStage.ANALYSIS_COMPLETED in stages_emitted
