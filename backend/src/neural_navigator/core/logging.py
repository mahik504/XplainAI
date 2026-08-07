"""Structured logging setup and request-scoped log context.

Every log record — including those emitted by uvicorn, SQLAlchemy and third-party
libraries — is routed through structlog so that a single renderer decides the output
shape. Local development gets a human-readable console renderer; deployed
environments get newline-delimited JSON for ingestion.
"""

from __future__ import annotations

import logging
import sys
import time
import uuid
from collections.abc import MutableMapping
from typing import Any

import structlog
from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from neural_navigator.core.config import Settings
from neural_navigator.utils.constants import (
    HEADER_CORRELATION_ID,
    HEADER_REQUEST_ID,
    HEADER_RESPONSE_TIME,
    LogFormat,
)

#: Loggers whose own handlers must be removed so records propagate to the root
#: handler configured below. Without this, uvicorn double-prints every access line.
_HIJACKED_LOGGERS = (
    "uvicorn",
    "uvicorn.error",
    "uvicorn.access",
    "uvicorn.asgi",
    "fastapi",
    "httpx",
    "httpcore",
    "sqlalchemy.engine",
    "asyncio",
)

_configured = False


def configure_logging(settings: Settings) -> None:
    """Install the structlog pipeline on the root logger.

    Idempotent: calling it twice (for example from an app factory used by both the
    server and the test suite) will not stack duplicate handlers.
    """
    global _configured

    shared_processors: list[structlog.typing.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    if settings.log_format is LogFormat.JSON:
        render_chain: list[structlog.typing.Processor] = [
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]
    else:
        # ConsoleRenderer formats exception info itself; adding format_exc_info here
        # would consume the record before it gets the chance.
        render_chain = [structlog.dev.ConsoleRenderer(colors=sys.stdout.isatty())]

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            *render_chain,
        ],
    )

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    for existing in list(root.handlers):
        root.removeHandler(existing)
    root.addHandler(handler)
    root.setLevel(settings.log_level)

    for name in _HIJACKED_LOGGERS:
        hijacked = logging.getLogger(name)
        hijacked.handlers.clear()
        hijacked.propagate = True

    # Access logging is emitted by RequestContextMiddleware with richer fields.
    logging.getLogger("uvicorn.access").disabled = True

    _configured = True


def is_configured() -> bool:
    return _configured


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a bound logger; prefer module-level `__name__` as the name."""
    return structlog.stdlib.get_logger(name)


def bind_request_context(**values: Any) -> None:
    """Attach key/values to every log record emitted by the current task."""
    structlog.contextvars.bind_contextvars(**values)


def clear_request_context() -> None:
    structlog.contextvars.clear_contextvars()


def new_request_id() -> str:
    return uuid.uuid4().hex


class RequestContextMiddleware:
    """Bind a request id to the log context and emit one access record per request.

    Implemented as raw ASGI rather than ``BaseHTTPMiddleware`` because the latter
    buffers through an anyio stream, which interferes with server-sent events and
    long-lived WebSocket connections — both of which this service depends on.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self._logger = structlog.stdlib.get_logger("neural_navigator.access")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in {"http", "websocket"}:
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        request_id = headers.get(HEADER_REQUEST_ID) or new_request_id()
        correlation_id = headers.get(HEADER_CORRELATION_ID) or request_id
        scope.setdefault("state", {})
        state: MutableMapping[str, Any] = scope["state"]
        state["request_id"] = request_id
        state["correlation_id"] = correlation_id

        clear_request_context()
        bind_request_context(
            request_id=request_id,
            correlation_id=correlation_id,
            path=scope.get("path", ""),
        )

        if scope["type"] == "websocket":
            try:
                await self.app(scope, receive, send)
            finally:
                clear_request_context()
            return

        started = time.perf_counter()
        status_code = 500

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message["status"])
                elapsed_ms = (time.perf_counter() - started) * 1000
                response_headers = MutableHeaders(scope=message)
                response_headers.append(HEADER_REQUEST_ID, request_id)
                response_headers.append(HEADER_CORRELATION_ID, correlation_id)
                response_headers.append(HEADER_RESPONSE_TIME, f"{elapsed_ms:.2f}")
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            elapsed_ms = (time.perf_counter() - started) * 1000
            self._logger.exception(
                "http.request.failed",
                method=scope.get("method", ""),
                status_code=status_code,
                duration_ms=round(elapsed_ms, 2),
            )
            raise
        else:
            elapsed_ms = (time.perf_counter() - started) * 1000
            self._logger.info(
                "http.request",
                method=scope.get("method", ""),
                status_code=status_code,
                duration_ms=round(elapsed_ms, 2),
                client=scope["client"][0] if scope.get("client") else None,
            )
        finally:
            clear_request_context()
