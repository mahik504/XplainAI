"""Tool Execution Log ORM entity for governance and audit trails."""

from __future__ import annotations

from typing import Any

from sqlalchemy import JSON, Float, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from neural_navigator.infrastructure.db.base import Base, TimestampMixin


class ToolExecutionLogModel(Base, TimestampMixin):
    __tablename__ = "tool_execution_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # 'tax_...'
    tool_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    permission_used: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="ok", nullable=False)
    input_params: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    output_summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    duration_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    __table_args__ = (
        Index("idx_tool_audit_tool_user", "tool_name", "user_id"),
        Index("idx_tool_audit_session", "session_id"),
    )
