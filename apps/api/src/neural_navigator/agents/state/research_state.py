"""State schema definition for the LangGraph research runtime.

Models the end-to-end mutable context across query analysis, tool execution,
grounded synthesis, claim extraction, citation linking, and topology generation.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, TypedDict

from neural_navigator.schemas.base import (
    ChatMessage,
)


class ResearchState(TypedDict, total=False):
    """End-to-end state payload for the LangGraph research state machine."""

    # Inputs & Configuration
    messages: Sequence[ChatMessage] | list[dict[str, Any]]
    user_text: str
    mode: str
    model: str | None
    temperature: float | None
    max_output_tokens: int | None

    # Step 1: Query Analysis
    query_analysis: dict[str, Any]
    research_tasks: list[str]

    # Step 2: Tool Execution & Research
    tool_results: list[dict[str, Any]]
    sources: list[dict[str, Any]]
    evidence: list[dict[str, Any]]

    # Step 3: Synthesis
    answer_text: str

    # Step 4: Claim Extraction
    claims: list[dict[str, Any]]

    # Step 5: Citation Resolution
    citations: list[dict[str, Any]]

    # Step 6: Post-Analysis & Critique
    missing_context: list[dict[str, Any]]
    counter_perspective: str | None
    contradictions: list[dict[str, Any]]
    assumptions: list[dict[str, Any]]

    # Step 7: 3D Topology & EGI
    graph: dict[str, Any]
    egi_score: float
    trust_metrics: dict[str, Any]

    # Progress Telemetry
    current_stage: str
    stage_timings: list[dict[str, Any]]
