"""Base domain models and interface for document parsers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class DocumentType(StrEnum):
    HTML = "html"
    PDF = "pdf"
    MARKDOWN = "markdown"
    TEXT = "text"
    CODE = "code"
    IMAGE = "image"


@dataclass(slots=True)
class ParsedSpan:
    """A granular span of text with location metadata for exact citation highlighting."""

    text: str
    page_number: int | None = None
    bbox: tuple[float, float, float, float] | None = None  # (x0, y0, x1, y1)
    char_start: int | None = None
    char_end: int | None = None


@dataclass(slots=True)
class ParsedSection:
    """A logical section within a document, bounded by a heading."""

    heading: str
    level: int  # 1 for H1, 2 for H2, 3 for H3, 0 for root/preamble
    content: str
    section_path: list[str] = field(default_factory=list)
    page_number: int | None = None
    spans: list[ParsedSpan] = field(default_factory=list)


@dataclass(slots=True)
class ParsedDocument:
    """Standardized representation of an ingested document across HTML, PDF, Markdown."""

    doc_id: str
    title: str
    doc_type: DocumentType
    raw_text: str
    sections: list[ParsedSection] = field(default_factory=list)
    source_url: str | None = None
    author: str | None = None
    published_date: str | None = None
    total_pages: int | None = None
    total_characters: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)


class DocumentParser(ABC):
    """Abstract interface for format-specific document parsers."""

    @abstractmethod
    async def parse(
        self,
        content: str | bytes,
        *,
        source_url: str | None = None,
        title: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ParsedDocument:
        """Parse raw content (bytes or text) into a structured ParsedDocument."""
        pass
