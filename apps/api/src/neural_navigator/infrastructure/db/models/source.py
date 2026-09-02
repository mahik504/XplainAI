"""Source ORM entity representing authoritative research origins."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neural_navigator.infrastructure.db.base import Base, TimestampMixin, utc_now

if TYPE_CHECKING:
    from neural_navigator.infrastructure.db.models.citation import Citation
    from neural_navigator.infrastructure.db.models.document import Document
    from neural_navigator.infrastructure.db.models.evidence import Evidence
    from neural_navigator.infrastructure.db.models.session import ResearchSession


class Source(Base, TimestampMixin):
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # 'src_...'
    session_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    url_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # SHA-256
    canonical_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(
        String(50), default="web", nullable=False
    )  # web, paper, doc
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    published_date: Mapped[str | None] = mapped_column(String(100), nullable=True)
    authority_score: Mapped[float] = mapped_column(Float, default=0.8, nullable=False)
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    session: Mapped[ResearchSession] = relationship("ResearchSession", back_populates="sources")
    documents: Mapped[list[Document]] = relationship(
        "Document",
        back_populates="source",
        cascade="all, delete-orphan",
    )
    evidence_items: Mapped[list[Evidence]] = relationship(
        "Evidence",
        back_populates="source",
        cascade="all, delete-orphan",
    )
    citations: Mapped[list[Citation]] = relationship(
        "Citation",
        back_populates="source",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_sources_session_domain", "session_id", "domain"),
        Index("idx_sources_url_hash", "url_hash"),
    )
