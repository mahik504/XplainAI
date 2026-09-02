"""Citation ORM entity linking claims to evidence and sources."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neural_navigator.infrastructure.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from neural_navigator.infrastructure.db.models.claim import Claim
    from neural_navigator.infrastructure.db.models.evidence import Evidence
    from neural_navigator.infrastructure.db.models.query import Query
    from neural_navigator.infrastructure.db.models.source import Source


class Citation(Base, TimestampMixin):
    __tablename__ = "citations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # 'cit_...'
    query_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("queries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    claim_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("claims.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    evidence_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("evidence.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    inline_marker: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., '[1]'
    citation_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    query: Mapped[Query] = relationship("Query", back_populates="citations")
    claim: Mapped[Claim] = relationship("Claim", back_populates="citations")
    evidence: Mapped[Evidence] = relationship("Evidence", back_populates="citations")
    source: Mapped[Source] = relationship("Source", back_populates="citations")

    __table_args__ = (
        Index("idx_citations_query_claim", "query_id", "claim_id"),
        Index("idx_citations_claim_evidence", "claim_id", "evidence_id"),
    )
