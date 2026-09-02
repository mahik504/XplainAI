"""LangGraph edge definitions and conditional routers."""

from neural_navigator.agents.edges.conditional import (
    is_deep_research,
    should_critique,
    should_research,
)

__all__ = [
    "is_deep_research",
    "should_critique",
    "should_research",
]
