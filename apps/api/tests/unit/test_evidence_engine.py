"""Unit tests for structured claim extraction, contradiction detection, and EGI 2.0."""

from neural_navigator.agents.evidence.claim_extractor import ClaimExtractor
from neural_navigator.agents.evidence.contradiction_analyzer import ContradictionAnalyzer
from neural_navigator.domain.models.research import (
    Assumption,
    Citation,
    Claim,
    ClaimStatus,
    Evidence,
    Source,
    SourceType,
)
from neural_navigator.orchestration.egi import compute_egi_score


def test_claim_extractor_atomic_propositions() -> None:
    evidence = [
        Evidence(
            id="evi_1",
            source_id="src_1",
            source_title="Quantum Benchmark 2026",
            source_url="https://arxiv.org/abs/2601.0001",
            text="Logical qubit error rates were reduced by 50 percent in surface codes.",
            confidence=0.92,
        ),
        Evidence(
            id="evi_2",
            source_id="src_2",
            source_title="Computing Review",
            source_url="https://example.com/computing",
            text="Classical supercomputers still handle large-scale database operations.",
            confidence=0.88,
        ),
    ]

    answer = (
        "Fundamentally, logical qubit error rates were reduced by 50 percent in surface codes. "
        "Classical supercomputers remain standard for database processing. "
        "Quantum advantage will arrive soon."
    )

    claims = ClaimExtractor.extract_claims(answer, evidence)
    assert len(claims) >= 3

    # First claim (core thesis with numbers)
    assert claims[0].importance in ("core", "high")
    assert claims[0].status == ClaimStatus.SUPPORTED
    assert "evi_1" in claims[0].evidence_ids

    # Second claim
    assert claims[1].status == ClaimStatus.SUPPORTED
    assert "evi_2" in claims[1].evidence_ids

    # Third ungrounded claim
    assert claims[2].status == ClaimStatus.UNVERIFIED


def test_contradiction_analyzer_negation_detection() -> None:
    claims = [
        Claim(id="c1", text="Drug X is proven effective and safe for clinical therapy.", status=ClaimStatus.SUPPORTED, evidence_ids=["e1"]),
    ]
    evidence = [
        Evidence(
            id="e1",
            source_id="src_1",
            source_title="Pharma Journal",
            source_url="https://journal.org/drug-x",
            text="Drug X is proven effective in phase 3 human clinical trials.",
            confidence=0.90,
        ),
        Evidence(
            id="e2",
            source_id="src_2",
            source_title="Toxicology Report",
            source_url="https://tox.org/drug-x",
            text="Drug X was found ineffective and harmful in long-term safety evaluations.",
            confidence=0.95,
        ),
    ]

    contradictions = ContradictionAnalyzer.analyze_contradictions(
        claims=claims,
        evidence=evidence,
        counter_perspective="Some studies indicate potential adverse effects under high dosages.",
    )

    assert len(contradictions) >= 1
    assert contradictions[0].claim_id == "c1"
    assert contradictions[0].evidence_a_id in ("e1", "e2")
    assert contradictions[0].evidence_b_id in ("e1", "e2")
    assert contradictions[0].severity in ("critical", "moderate")
    assert contradictions[0].contradiction_type == "direct_negation"


def test_egi_2_0_comprehensive_mathematical_metrics() -> None:
    sources = [
        Source(
            id="s1",
            title="Scientific Report",
            url="https://arxiv.org/abs/2601.1234",
            domain="arxiv.org",
            snippet="Detailed empirical methodology.",
            source_type=SourceType.PAPER,
            authority_score=0.96,
            published_date="2026-01-15",
        ),
    ]
    claims = [
        Claim(id="c1", text="Primary conclusion statement", status=ClaimStatus.SUPPORTED, importance="core", confidence=0.95),
        Claim(id="c2", text="Secondary empirical measurement", status=ClaimStatus.SUPPORTED, importance="high", confidence=0.90),
    ]
    evidence = [
        Evidence(id="e1", source_id="s1", source_title="S1", source_url="u1", text="Data", confidence=0.95, relevance_score=0.90),
    ]
    citations = [
        Citation(id="cit1", claim_id="c1", source_id="s1", evidence_id="e1", inline_marker="[1]", citation_index=1),
        Citation(id="cit2", claim_id="c2", source_id="s1", evidence_id="e1", inline_marker="[2]", citation_index=2),
    ]

    score, metrics = compute_egi_score(
        claims=claims,
        evidence=evidence,
        citations=citations,
        sources=sources,
        domain="technology",
    )

    assert 0.85 <= score <= 1.0
    assert metrics["coverage_score"] > 0.8
    assert metrics["source_quality_score"] > 0.8
    assert metrics["citation_fidelity"] == 1.0
    assert metrics["freshness_factor"] == 1.0
    assert metrics["contradiction_penalty"] == 0.0
    assert metrics["assumption_risk"] == 0.0
