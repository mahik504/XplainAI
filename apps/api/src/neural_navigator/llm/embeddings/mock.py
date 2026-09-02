"""Deterministic mock embedding provider for tests and offline development."""

from __future__ import annotations

import hashlib

import numpy as np

from neural_navigator.llm.embeddings.base import EmbeddingProvider


class MockEmbeddingProvider(EmbeddingProvider):
    """Generates deterministic, normalized pseudo-embeddings derived from text content."""

    def __init__(self, dimension: int = 1536) -> None:
        self._dimension = dimension

    @property
    def name(self) -> str:
        return "mock"

    @property
    def dimension(self) -> int:
        return self._dimension

    def _generate_vector(self, text: str) -> list[float]:
        # Hash text to create a deterministic seed
        seed_bytes = hashlib.sha256(text.encode("utf-8")).digest()
        seed_int = int.from_bytes(seed_bytes[:8], "big")
        rng = np.random.default_rng(seed_int)

        # Generate random normal vector
        raw_vec = rng.standard_normal(self._dimension)
        # Normalize to unit length (L2 norm = 1.0)
        norm = np.linalg.norm(raw_vec)
        norm_vec = raw_vec / norm if norm > 0 else raw_vec
        return norm_vec.tolist()

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [self._generate_vector(t) for t in texts]

    async def embed_query(self, text: str) -> list[float]:
        return self._generate_vector(text)
