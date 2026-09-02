"""FastEmbed local ONNX embedding provider (BAAI/bge-small-en-v1.5)."""

from __future__ import annotations

import asyncio
from typing import Any

from neural_navigator.llm.embeddings.base import EmbeddingProvider

try:
    from fastembed import TextEmbedding
except ImportError:
    TextEmbedding = None  # type: ignore[assignment, misc]


class FastEmbedEmbeddingProvider(EmbeddingProvider):
    """Generates local CPU embeddings via ONNX (BAAI/bge-small-en-v1.5, 384 dim)."""

    def __init__(
        self,
        model_name: str = "BAAI/bge-small-en-v1.5",
        dimension: int = 384,
    ) -> None:
        self._model_name = model_name
        self._dimension = dimension
        self._model: Any = None
        if TextEmbedding is not None:
            self._model = TextEmbedding(model_name=model_name)

    @property
    def name(self) -> str:
        return "fastembed"

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if self._model is None:
            raise RuntimeError("FastEmbed is not installed or available")

        # Run CPU embedding in thread pool
        def _run_embedding() -> list[list[float]]:
            embeddings = list(self._model.embed(texts))
            return [e.tolist() for e in embeddings]

        return await asyncio.to_thread(_run_embedding)

    async def embed_query(self, text: str) -> list[float]:
        results = await self.embed_texts([text])
        return results[0]
