"""Unit tests for MetadataAwareChunker and hierarchical context enrichment."""

from neural_navigator.infrastructure.chunking.chunker import MetadataAwareChunker
from neural_navigator.infrastructure.parsers.base import (
    DocumentType,
    ParsedDocument,
    ParsedSection,
    ParsedSpan,
)


def test_metadata_aware_chunker_basic_sizing() -> None:
    # 1500 chars section with distinct sentences
    sentences = [
        f"Sentence number {i} provides detailed technical insights into transformer self-attention mechanisms and multi-head projection layers."
        for i in range(1, 15)
    ]
    full_text = " ".join(sentences)
    assert len(full_text) > 1000

    section = ParsedSection(
        heading="Attention Layers",
        level=2,
        content=full_text,
        section_path=["Transformer Spec", "Architecture", "Attention Layers"],
        page_number=3,
        spans=[
            ParsedSpan(
                text=full_text,
                page_number=3,
                bbox=(50.0, 100.0, 500.0, 700.0),
                char_start=0,
                char_end=len(full_text),
            )
        ],
    )

    doc = ParsedDocument(
        doc_id="doc_test123",
        title="Transformer Spec",
        doc_type=DocumentType.MARKDOWN,
        raw_text=full_text,
        sections=[section],
        source_url="https://arxiv.org/abs/1706.03762",
    )

    chunker = MetadataAwareChunker(target_chunk_size=600, chunk_overlap=120)
    chunks = chunker.chunk_document(doc, source_id="src_attention")

    assert len(chunks) >= 2
    # Verify hierarchical breadcrumb prefix
    for chunk in chunks:
        assert chunk.source_id == "src_attention"
        assert chunk.document_id == "doc_test123"
        assert (
            "[Document: Transformer Spec | Section: Transformer Spec > Architecture > Attention Layers]"
            in chunk.searchable_text
        )
        assert "Sentence number" in chunk.content
        assert chunk.token_count > 0
        assert chunk.page_number == 3


def test_metadata_aware_chunker_short_section_no_unnecessary_split() -> None:
    short_text = "Surface codes define physical qubits on a 2D square lattice with nearest-neighbor stabilizer measurements."
    section = ParsedSection(
        heading="Surface Codes",
        level=1,
        content=short_text,
        section_path=["Quantum Error Correction", "Surface Codes"],
        page_number=1,
        spans=[ParsedSpan(text=short_text, page_number=1, char_start=0, char_end=len(short_text))],
    )

    doc = ParsedDocument(
        doc_id="doc_qec",
        title="Quantum Error Correction",
        doc_type=DocumentType.TEXT,
        raw_text=short_text,
        sections=[section],
    )

    chunker = MetadataAwareChunker(target_chunk_size=800, chunk_overlap=150)
    chunks = chunker.chunk_document(doc)

    assert len(chunks) == 1
    assert chunks[0].content == short_text
    assert chunks[0].section_title == "Surface Codes"
    assert chunks[0].chunk_index == 0
