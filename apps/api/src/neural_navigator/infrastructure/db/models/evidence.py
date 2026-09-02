"""Evidence ORM entity representing verified text passages."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neural_navigator.infrastructure.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from neural_navigator.infrastructure.db.models.chunks import DocumentChunkModel
    from neural_navigator.infrastructure.db.models.citation import Citation
    from neural_navigator.infrastructure.db.models.document import Document
    from neural_navigator.infrastructure.db.models.source import Source


class Evidence(Base, TimestampMixin):
    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # 'evi_...'
    source_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    chunk_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("document_chunks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.85, nullable=False)
    relevance_score: Mapped[float] = mapped_column(Float, default=0.85, nullable=False)
    char_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    char_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bounding_box: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True
    )  # for spatial PDF citations

    # Relationships
    source: Mapped[Source] = relationship("Source", back_populates="evidence_items")
    document: Mapped[Document | None] = relationship("Document", back_populates="evidence_items")
    chunk: Mapped[DocumentChunkModel | None] = relationship(
        "DocumentChunkModel", back_populates="evidence_items"
    )
    citations: Mapped[list[Citation]] = relationship(
        "Citation",
        back_populates="evidence",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_evidence_source_id", "source_id"),
        Index("idx_evidence_document_id", "document_id"),
        Index("idx_evidence_chunk_id", "chunk_id"),
    )
