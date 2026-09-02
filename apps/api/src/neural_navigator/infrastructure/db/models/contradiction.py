"""Contradiction ORM entity for conflicting evidence/claims."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neural_navigator.infrastructure.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from neural_navigator.infrastructure.db.models.claim import Claim
    from neural_navigator.infrastructure.db.models.evidence import Evidence
    from neural_navigator.infrastructure.db.models.query import Query


class Contradiction(Base, TimestampMixin):
    __tablename__ = "contradictions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # 'con_...'
    query_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("queries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    claim_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("claims.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    evidence_a_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("evidence.id", ondelete="CASCADE"),
        nullable=False,
    )
    evidence_b_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("evidence.id", ondelete="CASCADE"),
        nullable=False,
    )
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(50), default="moderate", nullable=False)
    contradiction_type: Mapped[str] = mapped_column(
        String(50), default="direct_negation", nullable=False
    )

    # Relationships
    query: Mapped[Query] = relationship("Query", back_populates="contradictions")
    claim: Mapped[Claim | None] = relationship("Claim", back_populates="contradictions")
    evidence_a: Mapped[Evidence] = relationship("Evidence", foreign_keys=[evidence_a_id])
    evidence_b: Mapped[Evidence] = relationship("Evidence", foreign_keys=[evidence_b_id])

    __table_args__ = (
        Index("idx_contradictions_query_severity", "query_id", "severity"),
        Index("idx_contradictions_type", "contradiction_type"),
    )
