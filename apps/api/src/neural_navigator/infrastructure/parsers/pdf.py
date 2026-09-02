"""PDF document parser using PyMuPDF (fitz) with spatial bounding box extraction."""

from __future__ import annotations

from typing import Any

from neural_navigator.domain.models.research import generate_id
from neural_navigator.infrastructure.parsers.base import (
    DocumentParser,
    DocumentType,
    ParsedDocument,
    ParsedSection,
    ParsedSpan,
)
from neural_navigator.orchestration.url_ingest import sanitize_untrusted_content

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None  # type: ignore[assignment]


class PDFDocumentParser(DocumentParser):
    """Parses PDF documents with page numbers, TOC outline, and spatial bounding boxes."""

    async def parse(
        self,
        content: str | bytes,
        *,
        source_url: str | None = None,
        title: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ParsedDocument:
        if fitz is None:
            raise RuntimeError("PyMuPDF (fitz) is required for PDF parsing")

        data = content.encode("utf-8") if isinstance(content, str) else content
        doc = fitz.open(stream=data, filetype="pdf")

        doc_title = title or doc.metadata.get("title") or "PDF Document"
        doc_author = doc.metadata.get("author")
        total_pages = len(doc)

        sections: list[ParsedSection] = []
        all_raw_text_parts: list[str] = []
        current_char_offset = 0

        # Try to extract TOC outlines if available
        toc = doc.get_toc()  # [[lvl, title, page], ...]
        toc_map: dict[int, str] = {item[2]: item[1] for item in toc} if toc else {}

        current_heading = doc_title
        current_level = 1
        current_section_path = [doc_title]
        current_section_spans: list[ParsedSpan] = []
        current_section_texts: list[str] = []

        for page_idx in range(total_pages):
            page_num = page_idx + 1
            page = doc[page_idx]

            # Check if this page starts a new TOC section
            if page_num in toc_map:
                if current_section_texts:
                    sec_text = "\n\n".join(current_section_texts)
                    sections.append(
                        ParsedSection(
                            heading=current_heading,
                            level=current_level,
                            content=sec_text,
                            section_path=list(current_section_path),
                            page_number=current_section_spans[0].page_number
                            if current_section_spans
                            else 1,
                            spans=list(current_section_spans),
                        )
                    )
                    current_section_spans.clear()
                    current_section_texts.clear()

                current_heading = toc_map[page_num]
                current_section_path = [doc_title, current_heading]

            # Extract blocks: (x0, y0, x1, y1, text, block_no, block_type)
            blocks = page.get_text("blocks")
            for block in blocks:
                # block_type 0 is text
                if len(block) >= 5 and block[6] == 0:
                    x0, y0, x1, y1, b_text = block[0], block[1], block[2], block[3], block[4]
                    cleaned_b = b_text.strip()
                    if not cleaned_b:
                        continue

                    b_len = len(cleaned_b)
                    span = ParsedSpan(
                        text=cleaned_b,
                        page_number=page_num,
                        bbox=(round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)),
                        char_start=current_char_offset,
                        char_end=current_char_offset + b_len,
                    )
                    current_section_spans.append(span)
                    current_section_texts.append(cleaned_b)
                    all_raw_text_parts.append(cleaned_b)
                    current_char_offset += b_len + 2

        # Final section flush
        if current_section_texts:
            sec_text = "\n\n".join(current_section_texts)
            sections.append(
                ParsedSection(
                    heading=current_heading,
                    level=current_level,
                    content=sec_text,
                    section_path=list(current_section_path),
                    page_number=current_section_spans[0].page_number
                    if current_section_spans
                    else 1,
                    spans=list(current_section_spans),
                )
            )

        full_raw_text = sanitize_untrusted_content("\n\n".join(all_raw_text_parts))
        doc_id = generate_id("doc")

        return ParsedDocument(
            doc_id=doc_id,
            title=doc_title,
            doc_type=DocumentType.PDF,
            raw_text=full_raw_text,
            sections=sections,
            source_url=source_url,
            author=doc_author,
            published_date=doc.metadata.get("creationDate"),
            total_pages=total_pages,
            total_characters=len(full_raw_text),
            metadata=metadata or {},
        )
