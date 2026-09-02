"""Document ORM entity for full raw content and parsed text."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neural_navigator.infrastructure.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from neural_navigator.infrastructure.db.models.evidence import Evidence
    from neural_navigator.infrastructure.db.models.session import ResearchSession
    from neural_navigator.infrastructure.db.models.source import Source


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # 'doc_...'
    source_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("sources.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    session_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content_type: Mapped[str] = mapped_column(String(100), default="text/html", nullable=False)
    raw_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    cleaned_text: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    char_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    source: Mapped[Source | None] = relationship("Source", back_populates="documents")
    session: Mapped[ResearchSession] = relationship("ResearchSession", back_populates="documents")
    evidence_items: Mapped[list[Evidence]] = relationship(
        "Evidence",
        back_populates="document",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("idx_documents_session_hash", "session_id", "content_hash"),)
