"""Inline citation parsing and claim-evidence resolution engine.

Detects bracketed citation markers (e.g. `[1]`, `[source: 2]`, `[ref: 3]`) within
synthesized text, resolves them to authoritative sources and evidence passages,
and establishes verified support edges in the research knowledge graph.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

from neural_navigator.domain.models.research import (
    Citation,
    ClaimStatus,
    GraphEdge,
    GraphEdgeType,
    generate_id,
)

if TYPE_CHECKING:
    from collections.abc import Sequence

    from neural_navigator.domain.models.research import Claim, Evidence, Source

# Pattern matching single index [1], tagged [source: 1], [ref: 2], or comma-separated [1, 2]
_CITATION_PATTERN = re.compile(
    r"\[(?:(?:source|ref|citation)\s*:?\s*)?(\d+(?:\s*,\s*\d+)*)\]",
    re.IGNORECASE,
)


@dataclass(slots=True)
class ParsedMarker:
    """A citation marker extracted from text."""

    citation_index: int
    raw_marker: str
    char_start: int
    char_end: int


def parse_citation_markers(text: str) -> list[ParsedMarker]:
    """Extract all citation indices and their character positions from text."""
    markers: list[ParsedMarker] = []
    for match in _CITATION_PATTERN.finditer(text):
        raw = match.group(0)
        digits_part = match.group(1)
        indices = [int(x.strip()) for x in digits_part.split(",") if x.strip().isdigit()]
        for idx in indices:
            markers.append(
                ParsedMarker(
                    citation_index=idx,
                    raw_marker=raw,
                    char_start=match.start(),
                    char_end=match.end(),
                )
            )
    return markers


def _find_enclosing_claim(
    char_pos: int,
    text: str,
    claims: Sequence[Claim],
) -> Claim | None:
    """Find the claim whose sentence text encloses or is closest to the given character position."""
    if not claims:
        return None

    best_claim: Claim | None = None
    min_dist = float("inf")

    for claim in claims:
        pos = text.find(claim.text)
        if pos != -1:
            start = pos
            end = pos + len(claim.text)
            if start <= char_pos <= end + 10:
                return claim
            dist = abs(char_pos - start)
            if dist < min_dist:
                min_dist = dist
                best_claim = claim

    return best_claim or (claims[0] if claims else None)


def resolve_inline_citations(
    text: str,
    sources: Sequence[Source],
    evidence: Sequence[Evidence],
    claims: Sequence[Claim],
) -> tuple[str, list[Citation], list[GraphEdge]]:
    """Resolve inline citation markers to concrete Source and Evidence records.

    Updates claim statuses and generates verified SUPPORTS graph edges.
    Returns the original text, list of resolved Citations, and list of GraphEdges.
    """
    markers = parse_citation_markers(text)
    citations: list[Citation] = []
    edges: list[GraphEdge] = []
    seen_citation_keys: set[tuple[str, str]] = set()

    source_map: dict[int, Source] = {i + 1: s for i, s in enumerate(sources)}
    evidence_map: dict[int, Evidence] = {i + 1: e for i, e in enumerate(evidence)}

    src_to_evi: dict[str, list[Evidence]] = {}
    for ev in evidence:
        src_to_evi.setdefault(ev.source_id, []).append(ev)

    for marker in markers:
        idx = marker.citation_index
        src = source_map.get(idx)
        evi = evidence_map.get(idx)

        if not evi and src and src.id in src_to_evi:
            evi = src_to_evi[src.id][0]

        if not src and not evi:
            continue

        src_id = src.id if src else (evi.source_id if evi else "")
        evi_id = evi.id if evi else ""

        claim = _find_enclosing_claim(marker.char_start, text, claims)
        claim_id = claim.id if claim else generate_id("clm")

        citation_id = generate_id("cit")
        citation = Citation(
            id=citation_id,
            claim_id=claim_id,
            source_id=src_id,
            evidence_id=evi_id,
            inline_marker=marker.raw_marker,
            citation_index=idx,
        )
        citations.append(citation)

        if claim and evi_id:
            key = (claim.id, evi_id)
            if key not in seen_citation_keys:
                seen_citation_keys.add(key)
                if evi_id not in claim.evidence_ids:
                    claim.evidence_ids.append(evi_id)
                claim.status = ClaimStatus.SUPPORTED
                claim.confidence = max(claim.confidence, 0.90)

                edges.append(
                    GraphEdge(
                        id=generate_id("edg"),
                        source_node_id=evi_id,
                        target_node_id=claim.id,
                        type=GraphEdgeType.SUPPORTS,
                        weight=0.95,
                        label=f"cites [{idx}]",
                    )
                )

    return text, citations, edges
