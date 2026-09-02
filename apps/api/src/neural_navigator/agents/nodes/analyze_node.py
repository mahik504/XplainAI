"""Query analysis node for the LangGraph research state machine."""

from __future__ import annotations

from typing import Any

from neural_navigator.agents.state.research_state import (
    ResearchState,
)
from neural_navigator.orchestration.analyzers import (
    analyze_query,
    decompose_research_tasks,
    latest_user_text,
)
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.schemas.base import ChatMessage


async def analyze_query_node(state: ResearchState) -> dict[str, Any]:
    """Classify the user inquiry and decompose it into sub-tasks when research is required."""
    raw_messages = state.get("messages", [])
    chat_messages: list[ChatMessage] = []
    for msg in raw_messages:
        if isinstance(msg, ChatMessage):
            chat_messages.append(msg)
        elif isinstance(msg, dict):
            chat_messages.append(ChatMessage(**msg))

    user_text = state.get("user_text") or latest_user_text(chat_messages)
    analysis = analyze_query(user_text)
    mode_str = state.get("mode", "deep_research")
    mode = RunMode.parse(mode_str)

    research_tasks: list[str] = []
    if mode is RunMode.DEEP_RESEARCH:
        research_tasks = decompose_research_tasks(
            user_text,
            analysis,
            deep=True,
        )

    return {
        "user_text": user_text,
        "query_analysis": analysis.as_dict(),
        "research_tasks": research_tasks,
        "current_stage": "query_analyzed",
    }
