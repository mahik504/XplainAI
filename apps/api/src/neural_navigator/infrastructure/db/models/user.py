"""User / Principal ORM entity."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neural_navigator.infrastructure.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from neural_navigator.infrastructure.db.models.api_key import ApiKeyModel
    from neural_navigator.infrastructure.db.models.session import ResearchSession


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # e.g., 'usr_...' or 'anonymous'
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    preferences: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    sessions: Mapped[list[ResearchSession]] = relationship(
        "ResearchSession",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="desc(ResearchSession.updated_at)",
    )
    api_keys: Mapped[list[ApiKeyModel]] = relationship(
        "ApiKeyModel",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="desc(ApiKeyModel.created_at)",
    )
