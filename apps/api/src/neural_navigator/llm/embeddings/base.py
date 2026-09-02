"""Abstract Embedding Provider interface."""

from __future__ import annotations

from abc import ABC, abstractmethod


class EmbeddingProvider(ABC):
    """Abstract interface for text embedding generation."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name identifier."""
        pass

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Vector embedding dimension."""
        pass

    @abstractmethod
    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Compute embeddings for a batch of texts."""
        pass

    @abstractmethod
    async def embed_query(self, text: str) -> list[float]:
        """Compute embedding for a single search query."""
        pass

    async def aclose(self) -> None:
        """Clean up resources if needed."""
        return None
