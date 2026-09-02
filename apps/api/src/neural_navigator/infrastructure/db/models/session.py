"""ResearchSession ORM entity (formerly conversation)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neural_navigator.infrastructure.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from neural_navigator.infrastructure.db.models.document import Document
    from neural_navigator.infrastructure.db.models.query import Query
    from neural_navigator.infrastructure.db.models.source import Source
    from neural_navigator.infrastructure.db.models.user import User


class ResearchSession(Base, TimestampMixin):
    __tablename__ = "research_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # 'ses_...' or UUID
    user_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="New research")
    mode: Mapped[str] = mapped_column(String(50), nullable=False, default="deep_research")
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="active"
    )  # active, archived, completed
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="sessions")
    queries: Mapped[list[Query]] = relationship(
        "Query",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Query.created_at.asc()",
    )
    sources: Mapped[list[Source]] = relationship(
        "Source",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    documents: Mapped[list[Document]] = relationship(
        "Document",
        back_populates="session",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("idx_sessions_user_updated", "user_id", "updated_at"),)
