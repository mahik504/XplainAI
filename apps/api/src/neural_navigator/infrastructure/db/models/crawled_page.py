"""Crawled Page ORM entity for web crawler state and cache persistence."""

from __future__ import annotations

from sqlalchemy import Float, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from neural_navigator.infrastructure.db.base import Base, TimestampMixin


class CrawledPageModel(Base, TimestampMixin):
    __tablename__ = "crawled_pages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # 'crw_...'
    url: Mapped[str] = mapped_column(Text, nullable=False)
    url_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="success", nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, default=200, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    duration_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    __table_args__ = (
        Index("idx_crawled_pages_url_hash", "url_hash"),
        Index("idx_crawled_pages_content_hash", "content_hash"),
    )
