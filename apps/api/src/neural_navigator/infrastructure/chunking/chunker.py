"""Hierarchical, metadata-aware chunker with sentence-boundary preservation."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from neural_navigator.domain.models.research import generate_id
from neural_navigator.infrastructure.chunking.models import DocumentChunk

if TYPE_CHECKING:
    from neural_navigator.infrastructure.parsers.base import ParsedDocument, ParsedSection, ParsedSpan

_SENTENCE_SPLIT_REGEX = re.compile(r"(?<=[.!?])\s+")


def _compute_enclosing_bbox(spans: list[ParsedSpan]) -> tuple[float, float, float, float] | None:
    """Compute the bounding box union enclosing all provided spans."""
    valid_boxes = [s.bbox for s in spans if s.bbox is not None]
    if not valid_boxes:
        return None
    min_x0 = min(b[0] for b in valid_boxes)
    min_y0 = min(b[1] for b in valid_boxes)
    max_x1 = max(b[2] for b in valid_boxes)
    max_y1 = max(b[3] for b in valid_boxes)
    return (round(min_x0, 2), round(min_y0, 2), round(max_x1, 2), round(max_y1, 2))


class MetadataAwareChunker:
    """Chunks structured ParsedDocument objects preserving section headers, page numbers, and offsets."""

    def __init__(
        self,
        *,
        chunk_size: int | None = None,
        target_chunk_size: int = 800,
        chunk_overlap: int = 150,
        max_chunk_size: int | None = None,
        min_chunk_size: int = 100,
    ) -> None:
        self.target_chunk_size = chunk_size if chunk_size is not None else target_chunk_size
        self.chunk_overlap = chunk_overlap
        self.max_chunk_size = (
            max_chunk_size
            if max_chunk_size is not None
            else int(self.target_chunk_size * 1.4)
        )
        self.min_chunk_size = min_chunk_size

    def chunk_document(
        self,
        doc: ParsedDocument,
        *,
        source_id: str | None = None,
    ) -> list[DocumentChunk]:
        """Convert a ParsedDocument into an ordered list of enriched DocumentChunk items."""
        chunks: list[DocumentChunk] = []
        chunk_idx = 0

        for section in doc.sections:
            sec_chunks = self._chunk_section(
                section,
                doc_id=doc.doc_id,
                doc_title=doc.title,
                source_url=doc.source_url,
                source_id=source_id,
                start_index=chunk_idx,
            )
            chunks.extend(sec_chunks)
            chunk_idx += len(sec_chunks)

        return chunks

    def _resolve_spans_for_chunk(
        self, chunk_text: str, section: ParsedSection
    ) -> tuple[tuple[float, float, float, float] | None, int | None]:
        """Find matching spans within section that correspond to this chunk."""
        if not section.spans:
            return None, section.page_number

        matched = [
            s
            for s in section.spans
            if s.text and (s.text in chunk_text or (len(s.text) > 15 and s.text[:20] in chunk_text))
        ]

        if matched:
            bbox = _compute_enclosing_bbox(matched)
            page = matched[0].page_number or section.page_number
            return bbox, page

        # Fallback to section first span bbox / page
        first_span = section.spans[0]
        return first_span.bbox, first_span.page_number or section.page_number

    def _chunk_section(
        self,
        section: ParsedSection,
        *,
        doc_id: str,
        doc_title: str,
        source_url: str | None,
        source_id: str | None,
        start_index: int,
    ) -> list[DocumentChunk]:
        """Split a single logical section into overlapping chunks with header prefixes."""
        text = section.content.strip()
        if not text:
            return []

        section_path_str = (
            " > ".join(section.section_path) if section.section_path else section.heading
        )
        header_prefix = f"[Document: {doc_title} | Section: {section_path_str}]\n"

        # If section is small enough, keep as single chunk
        if len(text) <= self.max_chunk_size:
            token_est = max(1, len(text) // 4)
            span_bbox = _compute_enclosing_bbox(section.spans) if section.spans else None
            span_page = section.spans[0].page_number if section.spans else section.page_number
            c_start = (
                section.spans[0].char_start
                if section.spans and section.spans[0].char_start is not None
                else 0
            )
            c_end = (
                section.spans[-1].char_end
                if section.spans and section.spans[-1].char_end is not None
                else len(text)
            )

            chunk = DocumentChunk(
                id=generate_id("chk"),
                document_id=doc_id,
                source_id=source_id,
                chunk_index=start_index,
                title=doc_title,
                source_url=source_url,
                content=text,
                searchable_text=f"{header_prefix}{text}",
                section_title=section.heading,
                section_path=list(section.section_path),
                page_number=span_page,
                bbox=span_bbox,
                char_start=c_start,
                char_end=c_end,
                token_count=token_est,
                metadata={"section_level": section.level},
            )
            return [chunk]

        # Break section into sentences
        sentences = _SENTENCE_SPLIT_REGEX.split(text)
        chunks: list[DocumentChunk] = []

        current_sentences: list[str] = []
        current_len = 0
        local_idx = start_index

        for sentence in sentences:
            s_len = len(sentence)
            if current_len + s_len > self.target_chunk_size and current_sentences:
                chunk_text = " ".join(current_sentences)
                token_est = max(1, len(chunk_text) // 4)
                span_bbox, span_page = self._resolve_spans_for_chunk(chunk_text, section)

                chunks.append(
                    DocumentChunk(
                        id=generate_id("chk"),
                        document_id=doc_id,
                        source_id=source_id,
                        chunk_index=local_idx,
                        title=doc_title,
                        source_url=source_url,
                        content=chunk_text,
                        searchable_text=f"{header_prefix}{chunk_text}",
                        section_title=section.heading,
                        section_path=list(section.section_path),
                        page_number=span_page,
                        bbox=span_bbox,
                        char_start=0,
                        char_end=len(chunk_text),
                        token_count=token_est,
                        metadata={"section_level": section.level},
                    )
                )
                local_idx += 1

                # Retain overlapping sentences
                overlap_len = 0
                overlap_sentences: list[str] = []
                for s in reversed(current_sentences):
                    if overlap_len + len(s) <= self.chunk_overlap:
                        overlap_sentences.insert(0, s)
                        overlap_len += len(s)
                    else:
                        break

                current_sentences = overlap_sentences
                current_len = overlap_len

            current_sentences.append(sentence)
            current_len += s_len

        # Final leftover sentences
        if current_sentences:
            chunk_text = " ".join(current_sentences)
            if len(chunk_text) >= self.min_chunk_size or not chunks:
                token_est = max(1, len(chunk_text) // 4)
                span_bbox, span_page = self._resolve_spans_for_chunk(chunk_text, section)
                chunks.append(
                    DocumentChunk(
                        id=generate_id("chk"),
                        document_id=doc_id,
                        source_id=source_id,
                        chunk_index=local_idx,
                        title=doc_title,
                        source_url=source_url,
                        content=chunk_text,
                        searchable_text=f"{header_prefix}{chunk_text}",
                        section_title=section.heading,
                        section_path=list(section.section_path),
                        page_number=span_page,
                        bbox=span_bbox,
                        char_start=0,
                        char_end=len(chunk_text),
                        token_count=token_est,
                        metadata={"section_level": section.level},
                    )
                )

        return chunks
