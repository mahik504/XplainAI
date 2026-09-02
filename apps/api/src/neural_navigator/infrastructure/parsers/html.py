"""HTML document parser using trafilatura with BeautifulSoup4 fallback."""

from __future__ import annotations

import re
from typing import Any

import structlog
from bs4 import BeautifulSoup

from neural_navigator.domain.models.research import generate_id
from neural_navigator.infrastructure.parsers.base import (
    DocumentParser,
    DocumentType,
    ParsedDocument,
    ParsedSection,
    ParsedSpan,
)

_logger = structlog.get_logger(__name__)

try:
    import trafilatura
except ImportError:
    trafilatura = None  # type: ignore[assignment]

_HEADER_PATTERN = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)


class HTMLDocumentParser(DocumentParser):
    """Parses raw HTML web pages into clean, hierarchical markdown sections."""

    async def parse(
        self,
        content: str | bytes,
        *,
        source_url: str | None = None,
        title: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ParsedDocument:
        html_str = (
            content.decode("utf-8", errors="replace") if isinstance(content, bytes) else content
        )

        extracted_text = ""
        doc_title = title or "Web Page"
        doc_author = None
        doc_date = None

        # 1. Try Trafilatura extraction
        if trafilatura is not None:
            try:
                trafil_text = trafilatura.extract(
                    html_str,
                    include_links=True,
                    include_tables=True,
                    output_format="markdown",
                    url=source_url,
                )
                if trafil_text and _HEADER_PATTERN.search(trafil_text):
                    extracted_text = trafil_text
                meta = trafilatura.extract_metadata(html_str)
                if meta:
                    if not title and meta.title:
                        doc_title = meta.title
                    doc_author = meta.author
                    doc_date = meta.date
            except Exception as exc:
                _logger.debug("html_parser.trafilatura_failed", error=str(exc))

        # 2. Fallback to BeautifulSoup if Trafilatura failed or had no headings
        if not extracted_text:
            soup = BeautifulSoup(html_str, "html.parser")
            # Remove scripts, styles, iframes
            for tag in soup(["script", "style", "nav", "footer", "iframe", "noscript"]):
                tag.decompose()
            if not title and soup.title and soup.title.string:
                doc_title = soup.title.string.strip()

            # Extract headings and paragraphs as markdown
            parts: list[str] = []
            for elem in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"]):
                text_val = elem.get_text().strip()
                if not text_val:
                    continue
                if elem.name.startswith("h"):
                    lvl = int(elem.name[1])
                    parts.append(f"\n\n{'#' * lvl} {text_val}\n")
                else:
                    parts.append(f"\n{text_val}\n")
            extracted_text = "\n".join(parts) if parts else soup.get_text(separator="\n\n")

        # 3. Sanitize prompt injections while preserving newlines
        cleaned_text = re.sub(
            r"(?i)\b(ignore\s+(all\s+)?previous\s+instructions|system\s+prompt|you\s+are\s+now|new\s+instruction)\b",
            "[SANITIZED_INSTRUCTION]",
            extracted_text,
        )

        # 4. Parse into logical sections based on headers
        sections = self._extract_sections(cleaned_text, doc_title)

        doc_id = generate_id("doc")
        return ParsedDocument(
            doc_id=doc_id,
            title=doc_title,
            doc_type=DocumentType.HTML,
            raw_text=cleaned_text,
            sections=sections,
            source_url=source_url,
            author=doc_author,
            published_date=doc_date,
            total_pages=1,
            total_characters=len(cleaned_text),
            metadata=metadata or {},
        )

    def _extract_sections(self, text: str, root_title: str) -> list[ParsedSection]:
        """Split text into hierarchical sections based on Markdown headers."""
        matches = list(_HEADER_PATTERN.finditer(text))
        if not matches:
            # Single root section
            span = ParsedSpan(text=text, page_number=1, char_start=0, char_end=len(text))
            return [
                ParsedSection(
                    heading=root_title,
                    level=1,
                    content=text,
                    section_path=[root_title],
                    page_number=1,
                    spans=[span],
                )
            ]

        sections: list[ParsedSection] = []
        path_stack: list[tuple[int, str]] = [(1, root_title)]

        # Text before first header
        first_start = matches[0].start()
        if first_start > 0:
            preamble = text[:first_start].strip()
            if preamble:
                sections.append(
                    ParsedSection(
                        heading="Introduction",
                        level=1,
                        content=preamble,
                        section_path=[root_title, "Introduction"],
                        page_number=1,
                        spans=[
                            ParsedSpan(
                                text=preamble, page_number=1, char_start=0, char_end=first_start
                            )
                        ],
                    )
                )

        for i, match in enumerate(matches):
            header_level = len(match.group(1))
            heading_text = match.group(2).strip()
            content_start = match.end()
            content_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            section_content = text[content_start:content_end].strip()

            # Update section path hierarchy stack
            while path_stack and path_stack[-1][0] >= header_level:
                path_stack.pop()
            path_stack.append((header_level, heading_text))
            current_path = [root_title] + [p[1] for p in path_stack if p[1] != root_title]

            span = ParsedSpan(
                text=section_content,
                page_number=1,
                char_start=content_start,
                char_end=content_end,
            )
            sections.append(
                ParsedSection(
                    heading=heading_text,
                    level=header_level,
                    content=section_content,
                    section_path=current_path,
                    page_number=1,
                    spans=[span],
                )
            )

        return sections
