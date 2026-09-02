"""Query / Research Turn ORM entity (formerly message)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neural_navigator.infrastructure.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from neural_navigator.infrastructure.db.models.citation import Citation
    from neural_navigator.infrastructure.db.models.claim import Claim
    from neural_navigator.infrastructure.db.models.contradiction import Contradiction
    from neural_navigator.infrastructure.db.models.session import ResearchSession
    from neural_navigator.infrastructure.db.models.topology import EvidenceGraphTopology


class Query(Base, TimestampMixin):
    __tablename__ = "queries"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # 'qry_...'
    session_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user | assistant | system
    content: Mapped[str] = mapped_column(Text, nullable=False)
    synthesized_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Query Analysis metadata
    intent: Mapped[str | None] = mapped_column(String(50), nullable=True)
    domain: Mapped[str | None] = mapped_column(String(50), nullable=True)
    complexity: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Trust & Verification
    egi_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="completed", nullable=False)

    # Telemetry & Diagnostics (JSONB in Postgres)
    token_usage: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    stage_timings: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    session: Mapped[ResearchSession] = relationship("ResearchSession", back_populates="queries")
    claims: Mapped[list[Claim]] = relationship(
        "Claim",
        back_populates="query",
        cascade="all, delete-orphan",
        order_by="Claim.sentence_index.asc()",
    )
    citations: Mapped[list[Citation]] = relationship(
        "Citation",
        back_populates="query",
        cascade="all, delete-orphan",
    )
    contradictions: Mapped[list[Contradiction]] = relationship(
        "Contradiction",
        back_populates="query",
        cascade="all, delete-orphan",
    )
    topology: Mapped[EvidenceGraphTopology | None] = relationship(
        "EvidenceGraphTopology",
        back_populates="query",
        uselist=False,
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("idx_queries_session_created", "session_id", "created_at"),)
