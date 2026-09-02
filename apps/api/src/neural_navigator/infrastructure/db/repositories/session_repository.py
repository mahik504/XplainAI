"""Repository for managing ResearchSession and Query ORM entities."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import desc, select
from sqlalchemy.orm import selectinload

from neural_navigator.domain.models.research import generate_id
from neural_navigator.infrastructure.db.models.citation import Citation
from neural_navigator.infrastructure.db.models.claim import Claim
from neural_navigator.infrastructure.db.models.evidence import Evidence
from neural_navigator.infrastructure.db.models.query import Query
from neural_navigator.infrastructure.db.models.session import ResearchSession
from neural_navigator.infrastructure.db.models.source import Source
from neural_navigator.infrastructure.db.models.topology import EvidenceGraphTopology
from neural_navigator.infrastructure.db.models.user import User

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class ResearchSessionRepository:
    """Async repository for research sessions, queries, sources, and graph topologies."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def get_or_create_user(
        self, user_id: str, email: str | None = None, display_name: str | None = None
    ) -> User:
        """Fetch an existing user or create a new user profile."""
        stmt = select(User).where(User.id == user_id)
        result = await self._db.execute(stmt)
        user = result.scalar_one_or_none()
        if user is None:
            user = User(
                id=user_id,
                email=email,
                display_name=display_name or user_id,
                is_active=True,
                preferences={},
            )
            self._db.add(user)
            await self._db.flush()
        return user

    async def create_session(
        self,
        *,
        user_id: str = "anonymous",
        title: str = "New research",
        mode: str = "deep_research",
        metadata: dict[str, Any] | None = None,
        session_id: str | None = None,
    ) -> ResearchSession:
        """Create a new research session for a user."""
        await self.get_or_create_user(user_id)
        ses_id = session_id or generate_id("ses")
        new_session = ResearchSession(
            id=ses_id,
            user_id=user_id,
            title=title,
            mode=mode,
            status="active",
            metadata_json=metadata or {},
        )
        self._db.add(new_session)
        await self._db.flush()
        return new_session

    async def get_session(self, session_id: str) -> ResearchSession | None:
        """Get a session by ID with its queries and sources."""
        stmt = (
            select(ResearchSession)
            .where(ResearchSession.id == session_id)
            .options(
                selectinload(ResearchSession.queries),
                selectinload(ResearchSession.sources),
            )
        )
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_user_sessions(
        self, user_id: str, limit: int = 50, offset: int = 0
    ) -> list[ResearchSession]:
        """List sessions belonging to a user sorted by most recently updated."""
        stmt = (
            select(ResearchSession)
            .where(ResearchSession.user_id == user_id)
            .order_by(desc(ResearchSession.updated_at))
            .limit(limit)
            .offset(offset)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def append_query(
        self,
        *,
        session_id: str,
        role: str,
        content: str,
        synthesized_text: str | None = None,
        intent: str | None = None,
        domain: str | None = None,
        complexity: str | None = None,
        egi_score: float | None = None,
        stage_timings: list[dict[str, Any]] | None = None,
        token_usage: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        claims: list[dict[str, Any]] | None = None,
        sources: list[dict[str, Any]] | None = None,
        evidence: list[dict[str, Any]] | None = None,
        citations: list[dict[str, Any]] | None = None,
        topology_data: dict[str, Any] | None = None,
    ) -> Query:
        """Persist a turn and its relational claims, evidence, sources, and graph topology."""
        query_id = generate_id("qry")
        query = Query(
            id=query_id,
            session_id=session_id,
            role=role,
            content=content,
            synthesized_text=synthesized_text,
            intent=intent,
            domain=domain,
            complexity=complexity,
            egi_score=egi_score,
            status="completed",
            stage_timings=stage_timings or [],
            token_usage=token_usage,
            metadata_json=metadata or {},
        )
        self._db.add(query)

        # 1. Upsert Sources
        source_id_map: dict[str, str] = {}
        if sources:
            for s in sources:
                sid = s.get("id") or generate_id("src")
                source_id_map[s.get("url", "")] = sid
                src_entity = Source(
                    id=sid,
                    session_id=session_id,
                    url=s.get("url", ""),
                    url_hash=s.get("url_hash", sid),
                    title=s.get("title", ""),
                    domain=s.get("domain", ""),
                    source_type=s.get("source_type", "web"),
                    author=s.get("author"),
                    published_date=s.get("published_date"),
                    authority_score=float(s.get("authority_score", 0.8)),
                    snippet=s.get("snippet"),
                    metadata_json=s.get("metadata", {}),
                )
                self._db.add(src_entity)

        # 2. Insert Evidence
        evidence_id_map: dict[str, str] = {}
        if evidence:
            for ev in evidence:
                ev_id = ev.get("id") or generate_id("evi")
                evidence_id_map[ev_id] = ev_id
                src_id = ev.get("source_id") or source_id_map.get(
                    ev.get("source_url", ""), generate_id("src")
                )
                ev_entity = Evidence(
                    id=ev_id,
                    source_id=src_id,
                    text=ev.get("text", ""),
                    confidence=float(ev.get("confidence", 0.85)),
                    relevance_score=float(ev.get("relevance_score", 0.85)),
                    char_start=ev.get("char_start"),
                    char_end=ev.get("char_end"),
                    page_number=ev.get("page_number"),
                    bounding_box=ev.get("bounding_box"),
                )
                self._db.add(ev_entity)

        # 3. Insert Claims
        claim_id_map: dict[str, str] = {}
        if claims:
            for i, c in enumerate(claims):
                cid = c.get("id") or generate_id("clm")
                claim_id_map[cid] = cid
                clm_entity = Claim(
                    id=cid,
                    query_id=query_id,
                    text=c.get("text", ""),
                    status=c.get("status", "unverified"),
                    confidence=float(c.get("confidence", 0.7)),
                    importance=c.get("importance", "medium"),
                    sentence_index=int(c.get("sentence_index", i)),
                )
                self._db.add(clm_entity)

        # 4. Insert Citations
        if citations:
            for cit in citations:
                cit_id = cit.get("id") or generate_id("cit")
                cit_entity = Citation(
                    id=cit_id,
                    query_id=query_id,
                    claim_id=cit.get("claim_id", ""),
                    evidence_id=cit.get("evidence_id", ""),
                    source_id=cit.get("source_id", ""),
                    inline_marker=cit.get("inline_marker", "[1]"),
                    citation_index=int(cit.get("citation_index", 1)),
                )
                self._db.add(cit_entity)

        # 5. Insert Topology
        if topology_data:
            top_entity = EvidenceGraphTopology(
                id=generate_id("top"),
                query_id=query_id,
                node_count=len(topology_data.get("nodes", [])),
                edge_count=len(topology_data.get("edges", [])),
                density=float(topology_data.get("density", 0.0)),
                cluster_count=int(topology_data.get("cluster_count", 1)),
                graph_data=topology_data,
            )
            self._db.add(top_entity)

        await self._db.flush()
        return query
