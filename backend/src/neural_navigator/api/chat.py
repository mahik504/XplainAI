"""Chat over HTTP: one buffered endpoint and one server-sent-events endpoint.

These routes own transport concerns only. Model access lives in
``services.llm``; when a graph runtime is introduced it will be swapped in behind
the same service call without touching this module.
"""

from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator
from datetime import datetime

import structlog
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import ConfigDict, Field

from neural_navigator.core.dependencies import (
    CorrelationIdDep,
    EventBusDep,
    LLMServiceDep,
    PrincipalDep,
    RequestIdDep,
    SettingsDep,
)
from neural_navigator.schemas.base import (
    BaseSchema,
    ChatMessage,
    ProblemDetail,
    Usage,
    generate_id,
    utc_now,
)
from neural_navigator.services.llm import LLMError
from neural_navigator.utils.constants import (
    SSE_DONE_SENTINEL,
    SSE_MEDIA_TYPE,
    ErrorCode,
    EventType,
    FinishReason,
    Role,
)

router = APIRouter(prefix="/chat", tags=["chat"])

_logger = structlog.stdlib.get_logger(__name__)


class ChatRequest(BaseSchema):
    """A stateless chat turn: the client supplies the full conversation."""

    messages: list[ChatMessage] = Field(min_length=1, max_length=200)
    model: str | None = Field(default=None, max_length=128)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_output_tokens: int | None = Field(default=None, ge=1, le=32_000)


class ChatResponse(BaseSchema):
    run_id: str
    model: str
    message: ChatMessage
    finish_reason: FinishReason
    usage: Usage
    created_at: datetime


class StreamDelta(BaseSchema):
    """One SSE payload carrying an increment of the response."""

    # See `RunTokenFrame`: deltas must survive verbatim, whitespace included.
    model_config = ConfigDict(str_strip_whitespace=False)

    run_id: str
    delta: str = ""
    finish_reason: FinishReason | None = None
    usage: Usage | None = None


_ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    status.HTTP_401_UNAUTHORIZED: {"model": ProblemDetail},
    # Spelled as a literal because Starlette renamed its 422 constant and importing
    # either spelling raises a deprecation warning on one version or the other.
    422: {"model": ProblemDetail},
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
    llm: LLMServiceDep,
    events: EventBusDep,
    principal: PrincipalDep,
    request_id: RequestIdDep,
    correlation_id: CorrelationIdDep,
) -> ChatResponse:
    """Return the whole response once the model has finished.

    Use `/chat/stream` for anything user-facing; a buffered call holds a connection
    open for the full generation and gives the user no feedback while it does.
    """
    run_id = generate_id("run")
    started = time.perf_counter()

    await events.emit(
        EventType.RUN_STARTED,
        payload={"run_id": run_id, "subject": principal.subject, "transport": "http"},
        correlation_id=correlation_id or request_id,
    )

    try:
        completion = await llm.complete(
            payload.messages,
            model=payload.model,
            temperature=payload.temperature,
            max_output_tokens=payload.max_output_tokens,
        )
    except LLMError as exc:
        await events.emit(
            EventType.RUN_FAILED,
            payload={"run_id": run_id, "error_code": exc.code.value},
            correlation_id=correlation_id or request_id,
        )
        raise HTTPException(status_code=_http_status_for(exc), detail=exc.message) from exc

    await events.emit(
        EventType.RUN_COMPLETED,
        payload={
            "run_id": run_id,
            "model": completion.model,
            "total_tokens": completion.usage.total_tokens,
            "duration_ms": round((time.perf_counter() - started) * 1000, 2),
        },
        correlation_id=correlation_id or request_id,
    )

    return ChatResponse(
        run_id=run_id,
        model=completion.model,
        message=ChatMessage(role=Role.ASSISTANT, content=completion.content),
        finish_reason=completion.finish_reason,
        usage=completion.usage,
        created_at=utc_now(),
    )


@router.post(
    "/stream",
    status_code=status.HTTP_200_OK,
    summary="Stream a chat response as server-sent events",
    response_class=StreamingResponse,
    responses={
        status.HTTP_200_OK: {
            "content": {SSE_MEDIA_TYPE: {}},
            "description": (
                "A `data:` frame per increment, terminated by `data: [DONE]`. "
                "Failures after the first frame arrive as an `event: error` frame, "
                "because the status line has already been sent."
            ),
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
) -> StreamingResponse:
    run_id = generate_id("run")
    trace = correlation_id or request_id

    async def generate() -> AsyncIterator[str]:
        started = time.perf_counter()
        finish_reason = FinishReason.STOP
        usage: Usage | None = None

        await events.emit(
            EventType.RUN_STARTED,
            payload={"run_id": run_id, "subject": principal.subject, "transport": "sse"},
            correlation_id=trace,
        )

        try:
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
            _logger.error(
                "chat.stream.failed", run_id=run_id, error_code=exc.code.value
            )
            await events.emit(
                EventType.RUN_FAILED,
                payload={"run_id": run_id, "error_code": exc.code.value},
                correlation_id=trace,
            )
            body = json.dumps(
                {"run_id": run_id, "code": exc.code.value, "message": exc.message}
            )
            yield f"event: error\ndata: {body}\n\n"
            yield f"data: {SSE_DONE_SENTINEL}\n\n"
            return

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
            # Disables proxy buffering, without which nginx holds the whole stream.
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
