"""Unit and integration tests for Multimodal Document Ingestion and Artifact Exporters."""

from pathlib import Path

import fitz
import pytest
from fastapi.testclient import TestClient

from neural_navigator.core.config import Settings
from neural_navigator.domain.models.research import (
    Claim,
    ClaimStatus,
    Evidence,
    EvidenceGraph,
    GraphEdge,
    GraphEdgeType,
    GraphNode,
    GraphNodeType,
    Source,
    SourceType,
    generate_id,
)
from neural_navigator.infrastructure.chunking.chunker import MetadataAwareChunker
from neural_navigator.infrastructure.parsers.base import DocumentType
from neural_navigator.infrastructure.parsers.image import ImageDocumentParser
from neural_navigator.infrastructure.parsers.pdf import PDFDocumentParser
from neural_navigator.main import create_app
from neural_navigator.orchestration.exporters import (
    EvidencePackExporter,
    MarkdownExporter,
    PDFExporter,
)


@pytest.fixture
def sample_session_data() -> dict:
    source1 = Source(
        id="src_1",
        title="Attention Is All You Need",
        url="https://arxiv.org/abs/1706.03762",
        domain="arxiv.org",
        snippet="We propose the Transformer, a model architecture eschewing recurrence.",
        source_type=SourceType.PAPER,
        authority_score=0.96,
    )
    evidence1 = Evidence(
        id="evi_1",
        source_id="src_1",
        source_title="Attention Is All You Need",
        source_url="https://arxiv.org/abs/1706.03762",
        text="The Transformer allows for significantly more parallelization than RNNs.",
        confidence=0.94,
        relevance_score=0.95,
        page_number=2,
        bbox=(50.0, 100.0, 450.0, 200.0),
    )
    claim1 = Claim(
        id="clm_1",
        text="Transformers process tokens in parallel without recurrence.",
        status=ClaimStatus.SUPPORTED,
        evidence_ids=["evi_1"],
        confidence=0.95,
        importance="core",
    )
    node1 = GraphNode(id="src_1", type=GraphNodeType.SOURCE, label="Transformer Paper", description="Paper", position_3d=(0.0, 0.0, 50.0))
    node2 = GraphNode(id="evi_1", type=GraphNodeType.EVIDENCE, label="Parallel Evidence", description="Evidence", position_3d=(10.0, 10.0, 25.0))
    node3 = GraphNode(id="clm_1", type=GraphNodeType.CLAIM, label="Parallel Claim", description="Claim", position_3d=(5.0, 5.0, 0.0))
    edge1 = GraphEdge(id="edg_1", source_node_id="evi_1", target_node_id="clm_1", type=GraphEdgeType.SUPPORTS)
    graph = EvidenceGraph(nodes=[node1, node2, node3], edges=[edge1], density=0.33, cluster_count=1)

    return {
        "id": "ses_test_123",
        "session_id": "ses_test_123",
        "title": "Transformer Architecture Analysis",
        "created_at": "2026-09-01T12:00:00Z",
        "mode": "deep_research",
        "egi_score": 0.92,
        "trust_metrics": {
            "source_quality": 0.96,
            "evidence_confidence": 0.94,
            "claim_grounding": 0.95,
            "citation_fidelity": 1.0,
            "contradiction_penalty": 0.0,
        },
        "synthesis": "Transformers replace recurrence with multi-head self-attention mechanisms [1].",
        "answer_text": "Transformers replace recurrence with multi-head self-attention mechanisms [1].",
        "domain_sources": [source1],
        "domain_evidence": [evidence1],
        "domain_claims": [claim1],
        "domain_citations": [{"id": "cit_1", "claim_id": "clm_1", "source_id": "src_1", "evidence_id": "evi_1", "inline_marker": "[1]", "citation_index": 1}],
        "domain_graph": graph,
    }


def test_markdown_exporter_structure(sample_session_data: dict) -> None:
    md_output = MarkdownExporter.export(sample_session_data)

    assert "# Transformer Architecture Analysis" in md_output
    assert "EGI 2.0" in md_output
    assert "92.0%" in md_output
    assert "## Executive Summary & Research Synthesis" in md_output
    assert "## Epistemic Verification Matrix" in md_output
    assert "## References" in md_output
    assert "[1] **Attention Is All You Need**" in md_output
    assert "https://arxiv.org/abs/1706.03762" in md_output


def test_pdf_exporter_binary_generation(sample_session_data: dict) -> None:
    pdf_bytes = PDFExporter.export(sample_session_data)

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 500
    assert pdf_bytes.startswith(b"%PDF-")

    # Read back with PyMuPDF to verify integrity
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    assert len(doc) >= 1
    text = doc[0].get_text()
    assert "XPLAINAI" in text
    assert "Transformer Architecture Analysis" in text
    doc.close()


def test_evidence_pack_exporter_schema(sample_session_data: dict) -> None:
    pack = EvidencePackExporter.export(sample_session_data)

    assert "manifest" in pack
    manifest = pack["manifest"]
    assert manifest["pack_version"] == "2.2.0"
    assert manifest["session_id"] == "ses_test_123"
    assert manifest["sources_count"] == 1
    assert manifest["evidence_count"] == 1
    assert manifest["claims_count"] == 1
    assert manifest["egi_score"] == 0.92

    assert "synthesis" in pack
    assert "claims" in pack
    assert pack["claims"][0]["status"] == "supported"
    assert "evidence" in pack
    assert pack["evidence"][0]["bbox"] == [50.0, 100.0, 450.0, 200.0]
    assert pack["evidence"][0]["page_number"] == 2
    assert "sources" in pack
    assert "graph" in pack


@pytest.mark.asyncio
async def test_image_document_parser_and_chunker() -> None:
    # Generate synthetic image in PyMuPDF (alpha=0 for 3 RGB channels)
    pix = fitz.Pixmap(fitz.csRGB, fitz.Rect(0, 0, 400, 300), 0)
    pix.set_rect(fitz.IRect(0, 0, 400, 300), (200, 220, 240))
    png_bytes = pix.tobytes("png")

    parser = ImageDocumentParser()
    doc = await parser.parse(png_bytes, title="Diagram.png", source_url="Diagram.png")

    assert doc.doc_type == DocumentType.IMAGE
    assert doc.title == "Diagram.png"
    assert len(doc.sections) == 1
    assert doc.sections[0].spans[0].bbox is not None
    assert len(doc.sections[0].spans[0].bbox) == 4

    chunker = MetadataAwareChunker()
    chunks = chunker.chunk_document(doc)
    assert len(chunks) == 1
    assert chunks[0].bbox == doc.sections[0].spans[0].bbox
    assert chunks[0].page_number == 1


@pytest.mark.asyncio
async def test_pdf_spatial_bounding_box_preservation() -> None:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 100), "First Heading: Quantum States", fontsize=14)
    page.insert_text((72, 150), "Qubits exist in linear combinations of basis states alpha and beta.", fontsize=11)
    pdf_bytes = doc.tobytes()
    doc.close()

    parser = PDFDocumentParser()
    parsed = await parser.parse(pdf_bytes, title="Quantum Intro")
    assert parsed.total_pages == 1
    assert parsed.sections[0].spans[0].bbox is not None

    chunker = MetadataAwareChunker()
    chunks = chunker.chunk_document(parsed)
    assert len(chunks) >= 1
    assert chunks[0].bbox is not None
    assert len(chunks[0].bbox) == 4
    assert chunks[0].page_number == 1


def test_api_document_upload_and_export_endpoints(tmp_path: Path) -> None:
    db_file = tmp_path / f"test_api_{generate_id('db')}.db"
    settings = Settings(
        llm_provider="echo",
        conversation_db_path=str(db_file),
    )
    app = create_app(settings)

    with TestClient(app) as client:
        # 1. Test POST /api/v1/documents/upload with synthetic PDF
        doc = fitz.open()
        p = doc.new_page()
        p.insert_text((50, 72), "Autonomous Multimodal Research System", fontsize=16)
        p.insert_text((50, 120), "XplainAI integrates pgvector HNSW indexing and spatial citation highlighting.", fontsize=10)
        pdf_bytes = doc.tobytes()
        doc.close()

        upload_resp = client.post(
            "/api/v1/documents/upload",
            files={"file": ("research_paper.pdf", pdf_bytes, "application/pdf")},
            data={"title": "Autonomous Research Paper"},
        )
        assert upload_resp.status_code == 201
        upload_data = upload_resp.json()
        assert "document_id" in upload_data
        assert upload_data["title"] == "Autonomous Research Paper"
        assert upload_data["page_count"] == 1
        assert upload_data["chunk_count"] >= 1
        assert upload_data["status"] == "indexed"

        # 2. Test create conversation and append turn with orchestration state
        create_resp = client.post("/api/v1/conversations", json={"title": "Test Research Session"})
        assert create_resp.status_code == 201
        session_id = create_resp.json()["id"]

        # Append assistant message with pipeline_state into conversation store
        store = app.state.conversation_store
        store.append_message(
            session_id,
            role="assistant",
            content="Photonic tensor cores leverage optical interference for matrix operations [1].",
            pipeline_state={
                "mode": "deep_research",
                "egi_score": 0.93,
                "trust_metrics": {"source_quality": 0.95, "evidence_confidence": 0.90, "claim_grounding": 0.94, "citation_fidelity": 1.0, "contradiction_penalty": 0.0},
                "domain_sources": [{"id": "src_1", "title": "Optical Computing", "url": "https://optics.org/paper", "domain": "optics.org", "authority_score": 0.92, "source_type": "paper"}],
                "domain_evidence": [{"id": "evi_1", "source_id": "src_1", "text": "Optical interference accelerates GEMM kernels.", "confidence": 0.90, "page_number": 1, "bbox": [50.0, 100.0, 400.0, 200.0]}],
                "domain_claims": [{"id": "clm_1", "text": "Photonic tensor cores perform matrix operations optically.", "status": "supported", "confidence": 0.92, "importance": "core", "evidence_ids": ["evi_1"]}],
                "domain_citations": [{"id": "cit_1", "claim_id": "clm_1", "source_id": "src_1", "evidence_id": "evi_1", "inline_marker": "[1]", "citation_index": 1}],
            },
        )

        # 3. Test GET /api/v1/sessions/{id}/export?format=markdown
        exp_md_resp = client.get(f"/api/v1/sessions/{session_id}/export?format=markdown")
        assert exp_md_resp.status_code == 200
        assert "text/markdown" in exp_md_resp.headers["content-type"]
        assert "Photonic tensor cores" in exp_md_resp.text
        assert "## References" in exp_md_resp.text
        assert "https://optics.org/paper" in exp_md_resp.text

        # 4. Test GET /api/v1/sessions/{id}/export?format=pdf
        exp_pdf_resp = client.get(f"/api/v1/sessions/{session_id}/export?format=pdf")
        assert exp_pdf_resp.status_code == 200
        assert exp_pdf_resp.headers["content-type"] == "application/pdf"
        assert exp_pdf_resp.content.startswith(b"%PDF-")

        # 5. Test GET /api/v1/sessions/{id}/evidence-pack
        pack_resp = client.get(f"/api/v1/sessions/{session_id}/evidence-pack")
        assert pack_resp.status_code == 200
        pack_data = pack_resp.json()
        assert pack_data["manifest"]["session_id"] == session_id
        assert pack_data["manifest"]["egi_score"] == 0.93
        assert len(pack_data["claims"]) == 1
        assert pack_data["claims"][0]["status"] == "supported"
        assert len(pack_data["evidence"]) == 1
        assert pack_data["evidence"][0]["bbox"] == [50.0, 100.0, 400.0, 200.0]
        assert len(pack_data["sources"]) == 1

        # 6. Test 404 for non-existent session
        missing_resp = client.get("/api/v1/sessions/ses_non_existent/export?format=markdown")
        assert missing_resp.status_code == 404
