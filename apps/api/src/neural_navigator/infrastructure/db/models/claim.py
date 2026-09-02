"""Claim ORM entity representing atomic verifiable statements."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neural_navigator.infrastructure.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from neural_navigator.infrastructure.db.models.citation import Citation
    from neural_navigator.infrastructure.db.models.contradiction import Contradiction
    from neural_navigator.infrastructure.db.models.query import Query


class Claim(Base, TimestampMixin):
    __tablename__ = "claims"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # 'clm_...'
    query_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("queries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default="unverified",
        nullable=False,
        index=True,
    )  # supported | unverified | contradicted | weakly_supported
    confidence: Mapped[float] = mapped_column(Float, default=0.7, nullable=False)
    importance: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    sentence_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    query: Mapped[Query] = relationship("Query", back_populates="claims")
    citations: Mapped[list[Citation]] = relationship(
        "Citation",
        back_populates="claim",
        cascade="all, delete-orphan",
    )
    contradictions: Mapped[list[Contradiction]] = relationship(
        "Contradiction",
        back_populates="claim",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("idx_claims_query_status", "query_id", "status"),)
