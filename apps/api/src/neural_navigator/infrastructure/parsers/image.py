"""Image document parser with spatial bounding box and metadata extraction."""

from __future__ import annotations

from typing import Any

import structlog

from neural_navigator.domain.models.research import generate_id
from neural_navigator.infrastructure.parsers.base import (
    DocumentParser,
    DocumentType,
    ParsedDocument,
    ParsedSection,
    ParsedSpan,
)
from neural_navigator.orchestration.url_ingest import sanitize_untrusted_content

_logger = structlog.get_logger("neural_navigator.infrastructure.parsers.image")

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None  # type: ignore[assignment]


class ImageDocumentParser(DocumentParser):
    """Parses image documents (PNG, JPEG, WEBP, etc.) with spatial dimensions and text blocks."""

    async def parse(
        self,
        content: str | bytes,
        *,
        source_url: str | None = None,
        title: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ParsedDocument:
        data = content.encode("utf-8") if isinstance(content, str) else content
        doc_title = title or "Image Document"
        meta = dict(metadata or {})

        width = 800.0
        height = 600.0
        text_blocks: list[tuple[float, float, float, float, str]] = []
        raw_text_parts: list[str] = []

        if fitz is not None:
            try:
                # Attempt to open image with PyMuPDF
                doc = fitz.open(stream=data, filetype="image")
                if len(doc) > 0:
                    page = doc[0]
                    rect = page.rect
                    width = float(rect.width)
                    height = float(rect.height)
                    meta["width"] = width
                    meta["height"] = height
                    meta["format"] = doc.metadata.get("format", "image")

                    # Check for text / OCR blocks if available
                    blocks = page.get_text("blocks")
                    for b in blocks:
                        if len(b) >= 5 and b[6] == 0:
                            x0, y0, x1, y1, b_text = b[0], b[1], b[2], b[3], b[4]
                            cleaned = b_text.strip()
                            if cleaned:
                                text_blocks.append(
                                    (
                                        round(float(x0), 2),
                                        round(float(y0), 2),
                                        round(float(x1), 2),
                                        round(float(y1), 2),
                                        cleaned,
                                    )
                                )
                                raw_text_parts.append(cleaned)
            except Exception as exc:
                _logger.debug("image.fitz_open_skipped", error=str(exc))

        spans: list[ParsedSpan] = []
        char_offset = 0

        if text_blocks:
            for x0, y0, x1, y1, text in text_blocks:
                span = ParsedSpan(
                    text=text,
                    page_number=1,
                    bbox=(x0, y0, x1, y1),
                    char_start=char_offset,
                    char_end=char_offset + len(text),
                )
                spans.append(span)
                char_offset += len(text) + 2
            section_content = "\n\n".join(raw_text_parts)
        else:
            # Descriptive fallback span for images without embedded OCR text
            desc = f"[Image: {doc_title} | Dimensions: {int(width)}x{int(height)}]"
            span = ParsedSpan(
                text=desc,
                page_number=1,
                bbox=(0.0, 0.0, round(width, 2), round(height, 2)),
                char_start=0,
                char_end=len(desc),
            )
            spans.append(span)
            section_content = desc

        section = ParsedSection(
            heading=doc_title,
            level=1,
            content=section_content,
            section_path=[doc_title],
            page_number=1,
            spans=spans,
        )

        full_raw_text = sanitize_untrusted_content(section_content)
        doc_id = generate_id("doc")

        return ParsedDocument(
            doc_id=doc_id,
            title=doc_title,
            doc_type=DocumentType.IMAGE,
            raw_text=full_raw_text,
            sections=[section],
            source_url=source_url,
            total_pages=1,
            total_characters=len(full_raw_text),
            metadata=meta,
        )
