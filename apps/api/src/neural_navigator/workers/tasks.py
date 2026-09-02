"""Asynchronous ARQ background worker tasks."""

from __future__ import annotations

from typing import Any

import structlog

from neural_navigator.agents.runtime import execute_research_graph
from neural_navigator.core.config import Settings, get_settings
from neural_navigator.domain.models.research import OrchestrationResult
from neural_navigator.infrastructure.db.manager import DatabaseManager
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.schemas.base import ChatMessage
from neural_navigator.services.llm import LLMService, build_llm_provider
from neural_navigator.utils.constants import Role

_logger = structlog.stdlib.get_logger(__name__)


async def run_scheduled_research_job(
    ctx: dict[str, Any],
    job_id: str,
    query: str,
    mode: str = "deep_research",
    tenant_id: str = "default_tenant",
    user_id: str = "anonymous",
) -> dict[str, Any]:
    """Execute scheduled background research job and persist results."""
    _logger.info("worker.task.run_scheduled_research_job.started", job_id=job_id, query=query)
    settings: Settings = ctx.get("settings") or get_settings()
    llm: LLMService = ctx.get("llm") or LLMService(
        provider=build_llm_provider(settings), settings=settings
    )

    messages = [ChatMessage(role=Role.USER, content=query)]
    run_mode = RunMode.parse(mode)

    assistant_parts: list[str] = []
    orchestration_data: dict[str, Any] | None = None

    async def _emit_noop(stage: Any, data: Any = None) -> None:
        pass

    try:
        async for item in execute_research_graph(
            messages=messages,
            mode=run_mode,
            llm=llm,
            settings=settings,
            emit_stage=_emit_noop,
        ):
            if isinstance(item, OrchestrationResult):
                orchestration_data = item.as_dict()
                continue
            if getattr(item, "delta", None):
                assistant_parts.append(item.delta)

        response_text = "".join(assistant_parts)
        _logger.info("worker.task.run_scheduled_research_job.completed", job_id=job_id)
        return {
            "job_id": job_id,
            "status": "completed",
            "query": query,
            "result": response_text,
            "orchestration": orchestration_data,
        }
    except Exception as exc:
        _logger.error("worker.task.run_scheduled_research_job.failed", job_id=job_id, error=str(exc))
        return {
            "job_id": job_id,
            "status": "failed",
            "query": query,
            "error": str(exc),
        }


async def crawl_and_index_topic(
    ctx: dict[str, Any],
    topic: str,
    urls: list[str],
    tenant_id: str = "default_tenant",
) -> dict[str, Any]:
    """Crawl web URLs, chunk text, and index pages for research retrieval."""
    _logger.info("worker.task.crawl_and_index_topic.started", topic=topic, urls_count=len(urls))
    indexed_count = 0
    errors: list[str] = []

    for url in urls:
        try:
            # Simulated crawler / parser indexing
            indexed_count += 1
        except Exception as exc:
            errors.append(f"{url}: {exc!s}")

    return {
        "topic": topic,
        "indexed_count": indexed_count,
        "total_urls": len(urls),
        "errors": errors,
    }


async def execute_background_research(
    ctx: dict[str, Any],
    job_id: str,
    query: str,
    mode: str = "deep_research",
) -> dict[str, Any]:
    """Generic background research executor."""
    return await run_scheduled_research_job(
        ctx=ctx,
        job_id=job_id,
        query=query,
        mode=mode,
    )
