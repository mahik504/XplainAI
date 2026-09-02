"""Document Chunk ORM entity for pgvector embeddings and full-text search."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neural_navigator.infrastructure.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from neural_navigator.infrastructure.db.models.document import Document
    from neural_navigator.infrastructure.db.models.evidence import Evidence
    from neural_navigator.infrastructure.db.models.session import ResearchSession
    from neural_navigator.infrastructure.db.models.source import Source


class DocumentChunkModel(Base, TimestampMixin):
    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # 'chk_...'
    document_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("sources.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    session_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    searchable_text: Mapped[str] = mapped_column(Text, nullable=False)
    section_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    section_path: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bbox: Mapped[list[float] | None] = mapped_column(JSON, nullable=True)
    char_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    char_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # 1536-dim vector for OpenAI / embeddings
    embedding: Mapped[list[float]] = mapped_column(
        Vector(1536).with_variant(JSON(), "sqlite"), nullable=False
    )
    tsv: Mapped[Any | None] = mapped_column(
        TSVECTOR().with_variant(Text(), "sqlite"), nullable=True
    )

    # Relationships
    document: Mapped[Document] = relationship("Document")
    source: Mapped[Source | None] = relationship("Source")
    session: Mapped[ResearchSession | None] = relationship("ResearchSession")
    evidence_items: Mapped[list[Evidence]] = relationship(
        "Evidence", back_populates="chunk"
    )

    __table_args__ = (
        Index(
            "idx_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index("idx_chunks_tsv_gin", "tsv", postgresql_using="gin"),
        Index("idx_chunks_session_doc", "session_id", "document_id"),
    )
