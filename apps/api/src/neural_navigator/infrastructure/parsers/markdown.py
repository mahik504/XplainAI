"""Markdown document parser capturing header hierarchy and code blocks."""

from __future__ import annotations

import re
from typing import Any

from neural_navigator.domain.models.research import generate_id
from neural_navigator.infrastructure.parsers.base import (
    DocumentParser,
    DocumentType,
    ParsedDocument,
    ParsedSection,
    ParsedSpan,
)

_HEADER_REGEX = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)


class MarkdownDocumentParser(DocumentParser):
    """Parses raw Markdown documents preserving section hierarchy and provenance."""

    async def parse(
        self,
        content: str | bytes,
        *,
        source_url: str | None = None,
        title: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ParsedDocument:
        md_text = (
            content.decode("utf-8", errors="replace") if isinstance(content, bytes) else content
        )
        cleaned_text = re.sub(
            r"(?i)\b(ignore\s+(all\s+)?previous\s+instructions|system\s+prompt|you\s+are\s+now|new\s+instruction)\b",
            "[SANITIZED_INSTRUCTION]",
            md_text,
        )[:200_000]

        # Detect document title from first H1 if available
        first_h1 = re.search(r"^#\s+(.+)$", cleaned_text, re.MULTILINE)
        doc_title = title or (first_h1.group(1).strip() if first_h1 else "Markdown Document")

        matches = list(_HEADER_REGEX.finditer(cleaned_text))
        sections: list[ParsedSection] = []

        if not matches:
            span = ParsedSpan(
                text=cleaned_text, page_number=1, char_start=0, char_end=len(cleaned_text)
            )
            sections.append(
                ParsedSection(
                    heading=doc_title,
                    level=1,
                    content=cleaned_text,
                    section_path=[doc_title],
                    page_number=1,
                    spans=[span],
                )
            )
        else:
            path_stack: list[tuple[int, str]] = [(1, doc_title)]

            # Leading content before first header
            if matches[0].start() > 0:
                preamble = cleaned_text[: matches[0].start()].strip()
                if preamble:
                    sections.append(
                        ParsedSection(
                            heading="Overview",
                            level=1,
                            content=preamble,
                            section_path=[doc_title, "Overview"],
                            page_number=1,
                            spans=[
                                ParsedSpan(
                                    text=preamble,
                                    page_number=1,
                                    char_start=0,
                                    char_end=matches[0].start(),
                                )
                            ],
                        )
                    )

            for i, match in enumerate(matches):
                level = len(match.group(1))
                heading = match.group(2).strip()
                c_start = match.end()
                c_end = matches[i + 1].start() if i + 1 < len(matches) else len(cleaned_text)
                section_body = cleaned_text[c_start:c_end].strip()

                while path_stack and path_stack[-1][0] >= level:
                    path_stack.pop()
                path_stack.append((level, heading))
                current_path = [doc_title] + [p[1] for p in path_stack if p[1] != doc_title]

                span = ParsedSpan(
                    text=section_body,
                    page_number=1,
                    char_start=c_start,
                    char_end=c_end,
                )
                sections.append(
                    ParsedSection(
                        heading=heading,
                        level=level,
                        content=section_body,
                        section_path=current_path,
                        page_number=1,
                        spans=[span],
                    )
                )

        doc_id = generate_id("doc")
        return ParsedDocument(
            doc_id=doc_id,
            title=doc_title,
            doc_type=DocumentType.MARKDOWN,
            raw_text=cleaned_text,
            sections=sections,
            source_url=source_url,
            total_pages=1,
            total_characters=len(cleaned_text),
            metadata=metadata or {},
        )
