"""Semantic query analysis and task decomposition for XplainAI orchestration.

Classifies incoming user inquiries by intent, domain, complexity, and research need,
and decomposes complex questions into targeted multi-perspective research tasks.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from neural_navigator.utils.constants import Role

if TYPE_CHECKING:
    from collections.abc import Sequence

    from neural_navigator.schemas.base import ChatMessage


@dataclass(slots=True)
class QueryAnalysis:
    """Semantic breakdown of a user query."""

    intent: str
    domain: str
    complexity: str  # simple | moderate | complex
    needs_research: bool
    ambiguity: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "intent": self.intent,
            "domain": self.domain,
            "complexity": self.complexity,
            "needs_research": self.needs_research,
            "ambiguity": self.ambiguity,
        }


def latest_user_text(messages: Sequence[ChatMessage]) -> str:
    """Extract the text content of the latest user turn."""
    for message in reversed(messages):
        if message.role is Role.USER:
            return message.content.strip()
    return ""


# Alias for backwards compatibility
_latest_user_text = latest_user_text


def analyze_query(text: str) -> QueryAnalysis:
    """Analyze query intent, domain classification, complexity, ambiguity, and research need."""
    lowered = text.lower()
    words = re.findall(r"[a-z0-9]+", lowered)
    complexity = "simple"
    if len(words) > 28 or any(
        token in lowered
        for token in ("compare", "vs", "versus", "should", "invest", "pros and cons")
    ):
        complexity = "moderate"
    if any(
        token in lowered
        for token in (
            "research",
            "evidence",
            "sources",
            "cite",
            "deep",
            "analyze comprehensively",
        )
    ):
        complexity = "complex"

    domain = "general"
    if any(
        token in lowered
        for token in (
            "react",
            "vue",
            "python",
            "sql",
            "bitcoin",
            "postgres",
            "api",
            "code",
        )
    ):
        domain = "technology"
    elif any(
        token in lowered for token in ("inflation", "nuclear", "energy", "economy", "finance")
    ):
        domain = "policy"
    elif any(token in lowered for token in ("quantum", "physics", "sky", "science")):
        domain = "science"

    intent = "explain"
    if "?" in text or lowered.startswith(("why", "how", "what", "should", "compare")):
        intent = "question"
    if any(token in lowered for token in ("joke", "poem", "story")):
        intent = "creative"
        complexity = "simple"

    needs_research = complexity != "simple" or any(
        token in lowered for token in ("latest", "current", "today", "news", "should", "invest")
    )

    ambiguity = "low"
    if len(words) < 3 and intent != "creative":
        ambiguity = "high"
    elif any(token in lowered for token in ("this", "that", "it", "they")) and len(words) < 8:
        ambiguity = "medium"

    return QueryAnalysis(
        intent=intent,
        domain=domain,
        complexity=complexity,
        needs_research=needs_research,
        ambiguity=ambiguity,
    )


def decompose_research_tasks(
    text: str,
    analysis: QueryAnalysis,
    *,
    deep: bool,
) -> list[str]:
    """Break a research query into targeted sub-queries for multi-source execution."""
    base = text.strip()
    tasks = [base]
    if deep:
        tasks.append(f"{base} empirical methodology findings")
        tasks.append(f"{base} leading research papers benchmarks")
        tasks.append(f"{base} limitations contradictions criticisms")
        if analysis.domain != "general":
            tasks.append(f"{base} state of the art {analysis.domain}")
    elif analysis.domain != "general":
        tasks.append(f"{base} key facts {analysis.domain}")

    # Deduplicate while preserving order
    seen: set[str] = set()
    ordered: list[str] = []
    for task in tasks:
        key = task.lower()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(task)
    return ordered[: 5 if deep else 2]


# Alias for backwards compatibility
_decompose_research_tasks = decompose_research_tasks
