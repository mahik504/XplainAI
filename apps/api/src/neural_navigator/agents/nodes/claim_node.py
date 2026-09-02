"""Claim extraction node for the LangGraph research state machine."""

from __future__ import annotations

from typing import Any

from neural_navigator.agents.evidence.claim_extractor import ClaimExtractor
from neural_navigator.agents.state.research_state import ResearchState
from neural_navigator.domain.models.research import Evidence


async def claim_extraction_node(state: ResearchState) -> dict[str, Any]:
    """Extract discrete factual assertions from the synthesized answer text."""
    answer_text = state.get("answer_text", "")
    evidence_data = state.get("evidence", [])

    evidence_list: list[Evidence] = [
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

    claims = ClaimExtractor.extract_claims(answer_text, evidence_list)

    return {
        "claims": [c.as_dict() for c in claims],
        "current_stage": "claims_extracted",
    }
