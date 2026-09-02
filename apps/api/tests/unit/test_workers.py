"""Unit tests for ARQ worker settings and background research tasks."""

import pytest

from neural_navigator.workers.settings import WorkerSettings, on_shutdown, on_startup
from neural_navigator.workers.tasks import (
    crawl_and_index_topic,
    execute_background_research,
    run_scheduled_research_job,
)


def test_worker_settings_configuration() -> None:
    assert len(WorkerSettings.functions) == 3
    assert run_scheduled_research_job in WorkerSettings.functions
    assert crawl_and_index_topic in WorkerSettings.functions
    assert execute_background_research in WorkerSettings.functions
    assert WorkerSettings.max_jobs == 10
    assert WorkerSettings.job_timeout == 600
    assert WorkerSettings.redis_settings is not None


@pytest.mark.asyncio
async def test_worker_tasks_execution() -> None:
    ctx = {}
    await on_startup(ctx)
    assert "settings" in ctx
    assert "llm" in ctx
    assert "db_manager" in ctx

    # 1. Execute scheduled research job
    res_job = await run_scheduled_research_job(
        ctx=ctx,
        job_id="job_worker_test",
        query="Explain supervised learning in 1 sentence",
        mode="standard",
    )
    assert res_job["status"] == "completed"
    assert "job_id" in res_job

    # 2. Execute crawl and index topic
    res_crawl = await crawl_and_index_topic(
        ctx=ctx,
        topic="Machine Learning",
        urls=["https://arxiv.org/abs/2301.00001", "https://arxiv.org/abs/2301.00002"],
    )
    assert res_crawl["indexed_count"] == 2
    assert res_crawl["topic"] == "Machine Learning"

    # 3. Shutdown lifecycle
    await on_shutdown(ctx)
