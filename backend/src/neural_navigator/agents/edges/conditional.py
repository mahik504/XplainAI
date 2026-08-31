"""Conditional routing logic and dynamic edge evaluators for LangGraph state machine."""

from __future__ import annotations

from typing import Literal

from neural_navigator.agents.state.research_state import (
    ResearchState,  # noqa: TC001 - Required for LangGraph branch type inspection
)
from neural_navigator.orchestration.modes import RunMode


def should_research(state: ResearchState) -> Literal["research", "synthesize"]:
    """Determine whether the query requires external research or should proceed to synthesis."""
    mode = RunMode.parse(state.get("mode"))
    if mode is RunMode.FAST:
        return "synthesize"
    return "research"


def should_critique(state: ResearchState) -> Literal["critique", "topology"]:
    """Determine whether to run post-answer critique or jump straight to topology generation."""
    mode = RunMode.parse(state.get("mode"))
    if mode is RunMode.FAST:
        return "topology"
    return "critique"


def is_deep_research(state: ResearchState) -> bool:
    """Check if the current run is configured for deep research."""
    return RunMode.parse(state.get("mode")) is RunMode.DEEP_RESEARCH
