"""Factory for selecting and instantiating embedding providers based on Settings."""

from __future__ import annotations

from typing import TYPE_CHECKING

from neural_navigator.llm.embeddings.base import EmbeddingProvider
from neural_navigator.llm.embeddings.fastembed import FastEmbedEmbeddingProvider
from neural_navigator.llm.embeddings.mock import MockEmbeddingProvider
from neural_navigator.llm.embeddings.openai import OpenAIEmbeddingProvider

if TYPE_CHECKING:
    from neural_navigator.core.config import Settings


def get_embedding_provider(settings: Settings) -> EmbeddingProvider:
    """Instantiate the configured embedding provider."""
    provider_name = (settings.embedding_provider or "mock").lower()

    if provider_name == "openai" and settings.openai_api_key:
        return OpenAIEmbeddingProvider(
            api_key=settings.openai_api_key.get_secret_value(),
            base_url=settings.llm_base_url,
            model=settings.embedding_model,
            dimension=settings.embedding_dim,
            timeout_seconds=settings.llm_request_timeout_seconds,
        )
    elif provider_name == "fastembed":
        try:
            return FastEmbedEmbeddingProvider(
                model_name=settings.embedding_model,
                dimension=settings.embedding_dim,
            )
        except Exception:
            return MockEmbeddingProvider(dimension=settings.embedding_dim)
    else:
        return MockEmbeddingProvider(dimension=settings.embedding_dim)
