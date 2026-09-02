"""In-memory VectorStore with Numpy cosine similarity and BM25 search fallback."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

import numpy as np

from neural_navigator.infrastructure.vectorstore.base import IVectorStore, SearchResult

if TYPE_CHECKING:
    from neural_navigator.infrastructure.chunking.models import DocumentChunk
    from neural_navigator.llm.embeddings.base import EmbeddingProvider

try:
    from rank_bm25 import BM25Okapi
except ImportError:
    BM25Okapi = None  # type: ignore[assignment, misc]

_TOKEN_REGEX = re.compile(r"\w+")


class InMemoryVectorStore(IVectorStore):
    """Zero-dependency in-memory vector store with BM25 keyword search and numpy cosine similarity."""

    def __init__(self, embedding_provider: EmbeddingProvider) -> None:
        self._embedder = embedding_provider
        self._chunks: dict[str, DocumentChunk] = {}
        self._vectors: dict[str, np.ndarray] = {}
        self._bm25: Any = None
        self._bm25_chunk_ids: list[str] = []

    def _rebuild_bm25(self) -> None:
        if BM25Okapi is None or not self._chunks:
            self._bm25 = None
            self._bm25_chunk_ids = []
            return

        self._bm25_chunk_ids = list(self._chunks.keys())
        corpus = [
            _TOKEN_REGEX.findall(self._chunks[cid].searchable_text.lower())
            for cid in self._bm25_chunk_ids
        ]
        self._bm25 = BM25Okapi(corpus)

    async def add_chunks(self, chunks: list[DocumentChunk]) -> list[str]:
        if not chunks:
            return []

        texts = [c.searchable_text for c in chunks]
        embeddings = await self._embedder.embed_texts(texts)

        added_ids: list[str] = []
        for chunk, emb in zip(chunks, embeddings, strict=False):
            self._chunks[chunk.id] = chunk
            vec = np.array(emb, dtype=np.float32)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            self._vectors[chunk.id] = vec
            added_ids.append(chunk.id)

        self._rebuild_bm25()
        return added_ids

    async def similarity_search(
        self,
        query_vector: list[float],
        top_k: int = 10,
        session_id: str | None = None,
    ) -> list[SearchResult]:
        if not self._vectors:
            return []

        q_vec = np.array(query_vector, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm > 0:
            q_vec = q_vec / q_norm

        scored: list[tuple[str, float]] = []
        for cid, vec in self._vectors.items():
            chunk = self._chunks[cid]
            if session_id and chunk.metadata.get("session_id") != session_id:
                continue
            sim = float(np.dot(q_vec, vec))
            scored.append((cid, max(0.0, min(1.0, sim))))

        scored.sort(key=lambda item: item[1], reverse=True)
        top_items = scored[:top_k]

        return [
            SearchResult(
                chunk=self._chunks[cid],
                score=score,
                dense_score=score,
                rank=i + 1,
            )
            for i, (cid, score) in enumerate(top_items)
        ]

    async def hybrid_search(
        self,
        query_text: str,
        query_vector: list[float],
        top_k: int = 10,
        alpha: float = 0.6,
        session_id: str | None = None,
    ) -> list[SearchResult]:
        from neural_navigator.infrastructure.retrieval.hybrid import reciprocal_rank_fusion

        dense_candidates = await self.similarity_search(
            query_vector, top_k=top_k * 2, session_id=session_id
        )

        sparse_results: list[SearchResult] = []
        if self._bm25 is not None and self._bm25_chunk_ids:
            query_tokens = _TOKEN_REGEX.findall(query_text.lower())
            if query_tokens:
                doc_scores = self._bm25.get_scores(query_tokens)
                ranked_indices = np.argsort(doc_scores)[::-1]

                for rank_idx, doc_idx in enumerate(ranked_indices[: top_k * 2], start=1):
                    raw_score = float(doc_scores[doc_idx])
                    if raw_score <= 0.0:
                        continue
                    cid = self._bm25_chunk_ids[doc_idx]
                    chunk = self._chunks[cid]
                    if session_id and chunk.metadata.get("session_id") != session_id:
                        continue
                    sparse_results.append(
                        SearchResult(
                            chunk=chunk,
                            score=raw_score,
                            sparse_score=raw_score,
                            rank=rank_idx,
                        )
                    )

        return reciprocal_rank_fusion(
            dense_candidates,
            sparse_results,
            w_dense=alpha,
            w_sparse=1.0 - alpha,
            top_n=top_k,
        )

    async def delete_by_document(self, document_id: str) -> int:
        to_delete = [cid for cid, chunk in self._chunks.items() if chunk.document_id == document_id]
        for cid in to_delete:
            del self._chunks[cid]
            self._vectors.pop(cid, None)
        self._rebuild_bm25()
        return len(to_delete)

    async def delete_by_session(self, session_id: str) -> int:
        to_delete = [
            cid
            for cid, chunk in self._chunks.items()
            if chunk.metadata.get("session_id") == session_id
        ]
        for cid in to_delete:
            del self._chunks[cid]
            self._vectors.pop(cid, None)
        self._rebuild_bm25()
        return len(to_delete)
