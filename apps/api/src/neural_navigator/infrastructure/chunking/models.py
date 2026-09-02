"""DocumentChunk domain model with provenance tracking."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class DocumentChunk:
    """Granular retrieval unit with full provenance tracking."""

    id: str  # e.g. "chk_..."
    document_id: str  # e.g. "doc_..."
    source_id: str | None
    chunk_index: int
    title: str
    source_url: str | None
    content: str  # Clean chunk text
    searchable_text: str  # Section header enriched text for embedding
    section_title: str
    section_path: list[str] = field(default_factory=list)
    page_number: int | None = None
    bbox: tuple[float, float, float, float] | None = None
    char_start: int = 0
    char_end: int = 0
    token_count: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "document_id": self.document_id,
            "source_id": self.source_id,
            "chunk_index": self.chunk_index,
            "title": self.title,
            "source_url": self.source_url,
            "content": self.content,
            "searchable_text": self.searchable_text,
            "section_title": self.section_title,
            "section_path": self.section_path,
            "page_number": self.page_number,
            "bbox": list(self.bbox) if self.bbox else None,
            "char_start": self.char_start,
            "char_end": self.char_end,
            "token_count": self.token_count,
            "metadata": self.metadata,
        }
