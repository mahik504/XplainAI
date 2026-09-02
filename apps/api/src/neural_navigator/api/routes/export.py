"""REST API endpoints for research session exports and structured Evidence Packs."""

from __future__ import annotations

from typing import Annotated, Any

import structlog
from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse

from neural_navigator.orchestration.exporters import (
    EvidencePackExporter,
    MarkdownExporter,
    PDFExporter,
)
from neural_navigator.services.conversations import ConversationStore

_logger = structlog.get_logger("neural_navigator.api.routes.export")

router = APIRouter(prefix="/sessions", tags=["export"])


async def _resolve_session_data(request: Request, session_id: str) -> dict[str, Any]:
    """Extract full research orchestration state for a given session ID."""
    store: ConversationStore | None = getattr(request.app.state, "conversation_store", None)
    conv_payload: dict[str, Any] | None = None

    if store is not None:
        conv_payload = store.get(session_id)

    if conv_payload is not None:
        messages = conv_payload.get("messages", [])
        latest_pipeline: dict[str, Any] = {}
        answer_parts: list[str] = []

        for msg in messages:
            if msg.get("role") == "assistant":
                if msg.get("content"):
                    answer_parts.append(msg["content"])
                if msg.get("pipeline_state"):
                    latest_pipeline = msg["pipeline_state"]

        combined_answer = "\n\n".join(answer_parts) if answer_parts else ""

        session_data: dict[str, Any] = {
            "id": conv_payload["id"],
            "session_id": conv_payload["id"],
            "title": conv_payload.get("title", "Autonomous Research Report"),
            "created_at": conv_payload.get("created_at"),
            "updated_at": conv_payload.get("updated_at"),
            "answer_text": combined_answer,
            "synthesis": combined_answer,
            "mode": latest_pipeline.get("mode", "deep_research"),
            "egi_score": latest_pipeline.get("egi_score", 0.85),
            "trust_metrics": latest_pipeline.get("trust_metrics", {}),
            "domain_sources": latest_pipeline.get("domain_sources") or latest_pipeline.get("sources", []),
            "domain_evidence": latest_pipeline.get("domain_evidence") or latest_pipeline.get("evidence", []),
            "domain_claims": latest_pipeline.get("domain_claims") or latest_pipeline.get("claims", []),
            "domain_citations": latest_pipeline.get("domain_citations") or latest_pipeline.get("citations", []),
            "domain_graph": latest_pipeline.get("domain_graph") or latest_pipeline.get("graph", {}),
            "contradictions": latest_pipeline.get("contradictions", []),
            "assumptions": latest_pipeline.get("assumptions", []),
        }
        return session_data

    # Attempt PostgreSQL session repository resolution if DB manager is active
    db_manager = getattr(request.app.state, "db_manager", None)
    if db_manager is not None:
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        from neural_navigator.infrastructure.db.models.session import ResearchSession

        try:
            async with db_manager.session() as db:
                stmt = (
                    select(ResearchSession)
                    .where(ResearchSession.id == session_id)
                    .options(
                        selectinload(ResearchSession.queries),
                        selectinload(ResearchSession.sources),
                    )
                )
                result = await db.execute(stmt)
                db_session = result.scalar_one_or_none()
                if db_session is not None:
                    latest_query = db_session.queries[-1] if db_session.queries else None
                    answer_text = latest_query.synthesized_text or latest_query.content if latest_query else ""
                    return {
                        "id": db_session.id,
                        "session_id": db_session.id,
                        "title": db_session.title,
                        "created_at": str(db_session.created_at),
                        "updated_at": str(db_session.updated_at),
                        "answer_text": answer_text,
                        "synthesis": answer_text,
                        "mode": db_session.mode,
                        "egi_score": latest_query.egi_score if latest_query and latest_query.egi_score is not None else 0.85,
                        "trust_metrics": {},
                        "domain_sources": [
                            {"id": s.id, "title": s.title, "url": s.url, "domain": s.domain, "authority_score": s.authority_score}
                            for s in db_session.sources
                        ],
                        "domain_evidence": [],
                        "domain_claims": [],
                        "domain_citations": [],
                        "domain_graph": {},
                        "contradictions": [],
                        "assumptions": [],
                    }
        except Exception as exc:
            _logger.debug("export.db_lookup_failed", session_id=session_id, error=str(exc))

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Research session '{session_id}' was not found.",
    )


@router.get(
    "/{session_id}/export",
    summary="Export research session as Markdown or PDF",
    description="Generates publication-grade research synthesis dossiers in Markdown (.md) or PDF (.pdf) format.",
    responses={
        200: {
            "content": {
                "text/markdown": {},
                "application/pdf": {},
            },
            "description": "Formatted research report file download",
        },
        400: {"description": "Invalid format requested"},
        404: {"description": "Session not found"},
    },
)
async def export_session(
    session_id: str,
    request: Request,
    export_format: Annotated[
        str,
        Query(
            alias="format",
            description="Desired export format: 'markdown' (or 'md') or 'pdf'",
        ),
    ] = "markdown",
) -> Response:
    fmt = export_format.lower().strip()
    if fmt not in {"markdown", "md", "pdf"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported export format '{export_format}'. Supported formats are: markdown, pdf.",
        )

    session_data = await _resolve_session_data(request, session_id)

    if fmt in {"markdown", "md"}:
        content_md = MarkdownExporter.export(session_data)
        return Response(
            content=content_md,
            media_type="text/markdown; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="research_session_{session_id}.md"'
            },
        )

    # PDF format
    try:
        pdf_bytes = PDFExporter.export(session_data)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="research_session_{session_id}.pdf"'
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF export: {exc}",
        ) from exc


@router.get(
    "/{session_id}/evidence-pack",
    summary="Download complete JSON Evidence Pack",
    description="Exports complete structured JSON Evidence Pack containing claims, evidence snippets, bounding boxes, sources, EGI 2.0 scores, and trust metrics.",
    response_class=JSONResponse,
    responses={
        200: {"description": "Structured JSON Evidence Pack bundle"},
        404: {"description": "Session not found"},
    },
)
async def export_evidence_pack(
    session_id: str,
    request: Request,
) -> JSONResponse:
    session_data = await _resolve_session_data(request, session_id)
    pack = EvidencePackExporter.export(session_data)
    return JSONResponse(
        content=pack,
        headers={
            "Content-Disposition": f'attachment; filename="evidence_pack_{session_id}.json"'
        },
    )
