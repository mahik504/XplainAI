"""Developer API routes for evidence retrieval, citations, and claim verification."""

from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from neural_navigator.api.middleware.auth import Principal, get_current_principal
from neural_navigator.infrastructure.db.manager import DatabaseManager
from neural_navigator.infrastructure.db.models.citation import Citation
from neural_navigator.infrastructure.db.models.claim import Claim
from neural_navigator.infrastructure.db.models.evidence import Evidence
from neural_navigator.infrastructure.db.models.source import Source
from neural_navigator.schemas.base import BaseSchema

_logger = structlog.stdlib.get_logger(__name__)

router = APIRouter(tags=["evidence"])


class EvidenceSearchRequest(BaseSchema):
    """Payload to search across verified evidence items."""

    query: str = Field(min_length=1, description="Text or question to search evidence against.")
    top_k: int = Field(default=10, ge=1, le=100, description="Maximum number of evidence snippets to return.")
    threshold: float = Field(default=0.0, ge=0.0, le=1.0, description="Minimum confidence/relevance threshold.")
    document_id: str | None = Field(default=None, description="Filter by document ID.")
    session_id: str | None = Field(default=None, description="Filter by research session ID.")


class EvidenceItemResponse(BaseSchema):
    """Evidence snippet details."""

    id: str
    source_id: str
    document_id: str | None = None
    chunk_id: str | None = None
    text: str
    confidence: float
    relevance_score: float
    char_start: int | None = None
    char_end: int | None = None
    page_number: int | None = None
    bounding_box: dict[str, Any] | None = None
    source_title: str | None = None
    source_url: str | None = None


class CitationResponse(BaseSchema):
    """Grounding citation linking claim to evidence and source."""

    id: str
    query_id: str
    claim_id: str
    evidence_id: str
    source_id: str
    inline_marker: str
    citation_index: int
    claim_text: str | None = None
    evidence_text: str | None = None
    source_title: str | None = None
    source_url: str | None = None


class ContradictionItem(BaseSchema):
    id: str
    antithesis_claim_id: str | None = None
    conflict_type: str
    severity: str
    reasoning: str
    resolution_status: str


class ClaimResponse(BaseSchema):
    """Atomic verifiable statement."""

    id: str
    query_id: str
    text: str
    status: str
    confidence: float
    importance: str
    sentence_index: int
    citations: list[CitationResponse] = Field(default_factory=list)
    contradictions: list[ContradictionItem] = Field(default_factory=list)


def _get_db_manager(request: Request) -> DatabaseManager:
    db_manager: DatabaseManager | None = getattr(request.app.state, "db_manager", None)
    if db_manager is None:
        settings = getattr(request.app.state, "settings", None)
        db_manager = DatabaseManager(settings=settings)
        request.app.state.db_manager = db_manager
    return db_manager


@router.post(
    "/evidence/search",
    response_model=list[EvidenceItemResponse],
    summary="Search evidence store",
    description="Hybrid search across verified evidence passages and document chunks.",
)
async def search_evidence(
    payload: EvidenceSearchRequest,
    request: Request,
    principal: Principal = Depends(get_current_principal),
) -> list[EvidenceItemResponse]:
    db_manager = _get_db_manager(request)
    results: list[EvidenceItemResponse] = []

    try:
        async with db_manager.session() as session:
            stmt = select(Evidence).options(selectinload(Evidence.source))

            if payload.document_id:
                stmt = stmt.where(Evidence.document_id == payload.document_id)

            # Order by confidence / relevance
            stmt = stmt.where(Evidence.confidence >= payload.threshold).limit(payload.top_k)

            res = await session.execute(stmt)
            evidence_items = res.scalars().all()

            # Rank items by query term match or confidence
            query_lower = payload.query.lower()
            scored_items = []
            for item in evidence_items:
                score = item.relevance_score
                if query_lower in item.text.lower():
                    score += 0.5
                scored_items.append((score, item))

            scored_items.sort(key=lambda x: x[0], reverse=True)

            for _, evi in scored_items[: payload.top_k]:
                source_title = evi.source.title if evi.source else None
                source_url = evi.source.url if evi.source else None
                results.append(
                    EvidenceItemResponse(
                        id=evi.id,
                        source_id=evi.source_id,
                        document_id=evi.document_id,
                        chunk_id=evi.chunk_id,
                        text=evi.text,
                        confidence=evi.confidence,
                        relevance_score=evi.relevance_score,
                        char_start=evi.char_start,
                        char_end=evi.char_end,
                        page_number=evi.page_number,
                        bounding_box=evi.bounding_box,
                        source_title=source_title,
                        source_url=source_url,
                    )
                )
    except Exception as exc:
        _logger.error("evidence.search_failed", error=str(exc))

    return results


@router.get(
    "/evidence/{evidence_id}",
    response_model=EvidenceItemResponse,
    summary="Get evidence snippet by ID",
    description="Retrieve a verified evidence passage by ID with bounding box and source reference.",
)
async def get_evidence_by_id(
    evidence_id: str,
    request: Request,
    principal: Principal = Depends(get_current_principal),
) -> EvidenceItemResponse:
    db_manager = _get_db_manager(request)

    try:
        async with db_manager.session() as session:
            stmt = (
                select(Evidence)
                .where(Evidence.id == evidence_id)
                .options(selectinload(Evidence.source))
            )
            res = await session.execute(stmt)
            evi = res.scalars().first()

            if evi is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Evidence '{evidence_id}' not found.",
                )

            return EvidenceItemResponse(
                id=evi.id,
                source_id=evi.source_id,
                document_id=evi.document_id,
                chunk_id=evi.chunk_id,
                text=evi.text,
                confidence=evi.confidence,
                relevance_score=evi.relevance_score,
                char_start=evi.char_start,
                char_end=evi.char_end,
                page_number=evi.page_number,
                bounding_box=evi.bounding_box,
                source_title=evi.source.title if evi.source else None,
                source_url=evi.source.url if evi.source else None,
            )
    except HTTPException:
        raise
    except Exception as exc:
        _logger.error("evidence.get_failed", evidence_id=evidence_id, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve evidence.",
        )


@router.get(
    "/citations/{citation_id}",
    response_model=CitationResponse,
    summary="Get citation by ID",
    description="Retrieve a citation with linked claim text, evidence passage, and source provenance.",
)
async def get_citation_by_id(
    citation_id: str,
    request: Request,
    principal: Principal = Depends(get_current_principal),
) -> CitationResponse:
    db_manager = _get_db_manager(request)

    try:
        async with db_manager.session() as session:
            stmt = (
                select(Citation)
                .where(Citation.id == citation_id)
                .options(
                    selectinload(Citation.claim),
                    selectinload(Citation.evidence),
                    selectinload(Citation.source),
                )
            )
            res = await session.execute(stmt)
            cit = res.scalars().first()

            if cit is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Citation '{citation_id}' not found.",
                )

            return CitationResponse(
                id=cit.id,
                query_id=cit.query_id,
                claim_id=cit.claim_id,
                evidence_id=cit.evidence_id,
                source_id=cit.source_id,
                inline_marker=cit.inline_marker,
                citation_index=cit.citation_index,
                claim_text=cit.claim.text if cit.claim else None,
                evidence_text=cit.evidence.text if cit.evidence else None,
                source_title=cit.source.title if cit.source else None,
                source_url=cit.source.url if cit.source else None,
            )
    except HTTPException:
        raise
    except Exception as exc:
        _logger.error("citation.get_failed", citation_id=citation_id, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve citation.",
        )


@router.get(
    "/claims/{claim_id}",
    response_model=ClaimResponse,
    summary="Get claim by ID",
    description="Retrieve an atomic claim with verification status, confidence, citations, and contradictions.",
)
async def get_claim_by_id(
    claim_id: str,
    request: Request,
    principal: Principal = Depends(get_current_principal),
) -> ClaimResponse:
    db_manager = _get_db_manager(request)

    try:
        async with db_manager.session() as session:
            stmt = (
                select(Claim)
                .where(Claim.id == claim_id)
                .options(
                    selectinload(Claim.citations).selectinload(Citation.evidence),
                    selectinload(Claim.citations).selectinload(Citation.source),
                    selectinload(Claim.contradictions),
                )
            )
            res = await session.execute(stmt)
            clm = res.scalars().first()

            if clm is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Claim '{claim_id}' not found.",
                )

            citations_list: list[CitationResponse] = []
            for cit in clm.citations:
                citations_list.append(
                    CitationResponse(
                        id=cit.id,
                        query_id=cit.query_id,
                        claim_id=cit.claim_id,
                        evidence_id=cit.evidence_id,
                        source_id=cit.source_id,
                        inline_marker=cit.inline_marker,
                        citation_index=cit.citation_index,
                        claim_text=clm.text,
                        evidence_text=cit.evidence.text if cit.evidence else None,
                        source_title=cit.source.title if cit.source else None,
                        source_url=cit.source.url if cit.source else None,
                    )
                )

            contradictions_list: list[ContradictionItem] = []
            for contra in clm.contradictions:
                contradictions_list.append(
                    ContradictionItem(
                        id=contra.id,
                        antithesis_claim_id=contra.antithesis_claim_id,
                        conflict_type=contra.conflict_type,
                        severity=contra.severity,
                        reasoning=contra.reasoning,
                        resolution_status=contra.resolution_status,
                    )
                )

            return ClaimResponse(
                id=clm.id,
                query_id=clm.query_id,
                text=clm.text,
                status=clm.status,
                confidence=clm.confidence,
                importance=clm.importance,
                sentence_index=clm.sentence_index,
                citations=citations_list,
                contradictions=contradictions_list,
            )
    except HTTPException:
        raise
    except Exception as exc:
        _logger.error("claim.get_failed", claim_id=claim_id, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve claim.",
        )
