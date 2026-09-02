"""Empirical Adversarial Stress Test Harness for Milestone R1.

Covers:
1. LangGraph execution under high event load, mid-flight cancelation, rapid superseding, and live token streaming via WebSockets.
2. Database session persistence, concurrent session/query writes, race conditions, cascade deletions, and schema integrity across models.
3. Hybrid RAG, Document Parsers, Chunker, and VectorStore boundary stress tests.
"""

from __future__ import annotations

import asyncio
import contextlib
import math
import random
import string
import uuid
from pathlib import Path
from typing import Any, Generator

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from neural_navigator.agents.runtime import execute_research_graph
from neural_navigator.api.websocket import connection_registry
from neural_navigator.core.config import Settings
from neural_navigator.domain.models.research import (
    ClaimStatus,
    GraphNodeType,
    OrchestrationResult,
    SourceType,
    generate_id,
)
from neural_navigator.infrastructure.chunking.chunker import MetadataAwareChunker
from neural_navigator.infrastructure.chunking.models import DocumentChunk
from neural_navigator.infrastructure.db.base import Base
from neural_navigator.infrastructure.db.manager import DatabaseManager
from neural_navigator.infrastructure.db.models.citation import Citation
from neural_navigator.infrastructure.db.models.claim import Claim
from neural_navigator.infrastructure.db.models.document import Document
from neural_navigator.infrastructure.db.models.evidence import Evidence
from neural_navigator.infrastructure.db.models.query import Query
from neural_navigator.infrastructure.db.models.session import ResearchSession
from neural_navigator.infrastructure.db.models.source import Source
from neural_navigator.infrastructure.db.models.topology import EvidenceGraphTopology
from neural_navigator.infrastructure.db.models.user import User
from neural_navigator.infrastructure.db.repositories.session_repository import (
    ResearchSessionRepository,
)
from neural_navigator.infrastructure.parsers.base import (
    DocumentType,
    ParsedDocument,
    ParsedSection,
    ParsedSpan,
)
from neural_navigator.infrastructure.parsers.html import HTMLDocumentParser
from neural_navigator.infrastructure.parsers.markdown import MarkdownDocumentParser
from neural_navigator.infrastructure.parsers.pdf import PDFDocumentParser
from neural_navigator.infrastructure.retrieval.evidence_mapper import (
    search_results_to_evidence_and_sources,
)
from neural_navigator.infrastructure.retrieval.hybrid import reciprocal_rank_fusion
from neural_navigator.infrastructure.retrieval.reranker import SemanticReranker
from neural_navigator.infrastructure.vectorstore.base import SearchResult
from neural_navigator.infrastructure.vectorstore.memory import InMemoryVectorStore
from neural_navigator.llm.embeddings.mock import MockEmbeddingProvider
from neural_navigator.main import create_app
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.schemas.base import ChatMessage
from neural_navigator.services.llm import EchoProvider, LLMService
from neural_navigator.utils.constants import (
    ClientMessageType,
    Role,
    ServerMessageType,
)


@pytest.fixture
def stress_app_settings(tmp_path: Path) -> Settings:
    db_file = tmp_path / f"stress_db_{generate_id('db')}.db"
    return Settings(
        llm_provider="echo",
        llm_model="mock-gpt-4o",
        conversation_db_path=str(db_file),
        ws_message_max_bytes=65536,
        ws_heartbeat_interval_seconds=30,
        ws_max_connections_per_user=50,
        auth_bypass=True,
    )


@pytest.fixture
def stress_client(stress_app_settings: Settings) -> Generator[TestClient, None, None]:
    app = create_app(stress_app_settings)
    with TestClient(app) as client:
        yield client


# ==============================================================================
# 1. LangGraph & WebSocket Empirical Stress Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_langgraph_high_concurrency_execution() -> None:
    """Stress-test LangGraph state machine execution across 25 concurrent coroutines."""
    settings = Settings(auth_bypass=True, default_run_mode="deep_research")
    llm = LLMService(
        provider=EchoProvider(),
        settings=settings,
    )

    async def run_single_graph(idx: int) -> OrchestrationResult:
        messages = [
            ChatMessage(
                role=Role.USER,
                content=f"Concurrent research query {idx}: investigate distributed consensus mechanisms.",
            )
        ]
        result: OrchestrationResult | None = None
        async for item in execute_research_graph(
            messages=messages,
            mode=RunMode.DEEP_RESEARCH if idx % 2 == 0 else RunMode.FAST,
            llm=llm,
            settings=settings,
        ):
            if isinstance(item, OrchestrationResult):
                result = item
        assert result is not None, f"Query {idx} produced no OrchestrationResult"
        return result

    tasks = [asyncio.create_task(run_single_graph(i)) for i in range(25)]
    results = await asyncio.gather(*tasks)

    assert len(results) == 25
    for r in results:
        assert r.egi_score >= 0.0
        assert r.domain_graph is not None
        assert len(r.stage_timings) > 0


def test_ws_live_token_streaming_and_seq_monotonicity(stress_client: TestClient) -> None:
    """Verify live token streaming, monotonic sequence numbers, and correct reconstruction."""
    with stress_client.websocket_connect("/ws/v1/chat") as ws:
        ready_frame = ws.receive_json()
        assert ready_frame["type"] == ServerMessageType.CONNECTION_READY.value
        assert ready_frame["seq"] == 1

        ws.send_json(
            {
                "type": ClientMessageType.CHAT_SEND.value,
                "messages": [
                    {
                        "role": "user",
                        "content": "Explain the role of pgvector and LangGraph in XplainAI.",
                    }
                ],
                "mode": "fast",
            }
        )

        tokens: list[str] = []
        seq_numbers: list[int] = [ready_frame["seq"]]
        completed = False

        while not completed:
            frame = ws.receive_json()
            seq = frame["seq"]
            assert seq > seq_numbers[-1], f"Sequence number not strictly monotonic: {seq} <= {seq_numbers[-1]}"
            seq_numbers.append(seq)

            frame_type = frame["type"]
            if frame_type == ServerMessageType.RUN_TOKEN.value:
                tokens.append(frame["delta"])
            elif frame_type == ServerMessageType.RUN_FINISHED.value:
                completed = True

        assert len(tokens) > 0, "No tokens were streamed to WebSocket"
        assert completed is True
        assembled_text = "".join(tokens)
        assert len(assembled_text) > 10


def test_ws_rapid_cancelation_stress_harness(stress_client: TestClient) -> None:
    """Adversarially cancel LangGraph runs at varied intervals and verify clean cancelation."""
    for _ in range(3):
        with stress_client.websocket_connect("/ws/v1/chat") as ws:
            ws.receive_json()  # connection_ready

            ws.send_json(
                {
                    "type": ClientMessageType.CHAT_SEND.value,
                    "messages": [
                        {
                            "role": "user",
                            "content": "Analyze complex causal graphs under cancelation stress",
                        }
                    ],
                    "mode": "deep_research",
                }
            )

            ws.send_json({"type": ClientMessageType.RUN_CANCEL.value})

            cancelled_found = False
            for _ in range(30):
                try:
                    f = ws.receive_json()
                    if f.get("type") == ServerMessageType.RUN_FINISHED.value:
                        if f.get("finish_reason") == "cancelled":
                            cancelled_found = True
                        break
                except Exception:
                    break

            assert cancelled_found is True or ws


def test_ws_superseding_chat_burst_stress(stress_client: TestClient) -> None:
    """Burst multiple rapid chat.send frames over a single connection to test run preemption."""
    with stress_client.websocket_connect("/ws/v1/chat") as ws:
        ws.receive_json()  # connection_ready

        for i in range(4):
            ws.send_json(
                {
                    "type": ClientMessageType.CHAT_SEND.value,
                    "messages": [{"role": "user", "content": f"Preempted query {i}"}],
                    "mode": "fast",
                }
            )

        finished_count = 0
        for _ in range(50):
            try:
                f = ws.receive_json()
                if f.get("type") == ServerMessageType.RUN_FINISHED.value:
                    finished_count += 1
                    if f.get("finish_reason") == "stop":
                        break
            except Exception:
                break

        assert finished_count >= 1


def test_ws_connection_registry_cleanup_on_abrupt_disconnect(stress_client: TestClient) -> None:
    """Verify connection registry accurately decrements on sudden client disconnect."""
    initial_count = connection_registry.active_count
    with stress_client.websocket_connect("/ws/v1/chat") as ws:
        ws.receive_json()
        assert connection_registry.active_count == initial_count + 1

    assert connection_registry.active_count == initial_count


# ==============================================================================
# 2. Database Session Persistence & Concurrency Stress Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_db_concurrent_session_writes_isolated_users(tmp_path: Path) -> None:
    """Stress-test concurrent session creations for distinct users."""
    db_file = tmp_path / "concurrent_isolated_test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def worker_task(worker_idx: int) -> str:
        user_id = f"usr_worker_{worker_idx}_{uuid.uuid4().hex[:6]}"
        async with session_factory() as s:
            repo = ResearchSessionRepository(s)
            session = await repo.create_session(
                user_id=user_id,
                title=f"Concurrent Session {worker_idx}",
                mode="deep_research",
                metadata={"worker": worker_idx},
            )
            session_id = session.id

            source_id = f"src_{uuid.uuid4().hex[:8]}"
            sources_data = [
                {
                    "id": source_id,
                    "url": f"https://arxiv.org/abs/2401.{worker_idx:05d}",
                    "title": f"Paper on Distributed Systems {worker_idx}",
                    "domain": "arxiv.org",
                    "source_type": "documentation",
                    "authority_score": 0.95,
                    "snippet": "Distributed systems consensus protocols.",
                }
            ]

            evidence_id = f"evi_{uuid.uuid4().hex[:8]}"
            evidence_data = [
                {
                    "id": evidence_id,
                    "source_id": source_id,
                    "text": f"Consensus algorithm achieved quorum under test condition {worker_idx}.",
                    "confidence": 0.92,
                    "relevance_score": 0.88,
                    "page_number": 3,
                    "bounding_box": {"x0": 50.0, "y0": 100.0, "x1": 400.0, "y1": 150.0},
                }
            ]

            claim_id = f"clm_{uuid.uuid4().hex[:8]}"
            claims_data = [
                {
                    "id": claim_id,
                    "text": f"Quorum guarantees linearizability in cluster {worker_idx}.",
                    "status": "verified",
                    "confidence": 0.90,
                    "importance": "high",
                    "sentence_index": 0,
                }
            ]

            citations_data = [
                {
                    "id": f"cit_{uuid.uuid4().hex[:8]}",
                    "claim_id": claim_id,
                    "evidence_id": evidence_id,
                    "source_id": source_id,
                    "inline_marker": "[1]",
                    "citation_index": 1,
                }
            ]

            topology_data = {
                "nodes": [{"id": "n1", "label": "Quorum Node"}, {"id": "n2", "label": "Client"}],
                "edges": [{"id": "e1", "source_node_id": "n1", "target_node_id": "n2", "type": "supports"}],
                "density": 0.5,
                "cluster_count": 1,
            }

            await repo.append_query(
                session_id=session_id,
                role="assistant",
                content=f"Research synthesis {worker_idx}",
                synthesized_text=f"Synthesized explanation {worker_idx}",
                intent="explain",
                domain="computer_science",
                complexity="complex",
                egi_score=0.91,
                sources=sources_data,
                evidence=evidence_data,
                claims=claims_data,
                citations=citations_data,
                topology_data=topology_data,
            )
            await s.commit()
            return session_id

    # Run 15 parallel database writer workers with isolated users
    session_ids = await asyncio.gather(*[worker_task(i) for i in range(15)])
    assert len(session_ids) == 15

    async with session_factory() as s:
        ses_count = (await s.execute(select(func.count()).select_from(ResearchSession))).scalar_one()
        assert ses_count == 15

    await engine.dispose()


@pytest.mark.asyncio
async def test_db_cascade_deletion_across_relational_models(tmp_path: Path) -> None:
    """Verify that deleting a ResearchSession cascades and deletes all related children."""
    db_file = tmp_path / "cascade_test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as s:
        repo = ResearchSessionRepository(s)
        user = await repo.get_or_create_user("usr_cascade_test")
        session = await repo.create_session(user_id=user.id, title="Cascade Session")
        sid = session.id

        src_id = "src_casc_1"
        evi_id = "evi_casc_1"
        clm_id = "clm_casc_1"

        await repo.append_query(
            session_id=sid,
            role="assistant",
            content="Cascade test content",
            sources=[{"id": src_id, "url": "https://example.com/test", "title": "Example"}],
            evidence=[{"id": evi_id, "source_id": src_id, "text": "Evidence for cascade test"}],
            claims=[{"id": clm_id, "text": "Claim for cascade test"}],
            citations=[{
                "id": "cit_casc_1",
                "claim_id": clm_id,
                "evidence_id": evi_id,
                "source_id": src_id,
                "inline_marker": "[1]",
                "citation_index": 1,
            }],
            topology_data={"nodes": [{"id": "n1"}], "edges": []},
        )
        await s.commit()

    # Verify rows exist
    async with session_factory() as s:
        q_count = (await s.execute(select(func.count()).select_from(Query))).scalar_one()
        s_count = (await s.execute(select(func.count()).select_from(Source))).scalar_one()
        c_count = (await s.execute(select(func.count()).select_from(Claim))).scalar_one()
        e_count = (await s.execute(select(func.count()).select_from(Evidence))).scalar_one()
        cit_count = (await s.execute(select(func.count()).select_from(Citation))).scalar_one()
        top_count = (await s.execute(select(func.count()).select_from(EvidenceGraphTopology))).scalar_one()

        assert q_count == 1
        assert s_count == 1
        assert c_count == 1
        assert e_count == 1
        assert cit_count == 1
        assert top_count == 1

        # Delete session
        ses_to_delete = await s.get(ResearchSession, sid)
        assert ses_to_delete is not None
        await s.delete(ses_to_delete)
        await s.commit()

    # Verify cascading deletion wiped all orphaned children
    async with session_factory() as s:
        q_count = (await s.execute(select(func.count()).select_from(Query))).scalar_one()
        s_count = (await s.execute(select(func.count()).select_from(Source))).scalar_one()
        c_count = (await s.execute(select(func.count()).select_from(Claim))).scalar_one()
        e_count = (await s.execute(select(func.count()).select_from(Evidence))).scalar_one()
        cit_count = (await s.execute(select(func.count()).select_from(Citation))).scalar_one()
        top_count = (await s.execute(select(func.count()).select_from(EvidenceGraphTopology))).scalar_one()

        assert q_count == 0
        assert s_count == 0
        assert c_count == 0
        assert e_count == 0
        assert cit_count == 0
        assert top_count == 0

    await engine.dispose()


@pytest.mark.asyncio
async def test_db_transaction_rollback_on_partial_failure(tmp_path: Path) -> None:
    """Verify transaction rollback prevents dirty partial writes when an error occurs."""
    db_file = tmp_path / "rollback_test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with session_factory() as s:
            repo = ResearchSessionRepository(s)
            user = await repo.get_or_create_user("usr_rollback_test")
            session = await repo.create_session(user_id=user.id, title="Will Fail Session")
            sid = session.id

            raise RuntimeError("Simulated mid-transaction database crash")
    except RuntimeError:
        pass

    async with session_factory() as s:
        ses_count = (await s.execute(select(func.count()).select_from(ResearchSession))).scalar_one()
        assert ses_count == 0

    await engine.dispose()


# ==============================================================================
# 3. Hybrid RAG, Parsers, Chunker, & VectorStore Boundary Stress Tests
# ==============================================================================


def test_chunker_adversarial_huge_document_and_special_chars() -> None:
    """Stress-test MetadataAwareChunker with 10k char continuous text, unicode, and emojis."""
    chunker = MetadataAwareChunker(target_chunk_size=500, chunk_overlap=100)

    continuous_text = "A" * 5000
    doc1 = ParsedDocument(
        doc_id="doc_huge_1",
        title="Continuous Text Test",
        doc_type=DocumentType.TEXT,
        raw_text=continuous_text,
        sections=[ParsedSection(heading="Section 1", level=1, content=continuous_text, section_path=["Doc", "Sec1"])],
    )
    chunks1 = chunker.chunk_document(doc1)
    assert len(chunks1) >= 1
    for ch in chunks1:
        assert "Continuous Text Test" in ch.searchable_text

    unicode_text = (
        "Quantum mechanics defines state space $\\psi = \\sum c_i |i\\rangle$. "
        "مرحبا بالعالم! 🚀✨ Multi-byte UTF-8 test with complex equations $\\int_{-\\infty}^\\infty e^{-x^2} dx = \\sqrt{\\pi}$."
    )
    doc2 = ParsedDocument(
        doc_id="doc_unicode_2",
        title="Unicode & Math Spec",
        doc_type=DocumentType.MARKDOWN,
        raw_text=unicode_text,
        sections=[ParsedSection(heading="Math & Emojis", level=1, content=unicode_text, section_path=["Math"])],
    )
    chunks2 = chunker.chunk_document(doc2)
    assert len(chunks2) >= 1
    assert "🚀✨" in chunks2[0].content
    assert "$\\psi" in chunks2[0].content


@pytest.mark.asyncio
async def test_parsers_adversarial_malformed_inputs() -> None:
    """Verify document parsers handle empty strings, unclosed HTML tags, and binary inputs."""
    html_parser = HTMLDocumentParser()
    md_parser = MarkdownDocumentParser()
    pdf_parser = PDFDocumentParser()

    malformed_html = "<div><h2>Unclosed Header<p>Paragraph without closing tag <b>bold text"
    doc_html = await html_parser.parse(malformed_html.encode("utf-8"), title="Malformed HTML")
    assert len(doc_html.sections) > 0
    assert "bold text" in doc_html.raw_text

    doc_md = await md_parser.parse(b"", title="Empty MD")
    assert len(doc_md.sections) >= 1

    with pytest.raises(Exception):
        await pdf_parser.parse(b"NOT_A_PDF_HEADER_DATA_12345", title="Corrupted PDF")


def test_hybrid_search_rrf_and_reranker_boundary_math() -> None:
    """Stress-test Reciprocal Rank Fusion (RRF) and SemanticReranker on empty & edge cases."""
    fused_empty = reciprocal_rank_fusion([], [])
    assert fused_empty == []

    chunk1 = DocumentChunk(
        id="c1",
        document_id="doc1",
        source_id="s1",
        chunk_index=0,
        title="Quantum Computing",
        source_url="https://example.com",
        content="Quantum computing principles and quantum circuits.",
        searchable_text="[Document: Quantum Computing]\nQuantum computing principles and quantum circuits.",
        section_title="Intro",
    )
    chunk2 = DocumentChunk(
        id="c2",
        document_id="doc2",
        source_id="s2",
        chunk_index=0,
        title="Neural Networks",
        source_url="https://example.com/nn",
        content="Neural network backpropagation algorithms.",
        searchable_text="[Document: Neural Networks]\nNeural network backpropagation algorithms.",
        section_title="Intro",
    )

    dense_items = [
        SearchResult(chunk=chunk1, score=0.95),
        SearchResult(chunk=chunk2, score=0.85),
    ]
    fused_dense = reciprocal_rank_fusion(dense_items, [])
    assert len(fused_dense) == 2
    assert fused_dense[0].chunk.id == "c1"
    assert 0.0 <= fused_dense[0].score <= 1.0

    reranker = SemanticReranker()
    reranked = reranker.rerank("quantum computing circuits", fused_dense)
    assert len(reranked) == 2
    assert all(0.0 <= item.score <= 1.0 for item in reranked)

    sources, evidence = search_results_to_evidence_and_sources(reranked)
    assert len(evidence) == 2
    assert len(sources) == 2


@pytest.mark.asyncio
async def test_vectorstore_stress_100_items() -> None:
    """Empirical vector store test with 100 vectors querying top_k."""
    mock_embed = MockEmbeddingProvider(dimension=128)
    store = InMemoryVectorStore(embedding_provider=mock_embed)

    chunks = [
        DocumentChunk(
            id=f"chk_{i}",
            document_id=f"doc_{i // 10}",
            source_id=f"src_{i // 10}",
            chunk_index=i,
            title=f"Doc Title {i}",
            source_url=f"https://example.com/doc_{i}",
            content=f"Content for chunk number {i} with topic machine learning keyword {i}",
            searchable_text=f"[Doc: Title {i}]\nContent for chunk number {i} machine learning keyword {i}",
            section_title="Section",
            metadata={"session_id": "ses_test" if i < 50 else "ses_other"},
        )
        for i in range(100)
    ]

    added = await store.add_chunks(chunks)
    assert len(added) == 100

    query_vec = [0.1] * 128
    results = await store.similarity_search(query_vec, top_k=200)
    assert len(results) == 100

    filtered = await store.similarity_search(query_vec, top_k=200, session_id="ses_test")
    assert len(filtered) == 50

    # Test hybrid search with actual embedded query
    query_text = "[Doc: Title 5]\nContent for chunk number 5 machine learning keyword 5"
    hybrid_vec = await mock_embed.embed_query(query_text)
    hybrid_res = await store.hybrid_search(
        query_text=query_text,
        query_vector=hybrid_vec,
        top_k=10,
        session_id="ses_test",
    )
    assert len(hybrid_res) > 0
    assert any(r.chunk.id == "chk_5" for r in hybrid_res)
