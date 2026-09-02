"""Core interfaces and data structures for Deep Web Crawler subsystem."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any


def utc_now() -> datetime:
    return datetime.now(UTC)


class FetchStatus(StrEnum):
    SUCCESS = "success"
    ROBOTS_DISALLOWED = "robots_disallowed"
    RATE_LIMITED = "rate_limited"
    HTTP_ERROR = "http_error"
    TIMEOUT = "timeout"
    SSRF_BLOCKED = "ssrf_blocked"
    DEDUPLICATED = "deduplicated"
    PARSE_ERROR = "parse_error"


@dataclass(slots=True)
class CrawlRequest:
    url: str
    depth: int = 0
    max_depth: int = 1
    session_id: str | None = None
    allowed_domains: list[str] = field(default_factory=list)
    custom_headers: dict[str, str] = field(default_factory=dict)
    timeout_seconds: float = 10.0


@dataclass(slots=True)
class CrawledPage:
    url: str
    canonical_url: str
    status: FetchStatus
    status_code: int = 200
    content_type: str = "text/html"
    title: str = ""
    raw_html: str = ""
    extracted_text: str = ""
    content_hash: str = ""
    headers: dict[str, str] = field(default_factory=dict)
    links: list[str] = field(default_factory=list)
    fetch_duration_ms: float = 0.0
    crawled_at: datetime = field(default_factory=utc_now)
    error_message: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "url": self.url,
            "canonical_url": self.canonical_url,
            "status": self.status.value,
            "status_code": self.status_code,
            "content_type": self.content_type,
            "title": self.title,
            "raw_html": self.raw_html,
            "extracted_text": self.extracted_text,
            "content_hash": self.content_hash,
            "headers": self.headers,
            "links": self.links,
            "fetch_duration_ms": round(self.fetch_duration_ms, 2),
            "crawled_at": self.crawled_at.isoformat(),
            "error_message": self.error_message,
        }


class SearchProvider(ABC):
    """Abstract search provider interface."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier."""

    @abstractmethod
    async def search(
        self,
        query: str,
        *,
        max_results: int = 5,
        allowed_domains: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Execute search and return normalized result dictionaries."""
