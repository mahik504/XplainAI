"""Unit tests for multi-format document parsers (HTML, PDF, Markdown)."""

import pytest

from neural_navigator.infrastructure.parsers.base import (
    DocumentType,
)
from neural_navigator.infrastructure.parsers.html import HTMLDocumentParser
from neural_navigator.infrastructure.parsers.markdown import MarkdownDocumentParser
from neural_navigator.infrastructure.parsers.pdf import PDFDocumentParser
from neural_navigator.infrastructure.parsers.registry import DocumentParserRegistry


@pytest.mark.asyncio
async def test_html_document_parser_basic() -> None:
    html_content = """
    <!DOCTYPE html>
    <html>
    <head><title>Quantum Computing Overview</title></head>
    <body>
        <nav><a href="/">Home</a></nav>
        <h1>Quantum Computing</h1>
        <p>Quantum computing utilizes qubits for superposition and entanglement.</p>
        <h2>Superconducting Qubits</h2>
        <p>Superconducting circuits operate at millikelvin temperatures.</p>
        <h2>Trapped Ions</h2>
        <p>Trapped ion systems offer long coherence times.</p>
        <footer>Copyright 2026</footer>
    </body>
    </html>
    """
    parser = HTMLDocumentParser()
    doc = await parser.parse(html_content, source_url="https://example.com/quantum")

    assert doc.doc_type == DocumentType.HTML
    assert "Quantum" in doc.title
    assert doc.total_characters > 0
    assert len(doc.sections) >= 2
    # Verify nav and footer are stripped/ignored
    assert "Copyright 2026" not in doc.raw_text
    # Verify section headings and paths
    headings = [s.heading for s in doc.sections]
    assert any("Superconducting" in h or "Trapped" in h or "Quantum" in h for h in headings)


@pytest.mark.asyncio
async def test_markdown_document_parser_hierarchy() -> None:
    md_content = """# Neural Architecture

This is the system preamble.

## Transformer Core
The transformer layer processes attention heads in parallel.

### Multi-Head Attention
Multi-head attention projects queries, keys, and values.

## Verification Engine
Verifies claims against grounding graph.
"""
    parser = MarkdownDocumentParser()
    doc = await parser.parse(md_content, title="Architecture Spec")

    assert doc.doc_type == DocumentType.MARKDOWN
    assert doc.title == "Neural Architecture" or doc.title == "Architecture Spec"
    assert len(doc.sections) >= 3

    # Check hierarchy path
    section_paths = [s.section_path for s in doc.sections]
    assert any(len(p) >= 2 for p in section_paths)


@pytest.mark.asyncio
async def test_pdf_document_parser_synthetic(tmp_path: pytest.TempPathFactory) -> None:
    import fitz

    # Create a synthetic 2-page PDF in memory
    doc = fitz.open()
    page1 = doc.new_page()
    page1.insert_text((50, 72), "Title: Quantum Error Correction", fontsize=16)
    page1.insert_text(
        (50, 120), "Surface codes offer a fault-tolerant threshold around 1%.", fontsize=11
    )

    page2 = doc.new_page()
    page2.insert_text((50, 72), "Logical Qubits and Transversal Gates", fontsize=14)
    page2.insert_text(
        (50, 120), "Magic state distillation is required for universal computation.", fontsize=11
    )

    pdf_bytes = doc.tobytes()
    doc.close()

    parser = PDFDocumentParser()
    parsed_doc = await parser.parse(pdf_bytes, title="QEC Paper")

    assert parsed_doc.doc_type == DocumentType.PDF
    assert parsed_doc.total_pages == 2
    assert "Surface codes" in parsed_doc.raw_text
    assert "Magic state" in parsed_doc.raw_text
    assert len(parsed_doc.sections) >= 1
    # Verify spatial bounding box extraction
    assert parsed_doc.sections[0].spans[0].bbox is not None
    assert len(parsed_doc.sections[0].spans[0].bbox) == 4


@pytest.mark.asyncio
async def test_document_parser_registry_dispatch() -> None:
    registry = DocumentParserRegistry()

    assert registry.detect_type("", mime_type="application/pdf") == DocumentType.PDF
    assert registry.detect_type("", mime_type="text/html") == DocumentType.HTML
    assert registry.detect_type("", mime_type="text/markdown") == DocumentType.MARKDOWN
    assert registry.detect_type(b"%PDF-1.4 ...") == DocumentType.PDF
    assert registry.detect_type("<!DOCTYPE html><html>...") == DocumentType.HTML

    # Parse markdown through registry
    parsed = await registry.parse(
        "# Test Document\n\nContent paragraph.", mime_type="text/markdown"
    )
    assert parsed.doc_type == DocumentType.MARKDOWN
    assert "Test Document" in parsed.title
