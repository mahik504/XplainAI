"""Unit tests for prompt augmentation and grounding synthesis."""

from neural_navigator.orchestration.analyzers import QueryAnalysis
from neural_navigator.orchestration.augmenters import (
    build_augmented_messages,
    format_tool_results_block,
)
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.orchestration.tools import ToolResult
from neural_navigator.schemas.base import ChatMessage
from neural_navigator.utils.constants import Role


def test_format_tool_results_block_empty() -> None:
    blocks = format_tool_results_block([])
    assert "No external sources were retrieved" in blocks[0]


def test_format_tool_results_block_with_results() -> None:
    tool_res = ToolResult(
        tool="web_search",
        status="ok",
        started_ms=0.0,
        completed_ms=10.0,
        duration_ms=10.0,
        summary="Search query: quantum",
        data={
            "results": [
                {
                    "title": "Quantum Computing",
                    "url": "https://en.wikipedia.org/wiki/Quantum_computing",
                    "snippet": "Quantum computing is a rapidly-emerging technology.",
                }
            ]
        },
    )
    blocks = format_tool_results_block([tool_res])
    assert any("[1] Quantum Computing" in line for line in blocks)
    assert any("wikipedia.org" in line for line in blocks)


def test_build_augmented_messages() -> None:
    analysis = QueryAnalysis(
        intent="question",
        domain="technology",
        complexity="moderate",
        needs_research=True,
        ambiguity="low",
    )
    messages = [ChatMessage(role=Role.USER, content="How do quantum computers work?")]
    augmented = build_augmented_messages(
        messages,
        mode=RunMode.DEEP_RESEARCH,
        analysis=analysis,
        tool_results=[],
    )

    assert len(augmented) == 2
    assert augmented[0].role is Role.SYSTEM
    assert "Active mode: Deep Research" in augmented[0].content
    assert "intent=question" in augmented[0].content
    assert augmented[1].content == "How do quantum computers work?"
