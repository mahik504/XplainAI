"""Unit tests for inline citation resolution and claim linking."""

from neural_navigator.domain.models.research import (
    Claim,
    ClaimStatus,
    Evidence,
    GraphEdgeType,
    Source,
)
from neural_navigator.orchestration.citations import (
    parse_citation_markers,
    resolve_inline_citations,
)


def test_parse_citation_markers() -> None:
    text = (
        "Quantum error correction is feasible [1]. Surface codes are optimal [source: 2], [3, 4]."
    )
    markers = parse_citation_markers(text)

    indices = [m.citation_index for m in markers]
    assert indices == [1, 2, 3, 4]


def test_resolve_inline_citations_linking() -> None:
    source1 = Source(
        id="src_1",
        title="Surface Codes",
        url="https://arxiv.org/abs/2301.00001",
        domain="arxiv.org",
        snippet="Surface code achieves high fault-tolerance threshold.",
    )
    evidence1 = Evidence(
        id="evi_1",
        source_id="src_1",
        source_title="Surface Codes",
        source_url="https://arxiv.org/abs/2301.00001",
        text="Surface code achieves high fault-tolerance threshold.",
        confidence=0.92,
    )

    claim1 = Claim(
        id="clm_1",
        text="Surface codes achieve a high fault-tolerance threshold.",
        status=ClaimStatus.UNVERIFIED,
    )

    text = "Surface codes achieve a high fault-tolerance threshold [1]."

    _, citations, edges = resolve_inline_citations(
        text=text,
        sources=[source1],
        evidence=[evidence1],
        claims=[claim1],
    )

    assert len(citations) == 1
    assert citations[0].citation_index == 1
    assert citations[0].source_id == "src_1"
    assert citations[0].evidence_id == "evi_1"
    assert citations[0].claim_id == "clm_1"

    # Claim should be updated to SUPPORTED
    assert claim1.status == ClaimStatus.SUPPORTED
    assert "evi_1" in claim1.evidence_ids

    # Edge should link evidence to claim
    assert len(edges) == 1
    assert edges[0].source_node_id == "evi_1"
    assert edges[0].target_node_id == "clm_1"
    assert edges[0].type == GraphEdgeType.SUPPORTS
