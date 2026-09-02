"""Unit tests for Hybrid RAG search, Reciprocal Rank Fusion, and Evidence mapping."""

from neural_navigator.infrastructure.chunking.models import DocumentChunk
from neural_navigator.infrastructure.retrieval.evidence_mapper import (
    search_results_to_evidence_and_sources,
)
from neural_navigator.infrastructure.retrieval.hybrid import reciprocal_rank_fusion
from neural_navigator.infrastructure.retrieval.reranker import SemanticReranker
from neural_navigator.infrastructure.vectorstore.base import SearchResult


def _make_chunk(cid: str, title: str, text: str) -> DocumentChunk:
    return DocumentChunk(
        id=cid,
        document_id=f"doc_{cid}",
        source_id=f"src_{cid}",
        chunk_index=0,
        title=title,
        source_url=f"https://arxiv.org/{cid}",
        content=text,
        searchable_text=f"[Document: {title}] {text}",
        section_title="Main",
        section_path=[title, "Main"],
        char_start=0,
        char_end=len(text),
        token_count=len(text) // 4,
    )


def test_reciprocal_rank_fusion_math() -> None:
    chunk_a = _make_chunk(
        "A", "Quantum Algorithms", "Shor's algorithm provides polynomial speedup."
    )
    chunk_b = _make_chunk(
        "B",
        "Grover Search",
        "Grover's algorithm provides quadratic speedup for unstructured search.",
    )
    chunk_c = _make_chunk(
        "C", "Quantum Annealing", "D-Wave machines perform quantum annealing optimization."
    )

    # Dense ranking: [A, B, C]
    dense_results = [
        SearchResult(chunk=chunk_a, score=0.95, rank=1),
        SearchResult(chunk=chunk_b, score=0.85, rank=2),
        SearchResult(chunk=chunk_c, score=0.75, rank=3),
    ]

    # Sparse ranking: [B, A]
    sparse_results = [
        SearchResult(chunk=chunk_b, score=12.5, rank=1),
        SearchResult(chunk=chunk_a, score=4.2, rank=2),
    ]

    fused = reciprocal_rank_fusion(
        dense_results,
        sparse_results,
        k=60,
        w_dense=0.6,
        w_sparse=0.4,
        top_n=3,
    )

    assert len(fused) == 3
    # Top chunk should have normalized score = 1.0
    assert fused[0].score == 1.0
    # Both A and B appeared in dense and sparse, so they should rank ahead of C (which only appeared in dense)
    fused_ids = [res.chunk.id for res in fused]
    assert fused_ids[0] in {"A", "B"}
    assert fused_ids[1] in {"A", "B"}
    assert fused_ids[2] == "C"


def test_semantic_reranker_coverage_boost() -> None:
    chunk_1 = _make_chunk(
        "1", "Overview", "General machine learning with stochastic gradient descent."
    )
    chunk_2 = _make_chunk(
        "2",
        "Transformer Attention",
        "FlashAttention2 uses GPU SRAM tiling for exact softmax attention.",
    )

    results = [
        SearchResult(chunk=chunk_1, score=0.9, rank=1),
        SearchResult(chunk=chunk_2, score=0.85, rank=2),
    ]

    reranker = SemanticReranker(enabled=True)
    reranked = reranker.rerank("FlashAttention GPU SRAM exact", results, top_n=2)

    # Chunk 2 matches all specific query keywords so it should be promoted to rank 1
    assert reranked[0].chunk.id == "2"
    assert reranked[0].rank == 1


def test_search_results_to_evidence_and_sources_mapping() -> None:
    chunk = _make_chunk(
        "pdf_1", "Attention Paper", "Self-attention replaces recurrent neural layers."
    )
    results = [SearchResult(chunk=chunk, score=0.92, rank=1)]

    sources, evidence = search_results_to_evidence_and_sources(results)

    assert len(sources) == 1
    assert sources[0].id == "src_pdf_1"
    assert sources[0].title == "Attention Paper"
    assert sources[0].domain == "arxiv.org"

    assert len(evidence) == 1
    assert evidence[0].source_id == "src_pdf_1"
    assert evidence[0].text == "Self-attention replaces recurrent neural layers."
    assert evidence[0].confidence == 0.92
