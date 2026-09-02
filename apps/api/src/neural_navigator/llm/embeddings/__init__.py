"""Embedding providers package."""

from __future__ import annotations

from neural_navigator.llm.embeddings.base import EmbeddingProvider
from neural_navigator.llm.embeddings.factory import get_embedding_provider
from neural_navigator.llm.embeddings.fastembed import FastEmbedEmbeddingProvider
from neural_navigator.llm.embeddings.mock import MockEmbeddingProvider
from neural_navigator.llm.embeddings.openai import OpenAIEmbeddingProvider

__all__ = [
    "EmbeddingProvider",
    "FastEmbedEmbeddingProvider",
    "MockEmbeddingProvider",
    "OpenAIEmbeddingProvider",
    "get_embedding_provider",
]
