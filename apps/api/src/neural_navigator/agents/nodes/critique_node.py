"""Post-answer critique and dialectic contradiction analysis node."""

from __future__ import annotations

import asyncio
from typing import Any

from neural_navigator.agents.evidence.contradiction_analyzer import ContradictionAnalyzer
from neural_navigator.agents.state.research_state import ResearchState
from neural_navigator.domain.models.research import (
    Assumption,
    Claim,
    ClaimStatus,
    Evidence,
    generate_id,
)
from neural_navigator.orchestration.post_analysis import (
    build_counter_perspective,
    detect_missing_context,
)


async def critique_node(state: ResearchState) -> dict[str, Any]:
    """Evaluate missing context, counter-perspectives, contradictions, and assumptions."""
    user_text = state.get("user_text", "")
    answer_text = state.get("answer_text", "")
    mode = state.get("mode", "deep_research")
    domain = state.get("query_analysis", {}).get("domain", "general")

    claims_data = state.get("claims", [])
    claims: list[Claim] = [
        Claim(
            id=c.get("id", ""),
            text=c.get("text", ""),
            status=ClaimStatus(c.get("status", "unverified")),
            evidence_ids=list(c.get("evidence_ids", [])),
            confidence=float(c.get("confidence", 0.7)),
            importance=c.get("importance", "medium"),
            sentence_index=int(c.get("sentence_index", 0)),
        )
        for c in claims_data
    ]

    evidence_data = state.get("evidence", [])
    evidence: list[Evidence] = [
        Evidence(
            id=ev.get("id", ""),
            source_id=ev.get("source_id", ""),
            source_title=ev.get("source_title", ""),
            source_url=ev.get("source_url", ""),
            text=ev.get("text", ""),
            confidence=float(ev.get("confidence", 0.85)),
            relevance_score=float(ev.get("relevance_score", 0.85)),
            chunk_id=ev.get("chunk_id"),
        )
        for ev in evidence_data
    ]

    missing_items, counter = await asyncio.gather(
        asyncio.to_thread(detect_missing_context, user_text),
        asyncio.to_thread(
            lambda: build_counter_perspective(
                user_query=user_text,
                answer=answer_text,
                mode=mode,
            )
        ),
    )

    contradictions = ContradictionAnalyzer.analyze_contradictions(
        claims=claims,
        evidence=evidence,
        counter_perspective=counter,
    )

    assumptions: list[Assumption] = [
        Assumption(
            id=generate_id("asm"),
            text=f"Assumes {domain} query parameters remain stationary across context window.",
            grounded_score=0.75,
            risk_level="low",
        )
    ]

    return {
        "missing_context": [item.as_dict() for item in missing_items],
        "counter_perspective": counter,
        "contradictions": [con.as_dict() for con in contradictions],
        "assumptions": [asm.as_dict() for asm in assumptions],
        "current_stage": "critique_completed",
    }
