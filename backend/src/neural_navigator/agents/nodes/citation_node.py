"""Inline citation resolution node for the LangGraph research state machine."""

from __future__ import annotations

from typing import Any

from neural_navigator.agents.state.research_state import (
    ResearchState,  # noqa: TC001 - Required for LangGraph node reflection
)
from neural_navigator.domain.models.research import (
    Claim,
    ClaimStatus,
    Evidence,
    Source,
    SourceType,
)
from neural_navigator.orchestration.citations import resolve_inline_citations


async def citation_resolution_node(state: ResearchState) -> dict[str, Any]:
    """Parse inline markers from answer text and link them to retrieved evidence."""
    answer_text = state.get("answer_text", "")

    sources_data = state.get("sources", [])
    sources: list[Source] = []
    for s in sources_data:
        st_val = s.get("source_type", "web")
        try:
            st = SourceType(st_val)
        except ValueError:
            st = SourceType.WEB
        sources.append(
            Source(
                id=s.get("id", ""),
                title=s.get("title", ""),
                url=s.get("url", ""),
                domain=s.get("domain", ""),
                snippet=s.get("snippet", ""),
                source_type=st,
                authority_score=float(s.get("authority_score", 0.8)),
            )
        )

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
        )
        for ev in evidence_data
    ]

    claims_data = state.get("claims", [])
    claims: list[Claim] = []
    for c in claims_data:
        status_val = c.get("status", "unverified")
        try:
            cs = ClaimStatus(status_val)
        except ValueError:
            cs = ClaimStatus.UNVERIFIED
        claims.append(
            Claim(
                id=c.get("id", ""),
                text=c.get("text", ""),
                status=cs,
                evidence_ids=list(c.get("evidence_ids", [])),
                confidence=float(c.get("confidence", 0.7)),
                importance=c.get("importance", "medium"),
                sentence_index=int(c.get("sentence_index", 0)),
            )
        )

    _, citations, _ = resolve_inline_citations(answer_text, sources, evidence, claims)

    return {
        "citations": [cit.as_dict() for cit in citations],
        "claims": [c.as_dict() for c in claims],
        "current_stage": "citations_resolved",
    }
