"""PostgreSQL + pgvector vector store implementation."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import delete, func, select, text

from neural_navigator.infrastructure.chunking.models import DocumentChunk
from neural_navigator.infrastructure.db.models.chunks import DocumentChunkModel
from neural_navigator.infrastructure.vectorstore.base import IVectorStore, SearchResult

if TYPE_CHECKING:
    from neural_navigator.infrastructure.db.manager import DatabaseManager
    from neural_navigator.llm.embeddings.base import EmbeddingProvider


class PgVectorStore(IVectorStore):
    """PostgreSQL pgvector storage supporting HNSW cosine similarity and GIN tsvector full-text search."""

    def __init__(
        self,
        db_manager: DatabaseManager,
        embedding_provider: EmbeddingProvider,
    ) -> None:
        self._db = db_manager
        self._embedder = embedding_provider

    async def add_chunks(self, chunks: list[DocumentChunk]) -> list[str]:
        if not chunks:
            return []

        # Embed all searchable texts
        texts = [c.searchable_text for c in chunks]
        embeddings = await self._embedder.embed_texts(texts)

        chunk_ids: list[str] = []
        async with self._db.session() as session:
            for chunk, emb in zip(chunks, embeddings, strict=False):
                model = DocumentChunkModel(
                    id=chunk.id,
                    document_id=chunk.document_id,
                    source_id=chunk.source_id,
                    session_id=chunk.metadata.get("session_id"),
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                    searchable_text=chunk.searchable_text,
                    section_title=chunk.section_title,
                    section_path=chunk.section_path,
                    page_number=chunk.page_number,
                    bbox=list(chunk.bbox) if chunk.bbox else None,
                    char_start=chunk.char_start,
                    char_end=chunk.char_end,
                    token_count=chunk.token_count,
                    metadata_json=chunk.metadata,
                    embedding=emb,
                )
                session.add(model)
                chunk_ids.append(chunk.id)

        return chunk_ids

    async def similarity_search(
        self,
        query_vector: list[float],
        top_k: int = 10,
        session_id: str | None = None,
    ) -> list[SearchResult]:
        async with self._db.session() as session:
            # Cosine distance: 1 - cosine_similarity
            distance = DocumentChunkModel.embedding.cosine_distance(query_vector)
            stmt = select(DocumentChunkModel, distance.label("dist")).order_by("dist").limit(top_k)
            if session_id:
                stmt = stmt.where(DocumentChunkModel.session_id == session_id)

            result = await session.execute(stmt)
            rows = result.all()

            results: list[SearchResult] = []
            for rank, (model, dist) in enumerate(rows, start=1):
                similarity = max(0.0, min(1.0, 1.0 - float(dist)))
                chunk = DocumentChunk(
                    id=model.id,
                    document_id=model.document_id,
                    source_id=model.source_id,
                    chunk_index=model.chunk_index,
                    title=model.section_title or "Chunk",
                    source_url=None,
                    content=model.content,
                    searchable_text=model.searchable_text,
                    section_title=model.section_title or "",
                    section_path=list(model.section_path or []),
                    page_number=model.page_number,
                    bbox=tuple(model.bbox) if model.bbox else None,
                    char_start=model.char_start or 0,
                    char_end=model.char_end or len(model.content),
                    token_count=model.token_count,
                    metadata=dict(model.metadata_json or {}),
                )
                results.append(
                    SearchResult(
                        chunk=chunk,
                        score=similarity,
                        dense_score=similarity,
                        rank=rank,
                    )
                )
            return results

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

        # Full-text sparse search using PostgreSQL tsvector / websearch_to_tsquery
        sparse_results: list[SearchResult] = []
        async with self._db.session() as session:
            try:
                tsv_query = func.websearch_to_tsquery("english", query_text)
                ts_rank = func.ts_rank_cd(DocumentChunkModel.tsv, tsv_query)
                stmt = (
                    select(DocumentChunkModel, ts_rank.label("rank_score"))
                    .where(DocumentChunkModel.tsv.op("@@")(tsv_query))
                    .order_by(text("rank_score DESC"))
                    .limit(top_k * 2)
                )
                if session_id:
                    stmt = stmt.where(DocumentChunkModel.session_id == session_id)

                res = await session.execute(stmt)
                for rank, (model, r_score) in enumerate(res.all(), start=1):
                    chunk = DocumentChunk(
                        id=model.id,
                        document_id=model.document_id,
                        source_id=model.source_id,
                        chunk_index=model.chunk_index,
                        title=model.section_title or "Chunk",
                        source_url=None,
                        content=model.content,
                        searchable_text=model.searchable_text,
                        section_title=model.section_title or "",
                        section_path=list(model.section_path or []),
                        page_number=model.page_number,
                        bbox=tuple(model.bbox) if model.bbox else None,
                        char_start=model.char_start or 0,
                        char_end=model.char_end or len(model.content),
                        token_count=model.token_count,
                        metadata=dict(model.metadata_json or {}),
                    )
                    sparse_results.append(
                        SearchResult(
                            chunk=chunk,
                            score=float(r_score),
                            sparse_score=float(r_score),
                            rank=rank,
                        )
                    )
            except Exception:
                # If tsquery fails (e.g. SQLite test fallback), sparse returns empty
                sparse_results = []

        return reciprocal_rank_fusion(
            dense_candidates,
            sparse_results,
            w_dense=alpha,
            w_sparse=1.0 - alpha,
            top_n=top_k,
        )

    async def delete_by_document(self, document_id: str) -> int:
        async with self._db.session() as session:
            stmt = delete(DocumentChunkModel).where(DocumentChunkModel.document_id == document_id)
            res = await session.execute(stmt)
            return res.rowcount or 0

    async def delete_by_session(self, session_id: str) -> int:
        async with self._db.session() as session:
            stmt = delete(DocumentChunkModel).where(DocumentChunkModel.session_id == session_id)
            res = await session.execute(stmt)
            return res.rowcount or 0
