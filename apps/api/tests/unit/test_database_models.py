"""Unit tests for SQLAlchemy 2.0 declarative models and ResearchSessionRepository."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from neural_navigator.infrastructure.db.base import Base
from neural_navigator.infrastructure.db.repositories.session_repository import (
    ResearchSessionRepository,
)


@pytest.fixture
async def async_db_session() -> AsyncSession:
    # Use in-memory SQLite with aiosqlite for isolated test runs
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.mark.asyncio
async def test_relational_models_and_repository_lifecycle(async_db_session: AsyncSession) -> None:
    repo = ResearchSessionRepository(async_db_session)

    # 1. User & Session Creation
    user = await repo.get_or_create_user(
        user_id="usr_alice_123",
        email="alice@example.com",
        display_name="Alice Researcher",
    )
    assert user.id == "usr_alice_123"
    assert user.email == "alice@example.com"

    session = await repo.create_session(
        user_id="usr_alice_123",
        title="Fault-Tolerant Quantum Computing",
        mode="deep_research",
        metadata={"domain": "physics"},
    )
    assert session.id.startswith("ses_")
    assert session.title == "Fault-Tolerant Quantum Computing"
    assert session.mode == "deep_research"

    # 2. Append Turn with full relational artifacts
    query = await repo.append_query(
        session_id=session.id,
        role="assistant",
        content="Surface codes have a 1% fault-tolerant threshold [1].",
        synthesized_text="Surface codes have a 1% fault-tolerant threshold [1].",
        intent="explain",
        domain="quantum",
        complexity="hard",
        egi_score=0.94,
        stage_timings=[{"stage": "total", "duration_ms": 120.5}],
        sources=[
            {
                "id": "src_fowler_2012",
                "url": "https://arxiv.org/abs/1208.0928",
                "url_hash": "hash_1208",
                "title": "Surface codes: Towards practical large-scale quantum computation",
                "domain": "arxiv.org",
                "source_type": "paper",
                "authority_score": 0.95,
                "snippet": "Surface code architecture description.",
            }
        ],
        evidence=[
            {
                "id": "evi_fowler_1",
                "source_id": "src_fowler_2012",
                "text": "Surface codes offer an error threshold of approximately 1 percent.",
                "confidence": 0.95,
                "relevance_score": 0.98,
                "page_number": 1,
            }
        ],
        claims=[
            {
                "id": "clm_threshold",
                "text": "Surface codes have a 1% fault-tolerant threshold.",
                "status": "supported",
                "confidence": 0.95,
                "importance": "high",
                "sentence_index": 0,
            }
        ],
        citations=[
            {
                "id": "cit_1",
                "claim_id": "clm_threshold",
                "evidence_id": "evi_fowler_1",
                "source_id": "src_fowler_2012",
                "inline_marker": "[1]",
                "citation_index": 1,
            }
        ],
        topology_data={
            "nodes": [
                {"id": "src_fowler_2012", "type": "source", "label": "Fowler (2012)"},
                {"id": "clm_threshold", "type": "claim", "label": "1% Threshold"},
            ],
            "edges": [
                {
                    "id": "ed_1",
                    "source_node_id": "src_fowler_2012",
                    "target_node_id": "clm_threshold",
                    "type": "supports",
                }
            ],
            "density": 0.5,
            "cluster_count": 1,
        },
    )

    assert query.id.startswith("qry_")
    assert query.egi_score == 0.94

    # 3. Retrieve Session
    loaded_session = await repo.get_session(session.id)
    assert loaded_session is not None
    assert len(loaded_session.queries) == 1
    assert loaded_session.queries[0].id == query.id
    assert len(loaded_session.sources) == 1
    assert loaded_session.sources[0].id == "src_fowler_2012"

    # 4. List User Sessions
    sessions_list = await repo.list_user_sessions("usr_alice_123")
    assert len(sessions_list) == 1
    assert sessions_list[0].id == session.id


@pytest.mark.asyncio
async def test_database_manager_sqlite_lifecycle() -> None:
    from neural_navigator.core.config import Settings
    from neural_navigator.infrastructure.db.manager import DatabaseManager

    settings = Settings(conversation_db_path=":memory:")
    manager = DatabaseManager(settings=settings)

    try:
        await manager.create_all_tables()
        is_healthy = await manager.check_health()
        assert is_healthy is True
    finally:
        await manager.close()
