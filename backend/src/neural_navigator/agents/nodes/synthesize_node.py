"""LLM synthesis and answer generation node for the LangGraph research state machine."""

from __future__ import annotations

from typing import Any

from neural_navigator.agents.state.research_state import (
    ResearchState,  # noqa: TC001 - Required for LangGraph node reflection
)
from neural_navigator.core.config import Settings
from neural_navigator.orchestration.analyzers import QueryAnalysis
from neural_navigator.orchestration.augmenters import build_augmented_messages
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.orchestration.tools import ToolResult
from neural_navigator.schemas.base import ChatMessage
from neural_navigator.services.llm import LLMService, build_llm_provider
from neural_navigator.utils.constants import Role


async def synthesize_node(
    state: ResearchState,
    *,
    llm: LLMService | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """Assemble augmented prompt and synthesize grounded answer text."""
    active_settings = settings or Settings()
    active_llm = llm or LLMService(
        provider=build_llm_provider(active_settings),
        settings=active_settings,
    )

    raw_messages = state.get("messages", [])
    chat_messages: list[ChatMessage] = []
    for msg in raw_messages:
        if isinstance(msg, ChatMessage):
            chat_messages.append(msg)
        elif isinstance(msg, dict):
            chat_messages.append(ChatMessage(**msg))

    if not chat_messages and state.get("user_text"):
        chat_messages = [ChatMessage(role=Role.USER, content=state["user_text"])]

    mode = RunMode.parse(state.get("mode"))
    qa_dict = state.get("query_analysis", {})
    analysis = QueryAnalysis(
        intent=qa_dict.get("intent", "explain"),
        domain=qa_dict.get("domain", "general"),
        complexity=qa_dict.get("complexity", "moderate"),
        needs_research=qa_dict.get("needs_research", True),
        ambiguity=qa_dict.get("ambiguity", "low"),
    )

    tool_results_data = state.get("tool_results", [])
    tool_results: list[ToolResult] = [
        ToolResult(
            tool=tr.get("tool", "unknown"),
            status=tr.get("status", "ok"),
            started_ms=tr.get("started_ms", 0.0),
            completed_ms=tr.get("completed_ms", 0.0),
            duration_ms=tr.get("duration_ms", 0.0),
            summary=tr.get("summary", ""),
            data=tr.get("data", {}),
        )
        for tr in tool_results_data
    ]

    augmented = build_augmented_messages(
        chat_messages,
        mode=mode,
        analysis=analysis,
        tool_results=tool_results,
    )

    max_output = state.get("max_output_tokens")
    if max_output is None:
        max_output = (
            min(active_settings.llm_max_output_tokens, 1024)
            if mode is RunMode.FAST
            else max(active_settings.llm_max_output_tokens, 2048)
        )

    temp = state.get("temperature")
    if temp is None:
        temp = 0.35 if mode is RunMode.FAST else active_settings.llm_temperature

    chunks: list[str] = []
    async for chunk in active_llm.stream_chat(
        augmented,
        model=state.get("model"),
        temperature=temp,
        max_output_tokens=max_output,
    ):
        if chunk.delta:
            chunks.append(chunk.delta)

    full_answer = "".join(chunks)

    return {
        "answer_text": full_answer,
        "current_stage": "generation_completed",
    }
