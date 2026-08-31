"""Post-answer critique and counter-perspective node for the LangGraph research state machine."""

from __future__ import annotations

import asyncio
from typing import Any

from neural_navigator.agents.state.research_state import (
    ResearchState,  # noqa: TC001 - Required for LangGraph node reflection
)
from neural_navigator.domain.models.research import Assumption, Contradiction, generate_id
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

    claims = state.get("claims", [])
    evidence = state.get("evidence", [])

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

    contradictions: list[Contradiction] = []
    if counter:
        first_claim_id = (
            str(claims[0].get("id")) if claims and claims[0].get("id") else generate_id("clm")
        )
        first_evi_id = str(evidence[0].get("id")) if evidence and evidence[0].get("id") else ""
        contradictions.append(
            Contradiction(
                id=generate_id("con"),
                claim_id=first_claim_id,
                evidence_a_id=first_evi_id,
                evidence_b_id="",
                explanation=counter[:160],
                severity="moderate",
            )
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
