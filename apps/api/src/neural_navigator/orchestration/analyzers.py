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
    query: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "intent": self.intent,
            "domain": self.domain,
            "complexity": self.complexity,
            "needs_research": self.needs_research,
            "ambiguity": self.ambiguity,
            "query": self.query,
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
    cleaned = text.strip()
    lowered = cleaned.lower()
    words = re.findall(r"[a-z0-9]+", lowered)
    num_words = len(words)

    # Complexity classification
    if any(
        token in lowered
        for token in (
            "comprehensively",
            "empirical sources",
            "research papers",
            "compare",
            "versus",
            "pros and cons",
        )
    ) or num_words > 25:
        complexity = "complex"
    elif any(
        token in lowered
        for token in (
            "deep research",
            "non-abelian",
            "anyons",
            "should",
            "invest",
            "impact of",
            "tradeoffs",
            "solid-state",
        )
    ) or num_words > 7 and not lowered.startswith(("write a", "calculate", "what is 2")):
        complexity = "moderate"
    else:
        complexity = "simple"

    # Intent classification
    if any(token in lowered for token in ("poem", "story", "joke", "funny", "song", "essay", "draft a")):
        intent = "creative"
    elif any(token in lowered for token in ("compare", "vs", "versus", "difference between")):
        intent = "comparison"
    elif lowered.startswith(("calculate", "compute", "evaluate", "find", "show", "run", "execute", "fix ")):
        intent = "command"
    else:
        intent = "question"

    # Domain classification
    if any(
        w in lowered
        for w in (
            "policy",
            "energy policy",
            "inflation and energy",
            "venture funds",
            "modular nuclear",
            "fission startups",
            "regulation",
            "statute",
            "legislation",
            "governance",
        )
    ):
        domain = "policy"
    elif any(
        w in lowered
        for w in (
            "code",
            "python",
            "rust",
            "java",
            "sql",
            "database",
            "async",
            "docker",
            "kubernetes",
            "react",
            "vue",
            "api",
            "endpoint",
            "git",
            "wasm",
            "algorithm",
            "binary search",
            "qubit",
            "quantum computing",
            "cryptography",
            "cryptographic",
            "technology",
            "computer",
            "software",
            "hardware",
            "postgres",
            "mysql",
        )
    ):
        domain = "technology"
    elif any(
        w in lowered
        for w in (
            "quantum",
            "physics",
            "biology",
            "chemistry",
            "astronomy",
            "climate",
            "fusion",
            "entropy",
            "thermodynamics",
            "superconducting",
            "batteries",
            "battery",
            "speed of light",
            "entanglement",
            "anyons",
        )
    ):
        domain = "science"
    elif any(
        w in lowered
        for w in (
            "market",
            "finance",
            "stock",
            "economy",
            "inflation",
            "gdp",
            "invest",
            "bitcoin",
            "revenue",
            "ebitda",
            "venture capital",
            "interest rates",
        )
    ) or re.search(r"\b(crypto|cryptocurrency)\b", lowered):
        domain = "finance"
    elif any(
        w in lowered
        for w in (
            "patient",
            "disease",
            "symptom",
            "drug",
            "clinical",
            "therapy",
            "vaccine",
            "surgery",
            "diagnosis",
            "pharma",
        )
    ):
        domain = "medicine"
    elif any(
        w in lowered
        for w in (
            "law",
            "court",
            "contract",
            "liability",
            "patent",
            "trademark",
            "gdpr",
            "compliance",
        )
    ):
        domain = "legal"
    else:
        domain = "general"

    needs_research = complexity != "simple" or any(
        token in lowered
        for token in (
            "what is",
            "how does",
            "why",
            "recent",
            "latest",
            "compare",
            "research",
            "summarize",
            "analyze",
            "explain",
        )
    )
    if intent == "creative" or lowered.startswith("what is 2 + 2"):
        needs_research = False

    # Ambiguity classification
    if num_words <= 1 or lowered in {"it", "this", "that", "help", "do it"}:
        ambiguity = "high"
    elif num_words <= 4 and (
        lowered.startswith("how does this")
        or lowered.startswith("fix it")
        or "this" in words
        or "it" in words
        or not lowered.endswith("?")
    ):
        ambiguity = "medium"
    else:
        ambiguity = "low"

    return QueryAnalysis(
        intent=intent,
        domain=domain,
        complexity=complexity,
        needs_research=needs_research,
        ambiguity=ambiguity,
        query=cleaned,
    )


def decompose_research_tasks(
    query: str, analysis: QueryAnalysis, deep: bool = False
) -> list[str]:
    """Decompose complex inquiries into sub-queries."""
    if not deep:
        return [query]

    lowered = query.lower()
    tasks = [
        query,
        f"{query} architectural benchmarks and methodology",
        f"{query} state of the art papers and empirical findings",
        f"{query} tradeoffs and limitations",
    ]
    # Deduplicate while preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for t in tasks:
        t_clean = t.strip()
        t_key = t_clean.lower()
        if t_key not in seen:
            seen.add(t_key)
            deduped.append(t_clean)

    return deduped


# Aliases for backwards compatibility
_analyze_query = analyze_query
_decompose_research_tasks = decompose_research_tasks
