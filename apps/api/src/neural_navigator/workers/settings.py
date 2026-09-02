"""ARQ Worker configuration and lifecycle hooks."""

from __future__ import annotations

from typing import Any

import structlog
from arq.connections import RedisSettings

from neural_navigator.core.config import Settings, get_settings
from neural_navigator.infrastructure.db.manager import DatabaseManager
from neural_navigator.services.llm import LLMService, build_llm_provider
from neural_navigator.workers.tasks import (
    crawl_and_index_topic,
    execute_background_research,
    run_scheduled_research_job,
)

_logger = structlog.stdlib.get_logger(__name__)


async def on_startup(ctx: dict[str, Any]) -> None:
    """Initialize persistent resources on ARQ worker boot."""
    _logger.info("worker.startup.begin")
    settings = get_settings()
    llm = LLMService(provider=build_llm_provider(settings), settings=settings)
    db_manager = DatabaseManager(settings=settings)

    ctx["settings"] = settings
    ctx["llm"] = llm
    ctx["db_manager"] = db_manager
    _logger.info("worker.startup.ready", redis=settings.redis_url or "redis://localhost:6379/0")


async def on_shutdown(ctx: dict[str, Any]) -> None:
    """Dispose of connections on worker shutdown."""
    _logger.info("worker.shutdown.begin")
    llm: LLMService | None = ctx.get("llm")
    if llm:
        await llm.aclose()

    db_manager: DatabaseManager | None = ctx.get("db_manager")
    if db_manager:
        await db_manager.close()

    _logger.info("worker.shutdown.completed")


def get_redis_settings() -> RedisSettings:
    """Resolve Redis connection parameters from application settings."""
    settings = get_settings()
    url = settings.redis_url or "redis://localhost:6379/0"
    return RedisSettings.from_dsn(url)


class WorkerSettings:
    """ARQ Worker configuration matching docker-compose.yml definition."""

    functions = [
        run_scheduled_research_job,
        crawl_and_index_topic,
        execute_background_research,
    ]
    redis_settings = get_redis_settings()
    on_startup = on_startup
    on_shutdown = on_shutdown
    max_jobs = 10
    job_timeout = 600
    keep_result = 3600
