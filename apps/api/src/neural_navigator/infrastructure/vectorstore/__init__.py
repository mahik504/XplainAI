"""Vector store package."""

from __future__ import annotations

from neural_navigator.infrastructure.vectorstore.base import IVectorStore, SearchResult
from neural_navigator.infrastructure.vectorstore.factory import get_vector_store
from neural_navigator.infrastructure.vectorstore.memory import InMemoryVectorStore
from neural_navigator.infrastructure.vectorstore.pgvector import PgVectorStore

__all__ = [
    "IVectorStore",
    "InMemoryVectorStore",
    "PgVectorStore",
    "SearchResult",
    "get_vector_store",
]
