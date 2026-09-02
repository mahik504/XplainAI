"""Developer API routes for async research jobs."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import Field

from neural_navigator.agents.runtime import execute_research_graph
from neural_navigator.api.middleware.auth import Principal, get_current_principal
from neural_navigator.core.config import Settings, get_settings
from neural_navigator.domain.models.research import OrchestrationResult
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.schemas.base import (
    BaseSchema,
    ChatMessage,
    ProblemDetail,
    generate_id,
    problem_from_exception,
    serialise_problem,
)
from neural_navigator.services.llm import LLMService, build_llm_provider
from neural_navigator.utils.constants import ErrorCode, Role

_logger = structlog.stdlib.get_logger(__name__)

router = APIRouter(prefix="/research/jobs", tags=["research-jobs"])

# In-memory registry for job status tracking across worker executions
_JOBS_REGISTRY: dict[str, dict[str, Any]] = {}


class ResearchJobCreate(BaseSchema):
    """Payload to trigger an asynchronous research job."""

    query: str = Field(min_length=1, description="Research question or topic to investigate.")
    mode: str = Field(default="deep_research", description="Execution mode: standard, deep_research, dialectic, fast.")
    max_sources: int = Field(default=10, ge=1, le=50, description="Maximum number of sources to crawl/search.")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Custom metadata for this job.")


class ResearchJobResponse(BaseSchema):
    """Job status and metadata."""

    job_id: str
    status: str  # queued, running, completed, failed
    query: str
    mode: str
    created_at: datetime
    completed_at: datetime | None = None
    stage: str | None = None
    progress: float = Field(default=0.0, ge=0.0, le=1.0)
    result: str | None = None
    orchestration: dict[str, Any] | None = None
    error: str | None = None
    user_id: str | None = None
    tenant_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


async def _execute_job_background(
    job_id: str,
    query: str,
    mode_str: str,
    settings: Settings,
) -> None:
    """Execute research graph asynchronously in the background."""
    if job_id not in _JOBS_REGISTRY:
        return

    _JOBS_REGISTRY[job_id]["status"] = "running"
    _JOBS_REGISTRY[job_id]["stage"] = "analyzing"
    _JOBS_REGISTRY[job_id]["progress"] = 0.1

    llm = LLMService(provider=build_llm_provider(settings), settings=settings)
    messages = [ChatMessage(role=Role.USER, content=query)]
    run_mode = RunMode.parse(mode_str)

    assistant_parts: list[str] = []
    orchestration_data: dict[str, Any] | None = None

    async def _emit_stage(stage: Any, data: Any = None) -> None:
        if job_id in _JOBS_REGISTRY:
            stage_name = getattr(stage, "value", str(stage))
            _JOBS_REGISTRY[job_id]["stage"] = stage_name
            # Update progress based on stage
            stage_progress_map = {
                "analyze": 0.2,
                "research": 0.4,
                "synthesize": 0.6,
                "extract_claims": 0.75,
                "verify_citations": 0.9,
                "complete": 1.0,
            }
            if stage_name in stage_progress_map:
                _JOBS_REGISTRY[job_id]["progress"] = stage_progress_map[stage_name]

    try:
        async for item in execute_research_graph(
            messages=messages,
            mode=run_mode,
            llm=llm,
            settings=settings,
            emit_stage=_emit_stage,
        ):
            if isinstance(item, OrchestrationResult):
                orchestration_data = item.as_dict()
                continue
            if getattr(item, "delta", None):
                assistant_parts.append(item.delta)

        response_text = "".join(assistant_parts)
        _JOBS_REGISTRY[job_id]["status"] = "completed"
        _JOBS_REGISTRY[job_id]["stage"] = "finished"
        _JOBS_REGISTRY[job_id]["progress"] = 1.0
        _JOBS_REGISTRY[job_id]["result"] = response_text
        _JOBS_REGISTRY[job_id]["orchestration"] = orchestration_data
        _JOBS_REGISTRY[job_id]["completed_at"] = datetime.now(timezone.utc)
    except Exception as exc:
        _logger.error("research_job.execution_failed", job_id=job_id, error=str(exc))
        _JOBS_REGISTRY[job_id]["status"] = "failed"
        _JOBS_REGISTRY[job_id]["error"] = str(exc)
        _JOBS_REGISTRY[job_id]["completed_at"] = datetime.now(timezone.utc)
    finally:
        await llm.aclose()


@router.post(
    "",
    response_model=ResearchJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit async research job",
    description="Submits an asynchronous deep research job for execution. Returns job ID immediately.",
)
async def create_research_job(
    payload: ResearchJobCreate,
    request: Request,
    principal: Principal = Depends(get_current_principal),
) -> ResearchJobResponse:
    job_id = generate_id("job")
    now = datetime.now(timezone.utc)

    job_entry: dict[str, Any] = {
        "job_id": job_id,
        "user_id": principal.user_id,
        "tenant_id": principal.tenant_id,
        "status": "queued",
        "query": payload.query,
        "mode": payload.mode,
        "created_at": now,
        "completed_at": None,
        "stage": "queued",
        "progress": 0.0,
        "result": None,
        "orchestration": None,
        "error": None,
        "metadata": payload.metadata,
    }
    _JOBS_REGISTRY[job_id] = job_entry

    settings = getattr(request.app.state, "settings", None) or get_settings()

    # Pre-flight cost circuit breaker check
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "127.0.0.1")
    )
    breaker = getattr(request.app.state, "cost_circuit_breaker", None)
    if breaker and getattr(settings, "budget_circuit_breaker_enabled", True):
        est_cost = breaker.estimate_cost("gpt-4o-mini", input_tokens=2000, output_tokens=4000)
        allowed, reason = await breaker.async_check_preflight(client_ip, est_cost)
        if not allowed:
            problem = problem_from_exception(
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                title="Budget Exceeded",
                code=ErrorCode.BUDGET_EXCEEDED,
                detail=reason or "Budget limit reached for demo mode",
                instance=request.url.path,
                request_id=request.headers.get("x-request-id"),
            )
            problem.type = "https://xplainai.io/errors/budget-exceeded"
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content=serialise_problem(problem),
                headers={
                    "Content-Type": "application/problem+json",
                    "Retry-After": "60",
                },
            )

    # Launch background task
    asyncio.create_task(
        _execute_job_background(
            job_id=job_id,
            query=payload.query,
            mode_str=payload.mode,
            settings=settings,
        )
    )

    return ResearchJobResponse(**job_entry)


@router.get(
    "/{job_id}",
    response_model=ResearchJobResponse,
    summary="Get research job status and result",
    description="Poll research job status, progress, stage events, and final synthesis output.",
)
async def get_research_job(
    job_id: str,
    principal: Principal = Depends(get_current_principal),
) -> ResearchJobResponse:
    job_entry = _JOBS_REGISTRY.get(job_id)
    if job_entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research job '{job_id}' not found.",
        )

    # Multi-tenant isolation check
    if (
        principal.user_id != "usr_anonymous"
        and principal.tenant_id != "default_tenant"
        and job_entry.get("tenant_id") != principal.tenant_id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research job '{job_id}' not found.",
        )

    return ResearchJobResponse(**job_entry)


@router.get(
    "",
    response_model=list[ResearchJobResponse],
    summary="List research jobs",
    description="List active and completed research jobs for current caller.",
)
async def list_research_jobs(
    principal: Principal = Depends(get_current_principal),
) -> list[ResearchJobResponse]:
    results: list[ResearchJobResponse] = []
    for job in _JOBS_REGISTRY.values():
        if (
            principal.user_id == "usr_anonymous"
            or principal.tenant_id == "default_tenant"
            or job.get("tenant_id") == principal.tenant_id
        ):
            results.append(ResearchJobResponse(**job))
    return results
