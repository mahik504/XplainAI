"""Unit tests for LangGraph research state machine and runtime."""

from typing import Any

import pytest

from neural_navigator.agents.graphs.research_graph import build_research_graph
from neural_navigator.agents.runtime import execute_research_graph
from neural_navigator.core.config import Settings
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.orchestration.pipeline import OrchestrationResult
from neural_navigator.orchestration.stages import OrchestrationStage
from neural_navigator.schemas.base import ChatMessage
from neural_navigator.services.llm import EchoProvider, LLMService
from neural_navigator.utils.constants import Role


def test_build_research_graph_structure() -> None:
    graph = build_research_graph()
    assert graph is not None
    # Check node presence in compiled graph
    assert "analyze" in graph.nodes
    assert "research" in graph.nodes
    assert "synthesize" in graph.nodes
    assert "claim" in graph.nodes
    assert "citation" in graph.nodes
    assert "critique" in graph.nodes
    assert "topology" in graph.nodes


@pytest.mark.asyncio
async def test_execute_research_graph_fast_mode() -> None:
    settings = Settings(llm_provider="echo")
    llm = LLMService(provider=EchoProvider(), settings=settings)

    stages_emitted: list[OrchestrationStage] = []

    async def emit_stage(stage: OrchestrationStage, meta: dict[str, Any] | None) -> None:
        stages_emitted.append(stage)

    messages = [ChatMessage(role=Role.USER, content="Explain quantum superposition")]

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
    assert OrchestrationStage.COMPLETED in stages_emitted
    assert final_result.egi_score >= 0.0


@pytest.mark.asyncio
async def test_execute_research_graph_deep_mode() -> None:
    settings = Settings(llm_provider="echo")
    llm = LLMService(provider=EchoProvider(), settings=settings)

    messages = [ChatMessage(role=Role.USER, content="Compare React vs Vue 40 + 2")]

    final_result: OrchestrationResult | None = None
    async for item in execute_research_graph(
        messages=messages,
        mode=RunMode.DEEP_RESEARCH,
        llm=llm,
        settings=settings,
    ):
        if isinstance(item, OrchestrationResult):
            final_result = item

    assert final_result is not None
    assert final_result.mode is RunMode.DEEP_RESEARCH
    assert len(final_result.research_tasks) >= 2
    assert final_result.domain_graph is not None
    assert len(final_result.domain_graph.nodes) > 0
