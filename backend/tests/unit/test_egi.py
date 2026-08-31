"""Unit tests for Explainable Grounding Index (EGI) calculation."""

from neural_navigator.domain.models.research import (
    Assumption,
    Citation,
    Claim,
    ClaimStatus,
    Contradiction,
    Evidence,
)
from neural_navigator.orchestration.egi import compute_egi_score


def test_compute_egi_score_fully_grounded() -> None:
    claims = [
        Claim(id="c1", text="Statement 1", status=ClaimStatus.SUPPORTED),
        Claim(id="c2", text="Statement 2", status=ClaimStatus.SUPPORTED),
    ]
    evidence = [
        Evidence(
            id="e1", source_id="s1", source_title="S1", source_url="u1", text="T1", confidence=0.95
        ),
        Evidence(
            id="e2", source_id="s2", source_title="S2", source_url="u2", text="T2", confidence=0.90
        ),
    ]
    citations = [
        Citation(
            id="cit1",
            claim_id="c1",
            source_id="s1",
            evidence_id="e1",
            inline_marker="[1]",
            citation_index=1,
        ),
        Citation(
            id="cit2",
            claim_id="c2",
            source_id="s2",
            evidence_id="e2",
            inline_marker="[2]",
            citation_index=2,
        ),
    ]

    score, metrics = compute_egi_score(claims, evidence, citations)
    assert 0.8 <= score <= 1.0
    assert metrics["grounding_ratio"] == 1.0
    assert metrics["supported_claims"] == 2
    assert metrics["contradictions_found"] == 0


def test_compute_egi_score_with_contradiction_and_assumptions() -> None:
    claims = [
        Claim(id="c1", text="Statement 1", status=ClaimStatus.SUPPORTED),
        Claim(id="c2", text="Statement 2", status=ClaimStatus.UNVERIFIED),
    ]
    evidence = [
        Evidence(
            id="e1", source_id="s1", source_title="S1", source_url="u1", text="T1", confidence=0.8
        ),
    ]
    citations = [
        Citation(
            id="cit1",
            claim_id="c1",
            source_id="s1",
            evidence_id="e1",
            inline_marker="[1]",
            citation_index=1,
        ),
    ]
    contradictions = [
        Contradiction(
            id="con1",
            claim_id="c1",
            evidence_a_id="e1",
            evidence_b_id="",
            explanation="Alternative view",
        ),
    ]
    assumptions = [
        Assumption(
            id="asm1",
            text="Query stationary assumption",
            grounded_score=0.3,
            risk_level="high",
        ),
    ]

    score, metrics = compute_egi_score(
        claims, evidence, citations, contradictions=contradictions, assumptions=assumptions
    )
    assert 0.0 <= score <= 1.0
    assert metrics["grounding_ratio"] == 0.5
    assert metrics["contradictions_found"] == 1
    assert metrics["assumption_risk"] > 0.0
