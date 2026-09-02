"""Multimodal document ingestion API endpoints for PDF and image uploads."""

from __future__ import annotations

from typing import Annotated

import structlog
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field

from neural_navigator.infrastructure.chunking.chunker import MetadataAwareChunker
from neural_navigator.infrastructure.parsers.registry import DocumentParserRegistry

_logger = structlog.get_logger("neural_navigator.api.routes.documents")

router = APIRouter(prefix="/documents", tags=["documents"])


class DocumentUploadResponse(BaseModel):
    document_id: str = Field(description="Unique document identifier")
    title: str = Field(description="Document or file title")
    page_count: int = Field(description="Total pages extracted")
    chunk_count: int = Field(description="Total chunks generated with bounding box metadata")
    status: str = Field(default="indexed", description="Ingestion index status")


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and index multimodal document",
    description="Accepts multipart PDF or image files, extracts spatial bounding boxes, and generates vector-ready chunks.",
)
async def upload_document(
    request: Request,
    file: Annotated[UploadFile, File(description="Multipart PDF or image file")],
    session_id: Annotated[str | None, Form(description="Optional target research session ID")] = None,
    title: Annotated[str | None, Form(description="Optional override title")] = None,
) -> DocumentUploadResponse:
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename must be provided in multipart upload.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # 50MB file size limit
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum permitted limit (50MB).",
        )

    doc_title = title or file.filename
    registry = DocumentParserRegistry()

    try:
        parsed_doc = await registry.parse(
            content=content,
            mime_type=file.content_type,
            source_url=file.filename,
            title=doc_title,
            metadata={"session_id": session_id, "content_type": file.content_type},
        )
    except Exception as exc:
        _logger.error("document.parse_failed", filename=file.filename, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse document: {exc}",
        ) from exc

    chunker = MetadataAwareChunker()
    chunks = chunker.chunk_document(parsed_doc, source_id=session_id)

    # Store in vector store if available on app.state
    vector_store = getattr(request.app.state, "vector_store", None)
    if vector_store is not None:
        try:
            await vector_store.add_chunks(chunks)
        except Exception as exc:
            _logger.warning("document.vector_indexing_failed", error=str(exc))

    return DocumentUploadResponse(
        document_id=parsed_doc.doc_id,
        title=parsed_doc.title,
        page_count=parsed_doc.total_pages or 1,
        chunk_count=len(chunks),
        status="indexed",
    )
