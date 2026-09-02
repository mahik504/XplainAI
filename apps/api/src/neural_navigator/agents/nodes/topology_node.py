"""3D Evidence graph topology and EGI 2.0 calculation node."""

from __future__ import annotations

from typing import Any

from neural_navigator.agents.state.research_state import ResearchState
from neural_navigator.domain.models.research import (
    Assumption,
    Citation,
    Claim,
    ClaimStatus,
    Contradiction,
    Evidence,
    GraphEdge,
    GraphEdgeType,
    Source,
    SourceType,
    generate_id,
)
from neural_navigator.orchestration.egi import compute_egi_score
from neural_navigator.orchestration.graph_engine import build_evidence_graph


async def topology_node(state: ResearchState) -> dict[str, Any]:
    """Construct 3D spatial evidence topology and compute Explainable Grounding Index."""
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
                published_date=s.get("published_date"),
                author=s.get("author"),
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
            chunk_id=ev.get("chunk_id"),
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

    contradictions_data = state.get("contradictions", [])
    contradictions: list[Contradiction] = [
        Contradiction(
            id=con.get("id", ""),
            claim_id=con.get("claim_id", ""),
            evidence_a_id=con.get("evidence_a_id", ""),
            evidence_b_id=con.get("evidence_b_id", ""),
            explanation=con.get("explanation", ""),
            severity=con.get("severity", "moderate"),
            contradiction_type=con.get("contradiction_type", "direct_negation"),
        )
        for con in contradictions_data
    ]

    assumptions_data = state.get("assumptions", [])
    assumptions: list[Assumption] = [
        Assumption(
            id=asm.get("id", ""),
            text=asm.get("text", ""),
            grounded_score=float(asm.get("grounded_score", 0.4)),
            risk_level=asm.get("risk_level", "medium"),
        )
        for asm in assumptions_data
    ]

    citations_data = state.get("citations", [])
    citations: list[Citation] = [
        Citation(
            id=cit.get("id", ""),
            claim_id=cit.get("claim_id", ""),
            source_id=cit.get("source_id", ""),
            evidence_id=cit.get("evidence_id", ""),
            inline_marker=cit.get("inline_marker", ""),
            citation_index=int(cit.get("citation_index", 1)),
        )
        for cit in citations_data
    ]

    domain_graph = build_evidence_graph(
        sources=sources,
        evidence=evidence,
        claims=claims,
        contradictions=contradictions,
        assumptions=assumptions,
    )

    existing_edge_keys = {(e.source_node_id, e.target_node_id) for e in domain_graph.edges}
    for cit in citations:
        if cit.evidence_id and cit.claim_id:
            key = (cit.evidence_id, cit.claim_id)
            if key not in existing_edge_keys:
                existing_edge_keys.add(key)
                domain_graph.edges.append(
                    GraphEdge(
                        id=generate_id("edg"),
                        source_node_id=cit.evidence_id,
                        target_node_id=cit.claim_id,
                        type=GraphEdgeType.SUPPORTS,
                        weight=0.95,
                        label=f"cites [{cit.citation_index}]",
                    )
                )

    domain = state.get("query_analysis", {}).get("domain", "general")
    egi_score, trust_metrics = compute_egi_score(
        claims=claims,
        evidence=evidence,
        citations=citations,
        contradictions=contradictions,
        assumptions=assumptions,
        sources=sources,
        domain=domain,
    )

    return {
        "graph": domain_graph.as_dict(),
        "egi_score": egi_score,
        "trust_metrics": trust_metrics,
        "current_stage": "structure_ready",
    }
