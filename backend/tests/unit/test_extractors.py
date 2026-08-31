"""Unit tests for domain source and evidence extraction."""

from neural_navigator.domain.models.research import SourceType
from neural_navigator.orchestration.extractors import extract_domain_sources_and_evidence
from neural_navigator.orchestration.tools import ToolResult


def test_extract_domain_sources_and_evidence_deduplication() -> None:
    tool_res = ToolResult(
        tool="web_search",
        status="ok",
        started_ms=0.0,
        completed_ms=5.0,
        duration_ms=5.0,
        summary="Search results",
        data={
            "results": [
                {
                    "title": "Quantum Paper",
                    "url": "https://arxiv.org/abs/2301.00001",
                    "snippet": "Surface code quantum error correction demonstrates threshold.",
                    "authority": 0.95,
                },
                {
                    "title": "Quantum Paper Duplicate",
                    "url": "https://arxiv.org/abs/2301.00001",
                    "snippet": "Duplicate entry with same URL.",
                    "authority": 0.95,
                },
                {
                    "title": "GitHub Repo",
                    "url": "https://github.com/qiskit/qiskit",
                    "snippet": "Qiskit is an open-source SDK for quantum algorithms.",
                    "authority": 0.90,
                },
            ]
        },
    )

    sources, evidence = extract_domain_sources_and_evidence([tool_res])

    # Should deduplicate by URL: 2 unique sources
    assert len(sources) == 2
    assert len(evidence) == 2

    # Check arXiv classified as PAPER
    arxiv_source = next(s for s in sources if "arxiv.org" in s.url)
    assert arxiv_source.source_type == SourceType.PAPER
    assert arxiv_source.authority_score == 0.95

    # Check GitHub classified as DOCUMENTATION
    gh_source = next(s for s in sources if "github.com" in s.url)
    assert gh_source.source_type == SourceType.DOCUMENTATION


def test_extract_domain_sources_url_ingest_data() -> None:
    tool_res = ToolResult(
        tool="url_ingest",
        status="ok",
        started_ms=0.0,
        completed_ms=2.0,
        duration_ms=2.0,
        summary="Ingested link",
        data={
            "sources": [
                {
                    "id": "src_custom",
                    "title": "FastAPI Docs",
                    "url": "https://fastapi.tiangolo.com",
                    "snippet": "FastAPI framework, high performance, easy to learn.",
                    "authority_score": 0.92,
                }
            ]
        },
    )

    sources, evidence = extract_domain_sources_and_evidence([tool_res])
    assert len(sources) == 1
    assert len(evidence) == 1
    assert sources[0].id == "src_custom"
    assert sources[0].source_type == SourceType.DOCUMENTATION
    assert evidence[0].source_id == "src_custom"
