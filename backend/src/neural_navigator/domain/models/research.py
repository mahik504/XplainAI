"""Domain entities for Explainable Intelligence, Research Runs, Evidence and Claims.

Strictly models observable artifacts (sources, evidence passages, explicit claims, citations,
contradictions, and topology) without fabricating hidden chain-of-thought.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
import uuid


def utc_now() -> datetime:
    return datetime.now(UTC)


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class SourceType(StrEnum):
    WEB = "web"
    PAPER = "paper"
    DOCUMENT = "document"
    TOOL = "tool"
    SYSTEM = "system"


class ClaimStatus(StrEnum):
    SUPPORTED = "supported"
    UNVERIFIED = "unverified"
    CONTRADICTED = "contradicted"
    WEAKLY_SUPPORTED = "weakly_supported"


class GraphNodeType(StrEnum):
    SOURCE = "source"
    EVIDENCE = "evidence"
    CLAIM = "claim"
    INFERENCE = "inference"
    ASSUMPTION = "assumption"
    CONCLUSION = "conclusion"


class GraphEdgeType(StrEnum):
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"
    DERIVED_FROM = "derived_from"
    DEPENDS_ON = "depends_on"
    CONFIRMS = "confirms"
    WEAKENS = "weakens"


@dataclass(slots=True)
class Source:
    id: str
    title: str
    url: str
    domain: str
    snippet: str
    source_type: SourceType = SourceType.WEB
    author: str | None = None
    published_date: str | None = None
    authority_score: float = 0.8
    retrieved_at: datetime = field(default_factory=utc_now)

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "url": self.url,
            "domain": self.domain,
            "snippet": self.snippet,
            "source_type": self.source_type.value,
            "author": self.author,
            "published_date": self.published_date,
            "authority_score": round(self.authority_score, 2),
            "retrieved_at": self.retrieved_at.isoformat(),
        }


@dataclass(slots=True)
class Evidence:
    id: str
    source_id: str
    source_title: str
    source_url: str
    text: str
    confidence: float = 0.85
    relevance_score: float = 0.85
    char_start: int | None = None
    char_end: int | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "source_id": self.source_id,
            "source_title": self.source_title,
            "source_url": self.source_url,
            "text": self.text,
            "confidence": round(self.confidence, 2),
            "relevance_score": round(self.relevance_score, 2),
            "char_start": self.char_start,
            "char_end": self.char_end,
        }


@dataclass(slots=True)
class Claim:
    id: str
    text: str
    status: ClaimStatus = ClaimStatus.UNVERIFIED
    evidence_ids: list[str] = field(default_factory=list)
    confidence: float = 0.7
    importance: str = "medium"  # low | medium | high | core
    sentence_index: int = 0

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "text": self.text,
            "status": self.status.value,
            "evidence_ids": self.evidence_ids,
            "confidence": round(self.confidence, 2),
            "importance": self.importance,
            "sentence_index": self.sentence_index,
        }


@dataclass(slots=True)
class Contradiction:
    id: str
    claim_id: str
    evidence_a_id: str
    evidence_b_id: str
    explanation: str
    severity: str = "moderate"  # low | moderate | critical

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "claim_id": self.claim_id,
            "evidence_a_id": self.evidence_a_id,
            "evidence_b_id": self.evidence_b_id,
            "explanation": self.explanation,
            "severity": self.severity,
        }


@dataclass(slots=True)
class Assumption:
    id: str
    text: str
    grounded_score: float = 0.4
    risk_level: str = "medium"  # low | medium | high

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "text": self.text,
            "grounded_score": round(self.grounded_score, 2),
            "risk_level": self.risk_level,
        }


@dataclass(slots=True)
class Citation:
    id: str
    claim_id: str
    source_id: str
    evidence_id: str
    inline_marker: str
    citation_index: int

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "claim_id": self.claim_id,
            "source_id": self.source_id,
            "evidence_id": self.evidence_id,
            "inline_marker": self.inline_marker,
            "citation_index": self.citation_index,
        }


@dataclass(slots=True)
class GraphNode:
    id: str
    type: GraphNodeType
    label: str
    description: str
    metadata: dict[str, Any] = field(default_factory=dict)
    position_3d: tuple[float, float, float] = (0.0, 0.0, 0.0)
    status: str = "neutral"
    cluster: str = "default"

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "label": self.label,
            "description": self.description,
            "metadata": self.metadata,
            "position_3d": [round(c, 2) for c in self.position_3d],
            "status": self.status,
            "cluster": self.cluster,
        }


@dataclass(slots=True)
class GraphEdge:
    id: str
    source_node_id: str
    target_node_id: str
    type: GraphEdgeType
    weight: float = 1.0
    label: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "source_node_id": self.source_node_id,
            "target_node_id": self.target_node_id,
            "type": self.type.value,
            "weight": round(self.weight, 2),
            "label": self.label or self.type.value,
        }


@dataclass(slots=True)
class EvidenceGraph:
    nodes: list[GraphNode] = field(default_factory=list)
    edges: list[GraphEdge] = field(default_factory=list)
    density: float = 0.0
    cluster_count: int = 1

    def as_dict(self) -> dict[str, Any]:
        return {
            "nodes": [node.as_dict() for node in self.nodes],
            "edges": [edge.as_dict() for edge in self.edges],
            "node_count": len(self.nodes),
            "edge_count": len(self.edges),
            "density": round(self.density, 3),
            "cluster_count": self.cluster_count,
        }


@dataclass(slots=True)
class ResearchStep:
    step_id: str
    stage: str
    action: str
    input: dict[str, Any] = field(default_factory=dict)
    output: dict[str, Any] = field(default_factory=dict)
    status: str = "completed"
    started_at: datetime = field(default_factory=utc_now)
    completed_at: datetime = field(default_factory=utc_now)

    def as_dict(self) -> dict[str, Any]:
        return {
            "step_id": self.step_id,
            "stage": self.stage,
            "action": self.action,
            "input": self.input,
            "output": self.output,
            "status": self.status,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat(),
            "duration_ms": round((self.completed_at - self.started_at).total_seconds() * 1000, 1),
        }


@dataclass(slots=True)
class ResearchRun:
    run_id: str
    mode: str
    query: str
    tasks: list[str] = field(default_factory=list)
    steps: list[ResearchStep] = field(default_factory=list)
    sources: list[Source] = field(default_factory=list)
    evidence: list[Evidence] = field(default_factory=list)
    claims: list[Claim] = field(default_factory=list)
    citations: list[Citation] = field(default_factory=list)
    contradictions: list[Contradiction] = field(default_factory=list)
    assumptions: list[Assumption] = field(default_factory=list)
    graph: EvidenceGraph = field(default_factory=EvidenceGraph)
    synthesized_text: str = ""
    created_at: datetime = field(default_factory=utc_now)
    completed_at: datetime | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "mode": self.mode,
            "query": self.query,
            "tasks": self.tasks,
            "steps": [step.as_dict() for step in self.steps],
            "sources": [source.as_dict() for source in self.sources],
            "evidence": [ev.as_dict() for ev in self.evidence],
            "claims": [cl.as_dict() for cl in self.claims],
            "citations": [cit.as_dict() for cit in self.citations],
            "contradictions": [con.as_dict() for con in self.contradictions],
            "assumptions": [asm.as_dict() for asm in self.assumptions],
            "graph": self.graph.as_dict(),
            "synthesized_text": self.synthesized_text,
            "created_at": self.created_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "trust_metrics": {
                "total_claims": len(self.claims),
                "supported_claims": sum(1 for c in self.claims if c.status == ClaimStatus.SUPPORTED),
                "unverified_claims": sum(1 for c in self.claims if c.status == ClaimStatus.UNVERIFIED),
                "contradictions_found": len(self.contradictions),
                "total_sources": len(self.sources),
                "total_evidence": len(self.evidence),
            }
        }