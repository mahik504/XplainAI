"""Post-answer observable analyses (not chain-of-thought).

Missing-context and counter-perspective are heuristic / structured projections
over the user question + finished assistant text.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class MissingContextItem:
    item: str
    importance: str  # high | medium | low
    why_it_matters: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "item": self.item,
            "importance": self.importance,
            "why_it_matters": self.why_it_matters,
        }


_DECISION_HINTS = re.compile(
    r"\b(should i|should we|which|recommend|invest|buy|choose|best|worth)\b",
    re.I,
)
_CREATIVE_HINTS = re.compile(r"\b(joke|poem|story|haiku|riddle)\b", re.I)

_CONTEXT_RULES: list[tuple[re.Pattern[str], list[MissingContextItem]]] = [
    (
        re.compile(r"\b(invest|stock|portfolio|crypto|bitcoin)\b", re.I),
        [
            MissingContextItem(
                "Investment horizon",
                "high",
                "Time horizon changes whether volatility is acceptable.",
            ),
            MissingContextItem(
                "Risk tolerance",
                "high",
                "Risk appetite materially changes the recommendation.",
            ),
            MissingContextItem(
                "Current allocation",
                "medium",
                "Existing exposure affects whether adding more is appropriate.",
            ),
        ],
    ),
    (
        re.compile(r"\b(laptop|phone|buy|purchase|which .* should)\b", re.I),
        [
            MissingContextItem(
                "Budget",
                "high",
                "Budget bounds which options are realistic.",
            ),
            MissingContextItem(
                "Primary workload",
                "high",
                "Workload (coding, gaming, office) changes the trade-offs.",
            ),
            MissingContextItem(
                "Portability / battery priority",
                "medium",
                "Mobility needs often dominate hardware choice.",
            ),
        ],
    ),
    (
        re.compile(r"\b(postgres|mysql|database|mongodb|sqlite)\b", re.I),
        [
            MissingContextItem(
                "Workload shape",
                "high",
                "OLTP vs analytics vs embedded needs different engines.",
            ),
            MissingContextItem(
                "Team familiarity",
                "medium",
                "Operational skill often outweighs theoretical advantages.",
            ),
            MissingContextItem(
                "Scale & consistency needs",
                "medium",
                "Consistency and scale targets constrain the shortlist.",
            ),
        ],
    ),
    (
        re.compile(r"\b(react|vue|angular|framework|frontend)\b", re.I),
        [
            MissingContextItem(
                "Team experience",
                "high",
                "Existing skills usually dominate framework choice.",
            ),
            MissingContextItem(
                "App complexity",
                "medium",
                "Simple UIs and complex SPA needs diverge.",
            ),
            MissingContextItem(
                "Ecosystem constraints",
                "medium",
                "Hosting, SSR, and library requirements matter.",
            ),
        ],
    ),
    (
        re.compile(r"\b(nuclear|energy policy|invest in)\b", re.I),
        [
            MissingContextItem(
                "Time horizon",
                "high",
                "Energy decisions differ for 5-year vs 30-year goals.",
            ),
            MissingContextItem(
                "Constraints (cost, safety, politics)",
                "high",
                "Hard constraints change which options are feasible.",
            ),
        ],
    ),
]


def detect_missing_context(user_query: str) -> list[MissingContextItem]:
    text = user_query.strip()
    if not text or _CREATIVE_HINTS.search(text):
        return []
    if not _DECISION_HINTS.search(text) and "?" not in text:
        # Only surface when the question looks decision-shaped or open-ended.
        if len(text.split()) < 6:
            return []

    found: list[MissingContextItem] = []
    for pattern, items in _CONTEXT_RULES:
        if pattern.search(text):
            found.extend(items)
    # Deduplicate by item name, keep first (highest priority rules first)
    seen: set[str] = set()
    ordered: list[MissingContextItem] = []
    for item in found:
        key = item.item.lower()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(item)
    return ordered[:4]


def build_counter_perspective(
    *,
    user_query: str,
    answer: str,
    mode: str,
) -> str | None:
    """Short alternative perspective. Skipped for Fast / creative / empty answers."""
    if mode == "fast":
        return None
    query = user_query.strip()
    text = answer.strip()
    if not query or not text or len(text) < 80:
        return None
    if _CREATIVE_HINTS.search(query):
        return None

    lowered = query.lower()
    if "react" in lowered and "vue" in lowered:
        return (
            "Alternative perspective: Vue may be preferable when team ramp-up speed and "
            "template simplicity matter more than ecosystem breadth. The 'better' choice "
            "depends on constraints the answer may underweight."
        )
    if "postgres" in lowered:
        return (
            "Alternative perspective: a managed or simpler store can win if operational "
            "overhead dominates, even when PostgreSQL is technically capable. Fit to team "
            "and workload beats defaulting to the most powerful option."
        )
    if "nuclear" in lowered or "invest" in lowered:
        return (
            "Alternative perspective: opportunity cost, political feasibility, and nearer-term "
            "renewables may outweigh long-horizon nuclear advantages depending on the "
            "decision frame. The recommendation is sensitive to unstated constraints."
        )
    if "bitcoin" in lowered:
        return (
            "Alternative perspective: Bitcoin can also be framed primarily as a speculative "
            "asset rather than payment infrastructure; that framing changes which properties "
            "matter most."
        )
    if _DECISION_HINTS.search(query):
        return (
            "Alternative perspective: a different weighting of constraints (risk, cost, "
            "time, or simplicity) could reverse the recommendation. Treat the answer as "
            "one structured view, not a unique optimum."
        )
    return None
