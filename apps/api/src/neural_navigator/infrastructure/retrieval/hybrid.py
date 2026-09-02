"""Reciprocal Rank Fusion (RRF) algorithm for hybrid retrieval."""

from __future__ import annotations

from typing import TYPE_CHECKING

from neural_navigator.infrastructure.vectorstore.base import SearchResult

if TYPE_CHECKING:
    from neural_navigator.infrastructure.chunking.models import DocumentChunk


def reciprocal_rank_fusion(
    dense_results: list[SearchResult],
    sparse_results: list[SearchResult],
    *,
    k: int = 60,
    w_dense: float = 0.6,
    w_sparse: float = 0.4,
    top_n: int = 10,
) -> list[SearchResult]:
    """Combines dense and sparse ranked search results using Reciprocal Rank Fusion (RRF)."""
    scores: dict[str, float] = {}
    chunk_map: dict[str, DocumentChunk] = {}
    dense_scores: dict[str, float] = {}
    sparse_scores: dict[str, float] = {}

    for rank, res in enumerate(dense_results, start=1):
        cid = res.chunk.id
        chunk_map[cid] = res.chunk
        dense_scores[cid] = res.score
        scores[cid] = scores.get(cid, 0.0) + (w_dense / (k + rank))

    for rank, res in enumerate(sparse_results, start=1):
        cid = res.chunk.id
        chunk_map[cid] = res.chunk
        sparse_scores[cid] = res.score
        scores[cid] = scores.get(cid, 0.0) + (w_sparse / (k + rank))

    if not scores:
        return []

    # Sort by fused score descending
    sorted_items = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:top_n]
    max_score = sorted_items[0][1] if sorted_items else 1.0
    if max_score <= 0.0:
        max_score = 1.0

    return [
        SearchResult(
            chunk=chunk_map[cid],
            score=round(score / max_score, 4),
            dense_score=dense_scores.get(cid),
            sparse_score=sparse_scores.get(cid),
            rank=i + 1,
        )
        for i, (cid, score) in enumerate(sorted_items)
    ]
