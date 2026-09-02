"""OpenAI API Embedding Provider."""

from __future__ import annotations

from typing import Any

import httpx

from neural_navigator.llm.embeddings.base import EmbeddingProvider


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """Generates vector embeddings using the OpenAI Embeddings API (text-embedding-3-small)."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = "https://api.openai.com/v1",
        model: str = "text-embedding-3-small",
        dimension: int = 1536,
        timeout_seconds: float = 30.0,
    ) -> None:
        self._model = model
        self._dimension = dimension
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(timeout_seconds),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )

    @property
    def name(self) -> str:
        return "openai"

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        payload: dict[str, Any] = {
            "input": texts,
            "model": self._model,
        }
        response = await self._client.post("/embeddings", json=payload)
        response.raise_for_status()
        data = response.json()
        # Sort by index to ensure order matches input
        sorted_data = sorted(data["data"], key=lambda item: item["index"])
        return [item["embedding"] for item in sorted_data]

    async def embed_query(self, text: str) -> list[float]:
        results = await self.embed_texts([text])
        return results[0]

    async def aclose(self) -> None:
        await self._client.aclose()
