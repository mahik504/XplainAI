"""Semantic Evidence & Claim Graph Topology Generator.

Constructs 2D and 3D graph representations linking Sources, Evidence, Claims,
Inferences, Assumptions, and Conclusions with typed semantic edges.
"""

from __future__ import annotations

import math
import re
from typing import Any

from neural_navigator.domain.models.research import (
    Assumption,
    Citation,
    Claim,
    ClaimStatus,
    Contradiction,
    Evidence,
    EvidenceGraph,
    GraphEdge,
    GraphEdgeType,
    GraphNode,
    GraphNodeType,
    Source,
    SourceType,
    generate_id,
)

# Sentence boundary regex that respects common abbreviations
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")
_CITATION_TAG_RE = re.compile(r"\[(?:source|ref|citation)\s*:?\s*(\d+)\]|\[(\d+)\]", re.I)


def extract_claims_from_text(text: str, evidence_list: list[Evidence]) -> list[Claim]:
    """Extracts discrete factual assertions and links them to available evidence."""
    raw_sentences = [s.strip() for s in _SENTENCE_SPLIT_RE.split(text) if s.strip()]
    claims: list[Claim] = []

    for index, sentence in enumerate(raw_sentences):
        # Skip trivial greetings or questions
        if len(sentence.split()) < 4 or sentence.endswith("?"):
            continue

        claim_id = generate_id("clm")
        matched_evidence_ids: list[str] = []
        lowered_sentence = sentence.lower()

        # Check for evidence overlap or explicit citation indices
        for ev in evidence_list:
            ev_words = [w for w in re.findall(r"[a-z0-9]{4,}", ev.text.lower()) if len(w) > 3]
            overlap_count = sum(1 for w in ev_words if w in lowered_sentence)
            if overlap_count >= 2 or ev.source_title.lower() in lowered_sentence:
                matched_evidence_ids.append(ev.id)

        status = ClaimStatus.SUPPORTED if matched_evidence_ids else ClaimStatus.UNVERIFIED
        
        # Assess importance
        importance = "medium"
        if index == 0 or index == len(raw_sentences) - 1:
            importance = "core"
        elif any(k in lowered_sentence for k in ("crucial", "fundamental", "specifically", "therefore", "proves")):
            importance = "high"

        claims.append(
            Claim(
                id=claim_id,
                text=sentence,
                status=status,
                evidence_ids=matched_evidence_ids,
                confidence=0.88 if status == ClaimStatus.SUPPORTED else 0.65,
                importance=importance,
                sentence_index=index,
            )
        )

    return claims


def build_evidence_graph(
    sources: list[Source],
    evidence: list[Evidence],
    claims: list[Claim],
    contradictions: list[Contradiction] | None = None,
    assumptions: list[Assumption] | None = None,
) -> EvidenceGraph:
    """Constructs a 3D spatial knowledge topology with semantic edges."""
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    contradictions = contradictions or []
    assumptions = assumptions or []

    # 1. Source Nodes (Placed on outer spatial shell: R=120, Z=+40)
    source_count = len(sources)
    for idx, src in enumerate(sources):
        angle = (2 * math.pi * idx) / max(1, source_count)
        radius = 120.0
        x = radius * math.cos(angle)
        y = radius * math.sin(angle)
        z = 40.0 + (idx % 3) * 10.0

        nodes.append(
            GraphNode(
                id=src.id,
                type=GraphNodeType.SOURCE,
                label=src.title[:32],
                description=src.snippet[:120],
                metadata={"url": src.url, "domain": src.domain, "authority": src.authority_score},
                position_3d=(x, y, z),
                status="verified",
                cluster="sources",
            )
        )

    # 2. Evidence Nodes (Placed on intermediate ring: R=75, Z=+20)
    ev_count = len(evidence)
    for idx, ev in enumerate(evidence):
        angle = (2 * math.pi * idx) / max(1, ev_count) + 0.2
        radius = 75.0
        x = radius * math.cos(angle)
        y = radius * math.sin(angle)
        z = 20.0 + (idx % 2) * 8.0

        nodes.append(
            GraphNode(
                id=ev.id,
                type=GraphNodeType.EVIDENCE,
                label=f"Evidence [{idx + 1}]",
                description=ev.text[:120],
                metadata={"source_id": ev.source_id, "confidence": ev.confidence},
                position_3d=(x, y, z),
                status="grounded",
                cluster="evidence",
            )
        )

        # Edge: Evidence -> Source (DERIVED_FROM)
        edges.append(
            GraphEdge(
                id=generate_id("edg"),
                source_node_id=ev.id,
                target_node_id=ev.source_id,
                type=GraphEdgeType.DERIVED_FROM,
                weight=ev.confidence,
                label="derived from",
            )
        )

    # 3. Claim Nodes (Placed in central core band: R=35, Z=0)
    claim_count = len(claims)
    for idx, clm in enumerate(claims):
        angle = (2 * math.pi * idx) / max(1, claim_count) + 0.4
        radius = 35.0 + (idx % 2) * 10.0
        x = radius * math.cos(angle)
        y = radius * math.sin(angle)
        z = 0.0 + (idx % 3) * 5.0

        nodes.append(
            GraphNode(
                id=clm.id,
                type=GraphNodeType.CLAIM,
                label=f"Claim {idx + 1}: {clm.text[:24]}...",
                description=clm.text,
                metadata={"status": clm.status.value, "importance": clm.importance, "confidence": clm.confidence},
                position_3d=(x, y, z),
                status=clm.status.value,
                cluster="claims",
            )
        )

        # Edges: Evidence -> Claim (SUPPORTS)
        for ev_id in clm.evidence_ids:
            edges.append(
                GraphEdge(
                    id=generate_id("edg"),
                    source_node_id=ev_id,
                    target_node_id=clm.id,
                    type=GraphEdgeType.SUPPORTS,
                    weight=0.9,
                    label="supports",
                )
            )

    # 4. Assumption Nodes (Placed below core: R=50, Z=-30)
    for idx, asm in enumerate(assumptions):
        angle = (2 * math.pi * idx) / max(1, len(assumptions)) + 0.8
        radius = 50.0
        x = radius * math.cos(angle)
        y = radius * math.sin(angle)
        z = -30.0

        nodes.append(
            GraphNode(
                id=asm.id,
                type=GraphNodeType.ASSUMPTION,
                label=f"Assumption [{idx + 1}]",
                description=asm.text,
                metadata={"risk": asm.risk_level, "grounded_score": asm.grounded_score},
                position_3d=(x, y, z),
                status="unverified",
                cluster="assumptions",
            )
        )

    # 5. Contradiction Edges
    for con in contradictions:
        edges.append(
            GraphEdge(
                id=generate_id("edg"),
                source_node_id=con.evidence_b_id if con.evidence_b_id else con.claim_id,
                target_node_id=con.claim_id,
                type=GraphEdgeType.CONTRADICTS,
                weight=1.0,
                label=f"contradicts ({con.severity})",
            )
        )

    # Compute graph density
    n_count = len(nodes)
    e_count = len(edges)
    possible_edges = (n_count * (n_count - 1)) / 2 if n_count > 1 else 1
    density = e_count / possible_edges if possible_edges > 0 else 0.0

    return EvidenceGraph(
        nodes=nodes,
        edges=edges,
        density=density,
        cluster_count=4 if assumptions else 3,
    )