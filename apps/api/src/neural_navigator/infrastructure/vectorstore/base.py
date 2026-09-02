"""VectorStore interface and SearchResult definition."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from neural_navigator.infrastructure.chunking.models import DocumentChunk


@dataclass(slots=True)
class SearchResult:
    """Retrieved chunk result with ranking and scoring metadata."""

    chunk: DocumentChunk
    score: float  # Normalized 0.0 - 1.0 (higher = better)
    dense_score: float | None = None
    sparse_score: float | None = None
    rank: int = 0

    def as_dict(self) -> dict[str, Any]:
        return {
            "chunk": self.chunk.as_dict(),
            "score": round(self.score, 4),
            "dense_score": round(self.dense_score, 4) if self.dense_score is not None else None,
            "sparse_score": round(self.sparse_score, 4) if self.sparse_score is not None else None,
            "rank": self.rank,
        }


class IVectorStore(ABC):
    """Abstract interface for vector chunk storage and hybrid retrieval."""

    @abstractmethod
    async def add_chunks(self, chunks: list[DocumentChunk]) -> list[str]:
        """Index a batch of document chunks."""
        pass

    @abstractmethod
    async def similarity_search(
        self,
        query_vector: list[float],
        top_k: int = 10,
        session_id: str | None = None,
    ) -> list[SearchResult]:
        """Perform dense vector cosine similarity search."""
        pass

    @abstractmethod
    async def hybrid_search(
        self,
        query_text: str,
        query_vector: list[float],
        top_k: int = 10,
        alpha: float = 0.6,
        session_id: str | None = None,
    ) -> list[SearchResult]:
        """Perform hybrid search combining dense similarity and sparse text search."""
        pass

    @abstractmethod
    async def delete_by_document(self, document_id: str) -> int:
        """Delete all chunks belonging to a document."""
        pass

    @abstractmethod
    async def delete_by_session(self, session_id: str) -> int:
        """Delete all chunks belonging to a research session."""
        pass
