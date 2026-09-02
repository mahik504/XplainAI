"""Document Parser Registry for content-type based parsing dispatch."""

from __future__ import annotations

from typing import Any

from neural_navigator.infrastructure.parsers.base import (
    DocumentParser,
    DocumentType,
    ParsedDocument,
)
from neural_navigator.infrastructure.parsers.html import HTMLDocumentParser
from neural_navigator.infrastructure.parsers.image import ImageDocumentParser
from neural_navigator.infrastructure.parsers.markdown import MarkdownDocumentParser
from neural_navigator.infrastructure.parsers.pdf import PDFDocumentParser


class DocumentParserRegistry:
    """Dispatches parsing requests to format-specific document parsers."""

    def __init__(self) -> None:
        self._parsers: dict[DocumentType, DocumentParser] = {
            DocumentType.HTML: HTMLDocumentParser(),
            DocumentType.PDF: PDFDocumentParser(),
            DocumentType.MARKDOWN: MarkdownDocumentParser(),
            DocumentType.TEXT: MarkdownDocumentParser(),
            DocumentType.IMAGE: ImageDocumentParser(),
        }

    def register_parser(self, doc_type: DocumentType, parser: DocumentParser) -> None:
        self._parsers[doc_type] = parser

    def detect_type(
        self,
        content: str | bytes,
        mime_type: str | None = None,
        url_or_filename: str | None = None,
    ) -> DocumentType:
        """Detect document type from MIME type, extension, or content inspection."""
        if mime_type:
            m = mime_type.lower()
            if "pdf" in m:
                return DocumentType.PDF
            if any(t in m for t in ("image", "png", "jpeg", "jpg", "webp", "gif", "bmp", "tiff")):
                return DocumentType.IMAGE
            if "html" in m or "xhtml" in m:
                return DocumentType.HTML
            if "markdown" in m or "md" in m:
                return DocumentType.MARKDOWN

        if url_or_filename:
            fn = url_or_filename.lower().split("?")[0]
            if fn.endswith(".pdf"):
                return DocumentType.PDF
            if fn.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff", ".svg")):
                return DocumentType.IMAGE
            if fn.endswith((".html", ".htm")):
                return DocumentType.HTML
            if fn.endswith((".md", ".markdown")):
                return DocumentType.MARKDOWN

        # Inspect bytes magic numbers
        if isinstance(content, bytes):
            if content.startswith(b"%PDF-"):
                return DocumentType.PDF
            if (
                content.startswith(b"\x89PNG\r\n\x1a\n")
                or content.startswith(b"\xff\xd8\xff")
                or content.startswith(b"GIF87a")
                or content.startswith(b"GIF89a")
                or content.startswith(b"RIFF")
                or content.startswith(b"BM")
            ):
                return DocumentType.IMAGE
            if b"<html" in content[:500].lower() or b"<!doctype html" in content[:500].lower():
                return DocumentType.HTML

        if isinstance(content, str) and (
            "<html" in content[:500].lower() or "<!doctype html" in content[:500].lower()
        ):
            return DocumentType.HTML

        return DocumentType.MARKDOWN

    async def parse(
        self,
        content: str | bytes,
        *,
        mime_type: str | None = None,
        source_url: str | None = None,
        title: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ParsedDocument:
        """Automatically detect format and parse into a standard ParsedDocument."""
        doc_type = self.detect_type(content, mime_type=mime_type, url_or_filename=source_url)
        parser = self._parsers.get(doc_type, self._parsers[DocumentType.MARKDOWN])
        return await parser.parse(
            content,
            source_url=source_url,
            title=title,
            metadata=metadata,
        )
