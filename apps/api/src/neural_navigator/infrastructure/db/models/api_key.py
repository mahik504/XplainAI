"""ApiKey ORM entity for Developer API authentication and multi-tenant quotas."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neural_navigator.infrastructure.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from neural_navigator.infrastructure.db.models.user import User


class ApiKeyModel(Base, TimestampMixin):
    """Developer API Key entity for programmatic access."""

    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # 'key_...'
    user_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="default_tenant",
        index=True,
    )
    key_hash: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tier: Mapped[str] = mapped_column(String(50), default="free", nullable=False)  # free, pro, enterprise
    scopes: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    rate_limit: Mapped[int] = mapped_column(Integer, default=300, nullable=False)  # RPM
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="api_keys", lazy="selectin")

    __table_args__ = (
        Index("idx_api_keys_tenant_user", "tenant_id", "user_id"),
        Index("idx_api_keys_active_tier", "is_active", "tier"),
    )


# Compatibility alias
ApiKey = ApiKeyModel
