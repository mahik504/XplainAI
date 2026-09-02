"""Chat over HTTP: buffered endpoint and SSE streaming endpoint with LangGraph integration."""

from __future__ import annotations

import json
import time
from datetime import datetime
from typing import TYPE_CHECKING, Any

import structlog
from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ConfigDict, Field

from neural_navigator.agents.runtime import execute_research_graph
from neural_navigator.core.dependencies import (
    CorrelationIdDep,
    CostCircuitBreakerDep,
    EventBusDep,
    LLMServiceDep,
    PrincipalDep,
    RequestIdDep,
    SettingsDep,
)
from neural_navigator.domain.models.research import OrchestrationResult
from neural_navigator.orchestration.modes import RunMode
from neural_navigator.orchestration.stages import OrchestrationStage
from neural_navigator.schemas.base import (
    BaseSchema,
    ChatMessage,
    ProblemDetail,
    Usage,
    generate_id,
    problem_from_exception,
    serialise_problem,
    utc_now,
)
from neural_navigator.services.llm import LLMChunk, LLMError
from neural_navigator.utils.constants import (
    SSE_DONE_SENTINEL,
    SSE_MEDIA_TYPE,
    ErrorCode,
    EventType,
    FinishReason,
    Role,
)

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

router = APIRouter(prefix="/chat", tags=["chat"])

_logger = structlog.stdlib.get_logger(__name__)


class ChatRequest(BaseSchema):
    """A stateless chat turn: the client supplies the conversation and optional research mode."""

    messages: list[ChatMessage] = Field(min_length=1, max_length=200)
    model: str | None = Field(default=None, max_length=128)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_output_tokens: int | None = Field(default=None, ge=1, le=32_000)
    mode: str | None = Field(default=None, max_length=32)


class ChatResponse(BaseSchema):
    run_id: str
    model: str
    message: ChatMessage
    finish_reason: FinishReason
    usage: Usage
    created_at: datetime
    orchestration: dict[str, Any] | None = None


class StreamDelta(BaseSchema):
    """One SSE payload carrying an increment of the response or stage event."""

    model_config = ConfigDict(str_strip_whitespace=False)

    run_id: str
    delta: str = ""
    stage: str | None = None
    stage_data: dict[str, Any] | None = None
    finish_reason: FinishReason | None = None
    usage: Usage | None = None
    orchestration: dict[str, Any] | None = None


_ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    status.HTTP_401_UNAUTHORIZED: {"model": ProblemDetail},
    422: {"model": ProblemDetail},
    status.HTTP_429_TOO_MANY_REQUESTS: {"model": ProblemDetail},
    status.HTTP_502_BAD_GATEWAY: {"model": ProblemDetail},
    status.HTTP_504_GATEWAY_TIMEOUT: {"model": ProblemDetail},
}


def _http_status_for(error: LLMError) -> int:
    if error.code is ErrorCode.UPSTREAM_TIMEOUT:
        return status.HTTP_504_GATEWAY_TIMEOUT
    if error.code is ErrorCode.RATE_LIMITED:
        return status.HTTP_429_TOO_MANY_REQUESTS
    return status.HTTP_502_BAD_GATEWAY


def _sse(payload: BaseSchema) -> str:
    return f"data: {payload.model_dump_json(exclude_none=True)}\n\n"


@router.post(
    "/completions",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a complete chat response",
    responses=_ERROR_RESPONSES,
)
async def create_chat_completion(
    payload: ChatRequest,
    request: Request,
    llm: LLMServiceDep,
    events: EventBusDep,
    principal: PrincipalDep,
    request_id: RequestIdDep,
    correlation_id: CorrelationIdDep,
    settings: SettingsDep,
    circuit_breaker: CostCircuitBreakerDep,
) -> Any:
    """Return the whole response once generation completes."""
    run_id = generate_id("run")
    started = time.perf_counter()

    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "127.0.0.1")
    )
    if circuit_breaker and getattr(settings, "budget_circuit_breaker_enabled", True):
        est_cost = circuit_breaker.estimate_cost(payload.model or llm.default_model)
        allowed, reason = await circuit_breaker.async_check_preflight(client_ip, est_cost)
        if not allowed:
            problem = problem_from_exception(
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                title="Budget Exceeded",
                code=ErrorCode.BUDGET_EXCEEDED,
                detail=reason or "Budget limit reached for demo mode",
                instance=request.url.path,
                request_id=request_id,
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

    await events.emit(
        EventType.RUN_STARTED,
        payload={"run_id": run_id, "subject": principal.subject, "transport": "http"},
        correlation_id=correlation_id or request_id,
    )

    try:
        if payload.mode:
            mode = RunMode.parse(payload.mode)
            content_parts: list[str] = []
            orchestration_data: dict[str, Any] | None = None

            async for item in execute_research_graph(
                messages=payload.messages,
                mode=mode,
                llm=llm,
                settings=settings,
                model=payload.model,
                temperature=payload.temperature,
                max_output_tokens=payload.max_output_tokens,
            ):
                if isinstance(item, OrchestrationResult):
                    orchestration_data = item.as_dict()
                elif isinstance(item, LLMChunk) and item.delta:
                    content_parts.append(item.delta)

            answer = "".join(content_parts)
            completion_content = answer
            completion_model = payload.model or llm.default_model
            finish_reason = FinishReason.STOP
            usage = Usage(prompt_tokens=len(payload.messages) * 10, completion_tokens=len(content_parts), total_tokens=len(payload.messages) * 10 + len(content_parts))
        else:
            completion = await llm.complete(
                payload.messages,
                model=payload.model,
                temperature=payload.temperature,
                max_output_tokens=payload.max_output_tokens,
            )
            completion_content = completion.content
            completion_model = completion.model
            finish_reason = completion.finish_reason
            usage = completion.usage
            orchestration_data = None
    except LLMError as exc:
        await events.emit(
            EventType.RUN_FAILED,
            payload={"run_id": run_id, "error_code": exc.code.value},
            correlation_id=correlation_id or request_id,
        )
        raise HTTPException(status_code=_http_status_for(exc), detail=exc.message) from exc

    if circuit_breaker and usage and getattr(settings, "budget_circuit_breaker_enabled", True):
        await circuit_breaker.async_record_spend(
            client_ip=client_ip,
            model=completion_model,
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
        )

    await events.emit(
        EventType.RUN_COMPLETED,
        payload={
            "run_id": run_id,
            "model": completion_model,
            "total_tokens": usage.total_tokens,
            "duration_ms": round((time.perf_counter() - started) * 1000, 2),
        },
        correlation_id=correlation_id or request_id,
    )

    return ChatResponse(
        run_id=run_id,
        model=completion_model,
        message=ChatMessage(role=Role.ASSISTANT, content=completion_content),
        finish_reason=finish_reason,
        usage=usage,
        created_at=utc_now(),
        orchestration=orchestration_data,
    )


@router.post(
    "/stream",
    status_code=status.HTTP_200_OK,
    summary="Stream a chat response as server-sent events",
    response_class=StreamingResponse,
    responses={
        status.HTTP_200_OK: {
            "content": {SSE_MEDIA_TYPE: {}},
            "description": "A `data:` frame per increment, terminated by `data: [DONE]`.",
        },
        **_ERROR_RESPONSES,
    },
)
async def stream_chat_completion(
    payload: ChatRequest,
    request: Request,
    llm: LLMServiceDep,
    events: EventBusDep,
    principal: PrincipalDep,
    request_id: RequestIdDep,
    correlation_id: CorrelationIdDep,
    settings: SettingsDep,
    circuit_breaker: CostCircuitBreakerDep,
) -> Any:
    run_id = generate_id("run")
    trace = correlation_id or request_id

    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "127.0.0.1")
    )
    if circuit_breaker and getattr(settings, "budget_circuit_breaker_enabled", True):
        est_cost = circuit_breaker.estimate_cost(payload.model or llm.default_model)
        allowed, reason = await circuit_breaker.async_check_preflight(client_ip, est_cost)
        if not allowed:
            problem = problem_from_exception(
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                title="Budget Exceeded",
                code=ErrorCode.BUDGET_EXCEEDED,
                detail=reason or "Budget limit reached for demo mode",
                instance=request.url.path,
                request_id=request_id,
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

    async def generate() -> AsyncIterator[str]:
        started = time.perf_counter()
        finish_reason = FinishReason.STOP
        usage: Usage | None = None

        await events.emit(
            EventType.RUN_STARTED,
            payload={"run_id": run_id, "subject": principal.subject, "transport": "sse"},
            correlation_id=trace,
        )

        async def sse_emit_stage(stage: OrchestrationStage, detail: dict[str, Any] | None = None) -> None:
            nonlocal stage_frames
            stage_payload = StreamDelta(
                run_id=run_id,
                stage=stage.value,
                stage_data=detail or {},
            )
            stage_frames.append(_sse(stage_payload))

        stage_frames: list[str] = []

        try:
            if payload.mode:
                mode = RunMode.parse(payload.mode)
                async for item in execute_research_graph(
                    messages=payload.messages,
                    mode=mode,
                    llm=llm,
                    settings=settings,
                    emit_stage=sse_emit_stage,
                    model=payload.model,
                    temperature=payload.temperature,
                    max_output_tokens=payload.max_output_tokens,
                ):
                    if await request.is_disconnected():
                        finish_reason = FinishReason.CANCELLED
                        _logger.info("chat.stream.client_disconnected", run_id=run_id)
                        break

                    # Flush any pending stage frames
                    while stage_frames:
                        yield stage_frames.pop(0)

                    if isinstance(item, OrchestrationResult):
                        yield _sse(
                            StreamDelta(
                                run_id=run_id,
                                orchestration=item.as_dict(),
                            )
                        )
                    elif isinstance(item, LLMChunk):
                        if item.finish_reason is not None:
                            finish_reason = item.finish_reason
                        if item.usage is not None:
                            usage = item.usage
                        if item.delta:
                            yield _sse(
                                StreamDelta(
                                    run_id=run_id,
                                    delta=item.delta,
                                    finish_reason=item.finish_reason,
                                    usage=item.usage,
                                )
                            )
            else:
                async for chunk in llm.stream_chat(
                    payload.messages,
                    model=payload.model,
                    temperature=payload.temperature,
                    max_output_tokens=payload.max_output_tokens,
                ):
                    if await request.is_disconnected():
                        finish_reason = FinishReason.CANCELLED
                        _logger.info("chat.stream.client_disconnected", run_id=run_id)
                        break
                    if chunk.finish_reason is not None:
                        finish_reason = chunk.finish_reason
                    if chunk.usage is not None:
                        usage = chunk.usage
                    yield _sse(
                        StreamDelta(
                            run_id=run_id,
                            delta=chunk.delta,
                            finish_reason=chunk.finish_reason,
                            usage=chunk.usage,
                        )
                    )
        except LLMError as exc:
            _logger.error("chat.stream.failed", run_id=run_id, error_code=exc.code.value)
            await events.emit(
                EventType.RUN_FAILED,
                payload={"run_id": run_id, "error_code": exc.code.value},
                correlation_id=trace,
            )
            body = json.dumps({"run_id": run_id, "code": exc.code.value, "message": exc.message})
            yield f"event: error\ndata: {body}\n\n"
            yield f"data: {SSE_DONE_SENTINEL}\n\n"
            return

        if circuit_breaker and usage and getattr(settings, "budget_circuit_breaker_enabled", True):
            await circuit_breaker.async_record_spend(
                client_ip=client_ip,
                model=payload.model or llm.default_model,
                prompt_tokens=usage.prompt_tokens,
                completion_tokens=usage.completion_tokens,
            )

        await events.emit(
            EventType.RUN_CANCELLED
            if finish_reason is FinishReason.CANCELLED
            else EventType.RUN_COMPLETED,
            payload={
                "run_id": run_id,
                "finish_reason": finish_reason.value,
                "total_tokens": usage.total_tokens if usage else 0,
                "duration_ms": round((time.perf_counter() - started) * 1000, 2),
            },
            correlation_id=trace,
        )
        yield f"data: {SSE_DONE_SENTINEL}\n\n"

    return StreamingResponse(
        generate(),
        media_type=SSE_MEDIA_TYPE,
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/models",
    summary="Report the model catalog and provider this deployment will use",
)
async def describe_models(llm: LLMServiceDep, settings: SettingsDep) -> dict[str, object]:
    from neural_navigator.services.model_registry import list_chat_models

    return {
        "provider": llm.provider_name,
        "default_model": llm.default_model,
        "environment": settings.app_env.value,
        "models": list_chat_models(default_model=llm.default_model),
    }
