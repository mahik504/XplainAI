"""Document parsers package."""

from __future__ import annotations

from neural_navigator.infrastructure.parsers.base import (
    DocumentParser,
    DocumentType,
    ParsedDocument,
    ParsedSection,
    ParsedSpan,
)
from neural_navigator.infrastructure.parsers.html import HTMLDocumentParser
from neural_navigator.infrastructure.parsers.image import ImageDocumentParser
from neural_navigator.infrastructure.parsers.markdown import MarkdownDocumentParser
from neural_navigator.infrastructure.parsers.pdf import PDFDocumentParser
from neural_navigator.infrastructure.parsers.registry import DocumentParserRegistry

__all__ = [
    "DocumentParser",
    "DocumentParserRegistry",
    "DocumentType",
    "HTMLDocumentParser",
    "ImageDocumentParser",
    "MarkdownDocumentParser",
    "PDFDocumentParser",
    "ParsedDocument",
    "ParsedSection",
    "ParsedSpan",
]
