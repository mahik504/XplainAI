"""Domain models for research sessions, claims, citations, contradictions, and 3D evidence topology."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any


def utc_now() -> datetime:
    return datetime.now(UTC)


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class SourceType(StrEnum):
    PAPER = "paper"
    DOCUMENT = "document"
    DOCUMENTATION = "documentation"
    TOOL = "tool"
    WEB = "web"
    SYSTEM = "system"


class ClaimStatus(StrEnum):
    SUPPORTED = "supported"
    WEAKLY_SUPPORTED = "weakly_supported"
    CONTRADICTED = "contradicted"
    UNVERIFIED = "unverified"


class GraphNodeType(StrEnum):
    SOURCE = "source"
    EVIDENCE = "evidence"
    CLAIM = "claim"
    CONTRADICTION = "contradiction"
    ASSUMPTION = "assumption"


class GraphEdgeType(StrEnum):
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"
    CITES = "cites"
    CONFIRMS = "confirms"
    CHALLENGES = "challenges"
    DERIVED_FROM = "derived_from"
    ATTRIBUTES = "attributes"
    CONTRADICTION = "contradiction"


@dataclass(slots=True)
class Source:
    id: str
    title: str
    url: str
    domain: str
    snippet: str
    source_type: SourceType = SourceType.WEB
    authority_score: float = 0.8
    published_date: str | None = None
    author: str | None = None
    reliability_tier: str = "medium"

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "url": self.url,
            "domain": self.domain,
            "snippet": self.snippet,
            "source_type": self.source_type.value,
            "authority_score": round(self.authority_score, 2),
            "published_date": self.published_date,
            "author": self.author,
            "reliability_tier": self.reliability_tier,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Source:
        st_val = data.get("source_type", "web")
        try:
            st = SourceType(st_val)
        except ValueError:
            st = SourceType.WEB
        return cls(
            id=data.get("id", generate_id("src")),
            title=data.get("title", ""),
            url=data.get("url", ""),
            domain=data.get("domain", ""),
            snippet=data.get("snippet", ""),
            source_type=st,
            authority_score=float(data.get("authority_score", 0.8)),
            published_date=data.get("published_date"),
            author=data.get("author"),
            reliability_tier=data.get("reliability_tier", "medium"),
        )


@dataclass(slots=True)
class Evidence:
    id: str
    source_id: str
    source_title: str
    source_url: str
    text: str
    confidence: float = 0.85
    relevance_score: float = 0.85
    chunk_id: str | None = None
    char_start: int | None = None
    char_end: int | None = None
    page_number: int | None = None
    bbox: tuple[float, float, float, float] | list[float] | None = None

    def as_dict(self) -> dict[str, Any]:
        res: dict[str, Any] = {
            "id": self.id,
            "source_id": self.source_id,
            "source_title": self.source_title,
            "source_url": self.source_url,
            "text": self.text,
            "confidence": round(self.confidence, 2),
            "relevance_score": round(self.relevance_score, 2),
            "chunk_id": self.chunk_id,
            "char_start": self.char_start,
            "char_end": self.char_end,
        }
        if self.page_number is not None:
            res["page_number"] = self.page_number
        if self.bbox is not None:
            res["bbox"] = list(self.bbox)
        return res

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Evidence:
        return cls(
            id=data.get("id", generate_id("evi")),
            source_id=data.get("source_id", ""),
            source_title=data.get("source_title", ""),
            source_url=data.get("source_url", ""),
            text=data.get("text", ""),
            confidence=float(data.get("confidence", 0.85)),
            relevance_score=float(data.get("relevance_score", 0.85)),
            chunk_id=data.get("chunk_id"),
            char_start=data.get("char_start"),
            char_end=data.get("char_end"),
            page_number=data.get("page_number"),
            bbox=data.get("bbox") or data.get("bounding_box"),
        )


@dataclass(slots=True)
class Claim:
    id: str
    text: str
    status: ClaimStatus = ClaimStatus.UNVERIFIED
    evidence_ids: list[str] = field(default_factory=list)
    confidence: float = 0.7
    importance: str = "medium"  # core | high | medium | low
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

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Claim:
        status_val = data.get("status", "unverified")
        try:
            cs = ClaimStatus(status_val)
        except ValueError:
            cs = ClaimStatus.UNVERIFIED
        return cls(
            id=data.get("id", generate_id("clm")),
            text=data.get("text", ""),
            status=cs,
            evidence_ids=list(data.get("evidence_ids", [])),
            confidence=float(data.get("confidence", 0.7)),
            importance=data.get("importance", "medium"),
            sentence_index=int(data.get("sentence_index", 0)),
        )


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

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Citation:
        return cls(
            id=data.get("id", generate_id("cit")),
            claim_id=data.get("claim_id", ""),
            source_id=data.get("source_id", ""),
            evidence_id=data.get("evidence_id", ""),
            inline_marker=data.get("inline_marker", ""),
            citation_index=int(data.get("citation_index", 1)),
        )


@dataclass(slots=True)
class Contradiction:
    id: str
    claim_id: str
    evidence_a_id: str
    evidence_b_id: str
    explanation: str
    severity: str = "moderate"
    contradiction_type: str = "direct_negation"

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "claim_id": self.claim_id,
            "evidence_a_id": self.evidence_a_id,
            "evidence_b_id": self.evidence_b_id,
            "explanation": self.explanation,
            "severity": self.severity,
            "contradiction_type": self.contradiction_type,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Contradiction:
        return cls(
            id=data.get("id", generate_id("con")),
            claim_id=data.get("claim_id", ""),
            evidence_a_id=data.get("evidence_a_id", ""),
            evidence_b_id=data.get("evidence_b_id", ""),
            explanation=data.get("explanation", ""),
            severity=data.get("severity", "moderate"),
            contradiction_type=data.get("contradiction_type", "direct_negation"),
        )


@dataclass(slots=True)
class Assumption:
    id: str
    text: str
    grounded_score: float = 0.5
    risk_level: str = "low"

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "text": self.text,
            "grounded_score": round(self.grounded_score, 2),
            "risk_level": self.risk_level,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Assumption:
        return cls(
            id=data.get("id", generate_id("asm")),
            text=data.get("text", ""),
            grounded_score=float(data.get("grounded_score", 0.5)),
            risk_level=data.get("risk_level", "low"),
        )


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
            "position_3d": list(self.position_3d),
            "status": self.status,
            "cluster": self.cluster,
        }


@dataclass(slots=True)
class GraphEdge:
    id: str
    source_node_id: str
    target_node_id: str
    type: GraphEdgeType = GraphEdgeType.SUPPORTS
    weight: float = 1.0
    label: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "source_node_id": self.source_node_id,
            "target_node_id": self.target_node_id,
            "type": self.type.value,
            "weight": round(self.weight, 2),
            "label": self.label,
        }


@dataclass(slots=True)
class EvidenceGraph:
    nodes: list[GraphNode] = field(default_factory=list)
    edges: list[GraphEdge] = field(default_factory=list)
    density: float = 0.0
    cluster_count: int = 1

    def as_dict(self) -> dict[str, Any]:
        return {
            "nodes": [n.as_dict() for n in self.nodes],
            "edges": [e.as_dict() for e in self.edges],
            "node_count": len(self.nodes),
            "edge_count": len(self.edges),
            "density": round(self.density, 3),
            "cluster_count": self.cluster_count,
        }


@dataclass(slots=True)
class OrchestrationResult:
    """The complete observable outcome of a research run."""

    mode: Any
    query_analysis: Any
    tool_results: list[Any] = field(default_factory=list)
    research_tasks: list[str] = field(default_factory=list)
    sources_retrieved: int = 0
    sources: list[Any] = field(default_factory=list)
    domain_sources: list[Source] = field(default_factory=list)
    domain_evidence: list[Evidence] = field(default_factory=list)
    domain_claims: list[Claim] = field(default_factory=list)
    domain_citations: list[Citation] = field(default_factory=list)
    domain_graph: EvidenceGraph = field(default_factory=EvidenceGraph)
    egi_score: float = 0.85
    trust_metrics: dict[str, Any] = field(default_factory=dict)
    missing_context: list[dict[str, Any]] = field(default_factory=list)
    counter_perspective: str | None = None
    stage_timings: list[dict[str, Any]] = field(default_factory=list)
    answer_text: str = ""

    @property
    def claims(self) -> list[Claim]:
        return self.domain_claims

    @property
    def graph(self) -> EvidenceGraph:
        return self.domain_graph

    @property
    def evidence(self) -> list[Evidence]:
        return self.domain_evidence

    @property
    def citations(self) -> list[Citation]:
        return self.domain_citations

    def as_dict(self) -> dict[str, Any]:
        mode_val = self.mode.value if hasattr(self.mode, "value") else str(self.mode)
        qa_val = (
            self.query_analysis.as_dict()
            if hasattr(self.query_analysis, "as_dict")
            else self.query_analysis
        )
        return {
            "mode": mode_val,
            "query_analysis": qa_val,
            "tool_results": [
                item.as_dict() if hasattr(item, "as_dict") else item for item in self.tool_results
            ],
            "research_tasks": self.research_tasks,
            "sources_retrieved": self.sources_retrieved,
            "sources": [
                item.as_dict() if hasattr(item, "as_dict") else item for item in self.sources
            ],
            "domain_sources": [s.as_dict() for s in self.domain_sources],
            "domain_evidence": [e.as_dict() for e in self.domain_evidence],
            "domain_claims": [c.as_dict() for c in self.domain_claims],
            "domain_citations": [cit.as_dict() for cit in self.domain_citations],
            "domain_graph": self.domain_graph.as_dict(),
            "egi_score": self.egi_score,
            "trust_metrics": self.trust_metrics,
            "missing_context": self.missing_context,
            "counter_perspective": self.counter_perspective,
            "stage_timings": self.stage_timings,
            "answer_text": self.answer_text,
        }
