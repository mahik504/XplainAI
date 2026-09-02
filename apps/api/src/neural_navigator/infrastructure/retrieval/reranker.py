"""Semantic reranking module for search result refinement."""

from __future__ import annotations

import re
from typing import Any

from neural_navigator.infrastructure.vectorstore.base import SearchResult

_TERM_SPLIT = re.compile(r"\w+")


class RerankResultList(list[SearchResult]):
    """A list that is also awaitable for backward and async compatibility."""

    def __await__(self) -> Any:
        async def _coro() -> RerankResultList:
            return self

        return _coro().__await__()


class SemanticReranker:
    """Reranks candidate search results based on query term coverage and semantic prominence."""

    def __init__(self, enabled: bool = True) -> None:
        self.enabled = enabled

    def rerank(
        self,
        query: str,
        results: list[SearchResult],
        *,
        top_n: int = 10,
        top_k: int | None = None,
    ) -> RerankResultList:
        effective_limit = top_k if top_k is not None else top_n
        if not results or not self.enabled:
            return RerankResultList(results[:effective_limit])

        query_terms = set(_TERM_SPLIT.findall(query.lower()))
        if not query_terms:
            return RerankResultList(results[:effective_limit])

        scored_results: list[tuple[SearchResult, float]] = []
        for res in results:
            text = res.chunk.searchable_text.lower()
            term_matches = sum(1 for t in query_terms if t in text)
            term_coverage = term_matches / len(query_terms)

            # Combined score: 65% original fusion score + 35% term coverage
            rerank_score = (0.65 * res.score) + (0.35 * term_coverage)
            scored_results.append((res, rerank_score))

        scored_results.sort(key=lambda item: item[1], reverse=True)

        reranked: list[SearchResult] = []
        for i, (res, score) in enumerate(scored_results[:effective_limit], start=1):
            reranked.append(
                SearchResult(
                    chunk=res.chunk,
                    score=round(score, 4),
                    dense_score=res.dense_score,
                    sparse_score=res.sparse_score,
                    rank=i,
                )
            )

        return RerankResultList(reranked)
