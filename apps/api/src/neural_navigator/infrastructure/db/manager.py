"""Database connection manager supporting async PostgreSQL (asyncpg) and SQLite fallback."""

from __future__ import annotations

import contextlib
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING

import structlog
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from neural_navigator.infrastructure.db.base import Base

if TYPE_CHECKING:
    from neural_navigator.core.config import Settings

_logger = structlog.stdlib.get_logger(__name__)


class DatabaseManager:
    """Manages async database engine, session factory, and lifecycle."""

    def __init__(self, settings: Settings | None = None, dsn: str | None = None) -> None:
        self._settings = settings
        self._dsn = dsn or (settings.postgres_dsn if settings else None)
        self._is_postgres = False
        self._engine: AsyncEngine | None = None
        self._session_factory: async_sessionmaker[AsyncSession] | None = None

        self._init_engine()

    def _init_engine(self) -> None:
        """Initialize the async engine with appropriate driver and pooling."""
        if self._dsn:
            # PostgreSQL configured
            dsn = self._dsn
            if dsn.startswith("postgresql://"):
                dsn = dsn.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif dsn.startswith("postgres://"):
                dsn = dsn.replace("postgres://", "postgresql+asyncpg://", 1)

            pool_size = self._settings.postgres_pool_size if self._settings else 10
            max_overflow = self._settings.postgres_max_overflow if self._settings else 20
            pool_timeout = self._settings.postgres_pool_timeout if self._settings else 30.0
            pool_recycle = self._settings.postgres_pool_recycle if self._settings else 1800

            self._engine = create_async_engine(
                dsn,
                pool_size=pool_size,
                max_overflow=max_overflow,
                pool_timeout=pool_timeout,
                pool_recycle=pool_recycle,
                pool_pre_ping=True,
                echo=False,
            )
            self._is_postgres = True
            _logger.info(
                "db.engine.initialized", dialect="postgresql", dsn_masked="postgresql+asyncpg://***"
            )
        else:
            # SQLite fallback (in-memory or local file)
            db_path = self._settings.conversation_db_path if self._settings else ":memory:"
            if db_path == ":memory:":
                sqlite_url = "sqlite+aiosqlite:///:memory:"
            else:
                sqlite_url = f"sqlite+aiosqlite:///{db_path}"

            self._engine = create_async_engine(
                sqlite_url,
                echo=False,
            )
            self._is_postgres = False
            _logger.info("db.engine.initialized", dialect="sqlite", db_path=db_path)

        self._session_factory = async_sessionmaker(
            bind=self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )

    @property
    def engine(self) -> AsyncEngine:
        if self._engine is None:
            raise RuntimeError("Database engine is not initialized")
        return self._engine

    @property
    def is_postgres(self) -> bool:
        return self._is_postgres

    @contextlib.asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        """Provide a transactional async session context."""
        if self._session_factory is None:
            raise RuntimeError("Database session factory is not initialized")

        async with self._session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def create_all_tables(self) -> None:
        """Create all tables in the metadata (useful for SQLite / testing)."""
        if self._engine is None:
            return
        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def drop_all_tables(self) -> None:
        """Drop all tables in the metadata (useful for test resets)."""
        if self._engine is None:
            return
        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    async def check_health(self) -> bool:
        """Verify database connectivity."""
        if self._engine is None:
            return False
        try:
            from sqlalchemy import text

            async with self.session() as session:
                await session.execute(text("SELECT 1"))
            return True
        except Exception as exc:
            _logger.error("db.health_check.failed", error=str(exc))
            return False

    async def close(self) -> None:
        """Dispose of the engine and connection pool."""
        if self._engine is not None:
            await self._engine.dispose()
            _logger.info("db.engine.disposed")
