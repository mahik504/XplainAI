"""Unit tests for VectorStore operations and search retrieval."""

import pytest

from neural_navigator.infrastructure.chunking.models import DocumentChunk
from neural_navigator.infrastructure.vectorstore.memory import InMemoryVectorStore
from neural_navigator.llm.embeddings.mock import MockEmbeddingProvider


@pytest.mark.asyncio
async def test_in_memory_vector_store_crud_and_similarity() -> None:
    embedder = MockEmbeddingProvider(dimension=128)
    store = InMemoryVectorStore(embedding_provider=embedder)

    chunk1 = DocumentChunk(
        id="chk_1",
        document_id="doc_1",
        source_id="src_1",
        chunk_index=0,
        title="Surface Codes",
        source_url="https://arxiv.org/1",
        content="Surface codes are fault-tolerant quantum error correcting codes on a 2D lattice.",
        searchable_text="[Document: Surface Codes] Surface codes are fault-tolerant quantum error correcting codes on a 2D lattice.",
        section_title="Overview",
        section_path=["Surface Codes", "Overview"],
        metadata={"session_id": "ses_A"},
    )
    chunk2 = DocumentChunk(
        id="chk_2",
        document_id="doc_2",
        source_id="src_2",
        chunk_index=0,
        title="Trapped Ion Computing",
        source_url="https://arxiv.org/2",
        content="Trapped ion quantum computers use laser pulses to manipulate ytterbium ion qubits.",
        searchable_text="[Document: Trapped Ions] Trapped ion quantum computers use laser pulses to manipulate ytterbium ion qubits.",
        section_title="Laser Control",
        section_path=["Trapped Ions", "Laser Control"],
        metadata={"session_id": "ses_B"},
    )

    ids = await store.add_chunks([chunk1, chunk2])
    assert ids == ["chk_1", "chk_2"]

    # 1. Dense similarity search for query vector matching chunk1 text
    q_vec = await embedder.embed_query(chunk1.searchable_text)
    sim_results = await store.similarity_search(q_vec, top_k=2)
    assert len(sim_results) == 2
    assert sim_results[0].chunk.id == "chk_1"
    assert sim_results[0].score >= 0.99

    # 2. Session isolation filter
    ses_b_results = await store.similarity_search(q_vec, top_k=2, session_id="ses_B")
    assert len(ses_b_results) == 1
    assert ses_b_results[0].chunk.id == "chk_2"

    # 3. Hybrid search combining BM25 keyword matching
    hybrid_results = await store.hybrid_search(
        query_text="ytterbium laser pulses",
        query_vector=q_vec,
        top_k=2,
        alpha=0.5,
    )
    assert len(hybrid_results) >= 1
    top_chunk = hybrid_results[0].chunk
    assert top_chunk.id in {"chk_1", "chk_2"}

    # 4. Deletion by document
    deleted = await store.delete_by_document("doc_1")
    assert deleted == 1
    remaining = await store.similarity_search(q_vec, top_k=10)
    assert len(remaining) == 1
    assert remaining[0].chunk.id == "chk_2"
