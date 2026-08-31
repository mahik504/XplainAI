"""Prompt augmentation and context synthesis for grounded LLM inference.

Constructs structured grounding prompts, observable tool blocks, and citation
contracts ensuring generation is strictly anchored to retrieved evidence.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from neural_navigator.schemas.base import ChatMessage
from neural_navigator.utils.constants import Role

if TYPE_CHECKING:
    from collections.abc import Sequence

    from neural_navigator.orchestration.analyzers import QueryAnalysis
    from neural_navigator.orchestration.modes import RunMode
    from neural_navigator.orchestration.tools import ToolResult


def format_tool_results_block(tool_results: Sequence[ToolResult]) -> list[str]:
    """Format tool and research outputs into clear, citation-indexable prompt lines."""
    usable = [item for item in tool_results if item.status == "ok"]
    if not usable:
        return ["No external sources were retrieved for this turn."]

    blocks: list[str] = ["Observable tool / research results:"]
    source_idx = 1
    for item in usable:
        blocks.append(f"- [{item.tool}] {item.summary}")
        results = item.data.get("results")
        if isinstance(results, list):
            for row in results[:5]:
                if not isinstance(row, dict):
                    continue
                title = str(row.get("title") or "Source")
                url = str(row.get("url") or "")
                snippet = str(row.get("snippet") or "")
                url_suffix = f" ({url})" if url else ""
                blocks.append(f"  [{source_idx}] {title}: {snippet[:260]}{url_suffix}")
                source_idx += 1

        # Also handle direct sources from url_ingest
        sources = item.data.get("sources")
        if isinstance(sources, list):
            for s_dict in sources:
                if isinstance(s_dict, dict):
                    title = str(s_dict.get("title") or "Web Source")
                    url = str(s_dict.get("url") or "")
                    snippet = str(s_dict.get("snippet") or "")
                    url_suffix = f" ({url})" if url else ""
                    blocks.append(f"  [{source_idx}] {title}: {snippet[:260]}{url_suffix}")
                    source_idx += 1

    return blocks


def build_augmented_messages(
    messages: Sequence[ChatMessage],
    *,
    mode: RunMode,
    analysis: QueryAnalysis,
    tool_results: Sequence[ToolResult],
    citation_instruction: str | None = None,
) -> list[ChatMessage]:
    """Assemble the system prompt with grounding constraints, mode info, and tool evidence."""
    default_citation_instruction = (
        "When making claims supported by sources, cite them clearly using "
        "bracketed numbers like [1] or [2]."
    )
    blocks: list[str] = [
        (
            "You are XplainAI — an explainable AI research workspace. "
            "Prefer clear, authoritative structure."
        ),
        "Ground your answer in the provided observable tool and research sources where available.",
        citation_instruction or default_citation_instruction,
        f"Active mode: {mode.label} ({mode.description}).",
        (
            f"Query analysis: intent={analysis.intent}, domain={analysis.domain}, "
            f"complexity={analysis.complexity}."
        ),
    ]

    blocks.extend(format_tool_results_block(tool_results))

    system = ChatMessage(role=Role.SYSTEM, content="\n".join(blocks))
    history = [message for message in messages if message.role is not Role.SYSTEM]
    return [system, *history]


# Alias for backwards compatibility
_build_augmented_messages = build_augmented_messages
