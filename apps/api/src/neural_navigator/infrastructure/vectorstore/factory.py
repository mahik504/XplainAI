"""VectorStore factory function."""

from __future__ import annotations

from typing import TYPE_CHECKING

from neural_navigator.infrastructure.vectorstore.base import IVectorStore
from neural_navigator.infrastructure.vectorstore.memory import InMemoryVectorStore
from neural_navigator.infrastructure.vectorstore.pgvector import PgVectorStore
from neural_navigator.llm.embeddings.factory import get_embedding_provider

if TYPE_CHECKING:
    from neural_navigator.core.config import Settings
    from neural_navigator.infrastructure.db.manager import DatabaseManager
    from neural_navigator.llm.embeddings.base import EmbeddingProvider


def get_vector_store(
    settings: Settings,
    db_manager: DatabaseManager | None = None,
    embedding_provider: EmbeddingProvider | None = None,
) -> IVectorStore:
    """Instantiate the appropriate VectorStore (PgVectorStore or InMemoryVectorStore)."""
    embedder = embedding_provider or get_embedding_provider(settings)

    if db_manager and db_manager.is_postgres:
        return PgVectorStore(db_manager=db_manager, embedding_provider=embedder)
    else:
        return InMemoryVectorStore(embedding_provider=embedder)
