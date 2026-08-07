"""ASGI entry point.

``create_app`` is the single composition root: it reads configuration, installs
logging, builds the long-lived collaborators inside the lifespan, and wires the
routers. Nothing below this module reaches for a global.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR

#: Spelled as a literal because Starlette renamed its 422 constant; importing either
#: spelling emits a deprecation warning on one supported version or the other.
HTTP_422_UNPROCESSABLE_ENTITY = 422

from neural_navigator.api.router import api_router, health_router, ws_router
from neural_navigator.api.websocket import connection_registry
from neural_navigator.core.config import Settings, get_settings
from neural_navigator.core.dependencies import get_request_id
from neural_navigator.core.logging import RequestContextMiddleware, configure_logging
from neural_navigator.schemas.base import ErrorItem, problem_from_exception, serialise_problem
from neural_navigator.services.events import InMemoryEventBus
from neural_navigator.services.llm import LLMService, build_llm_provider
from neural_navigator.utils.constants import (
    API_V1_PREFIX,
    EVENT_QUEUE_MAX_SIZE,
    HEADER_REQUEST_ID,
    SERVICE_NAME,
    WS_V1_PREFIX,
    ErrorCode,
)

_logger = structlog.stdlib.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Build collaborators on startup and dispose of them in reverse on shutdown."""
    settings: Settings = app.state.settings

    event_bus = InMemoryEventBus(max_queue_size=EVENT_QUEUE_MAX_SIZE)
    llm_service = LLMService(provider=build_llm_provider(settings), settings=settings)

    app.state.event_bus = event_bus
    app.state.llm_service = llm_service
    app.state.started_at = time.monotonic()

    _logger.info(
        "application.startup",
        service=SERVICE_NAME,
        version=settings.version,
        environment=settings.app_env.value,
        llm_provider=llm_service.provider_name,
        default_model=llm_service.default_model,
        docs_enabled=settings.docs_enabled,
    )

    try:
        yield
    finally:
        # Sockets first: they hold references to the services closed below.
        await connection_registry.close_all()
        await llm_service.aclose()
        await event_bus.aclose()
        app.state.llm_service = None
        app.state.event_bus = None
        _logger.info("application.shutdown", service=SERVICE_NAME)


def _register_exception_handlers(app: FastAPI) -> None:
    """Render every failure as an RFC 9457 problem document."""

    @app.exception_handler(RequestValidationError)
    async def _on_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        problem = problem_from_exception(
            status=HTTP_422_UNPROCESSABLE_ENTITY,
            title="Request validation failed",
            code=ErrorCode.VALIDATION_FAILED,
            detail="One or more fields did not satisfy the schema.",
            instance=request.url.path,
            request_id=get_request_id(request),
            errors=[
                ErrorItem(
                    location=".".join(str(part) for part in error["loc"]),
                    message=error["msg"],
                    type=error["type"],
                )
                for error in exc.errors()
            ],
        )
        return JSONResponse(
            status_code=problem.status, content=serialise_problem(problem)
        )

    @app.exception_handler(HTTPException)
    async def _on_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
        problem = problem_from_exception(
            status=exc.status_code,
            title=_TITLES.get(exc.status_code, "Request failed"),
            code=_CODES.get(exc.status_code, ErrorCode.INTERNAL_ERROR),
            detail=str(exc.detail) if exc.detail else None,
            instance=request.url.path,
            request_id=get_request_id(request),
        )
        return JSONResponse(
            status_code=problem.status,
            content=serialise_problem(problem),
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def _on_unhandled(request: Request, exc: Exception) -> JSONResponse:
        request_id = get_request_id(request)
        _logger.exception(
            "http.unhandled_exception", path=request.url.path, request_id=request_id
        )
        problem = problem_from_exception(
            status=HTTP_500_INTERNAL_SERVER_ERROR,
            title="Internal server error",
            code=ErrorCode.INTERNAL_ERROR,
            # The exception text is deliberately withheld; it is in the logs, keyed
            # by the request id the caller is handed here.
            detail="The request could not be completed. Quote the request id when reporting this.",
            instance=request.url.path,
            request_id=request_id,
        )
        return JSONResponse(
            status_code=problem.status, content=serialise_problem(problem)
        )


_TITLES: dict[int, str] = {
    400: "Bad request",
    401: "Authentication required",
    403: "Forbidden",
    404: "Not found",
    409: "Conflict",
    413: "Payload too large",
    422: "Request validation failed",
    429: "Too many requests",
    502: "Upstream provider error",
    503: "Service unavailable",
    504: "Upstream provider timeout",
}

_CODES: dict[int, ErrorCode] = {
    400: ErrorCode.BAD_REQUEST,
    401: ErrorCode.UNAUTHENTICATED,
    403: ErrorCode.FORBIDDEN,
    404: ErrorCode.NOT_FOUND,
    409: ErrorCode.CONFLICT,
    413: ErrorCode.PAYLOAD_TOO_LARGE,
    422: ErrorCode.VALIDATION_FAILED,
    429: ErrorCode.RATE_LIMITED,
    502: ErrorCode.UPSTREAM_ERROR,
    503: ErrorCode.SERVICE_UNAVAILABLE,
    504: ErrorCode.UPSTREAM_TIMEOUT,
}


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the application. Accepts settings so tests can inject their own."""
    resolved = settings or get_settings()
    configure_logging(resolved)

    app = FastAPI(
        title=resolved.project_name,
        version=resolved.version,
        summary="Agentic reasoning API with streaming HTTP and WebSocket transports.",
        root_path=resolved.api_root_path,
        docs_url=resolved.docs_url,
        redoc_url=resolved.redoc_url,
        openapi_url=resolved.openapi_url,
        lifespan=lifespan,
    )
    app.state.settings = resolved

    # Added first, so CORS ends up outermost and error responses still carry the
    # headers a browser needs in order to read them.
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved.cors_origins,
        allow_credentials=resolved.cors_allow_credentials,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", HEADER_REQUEST_ID],
        expose_headers=[HEADER_REQUEST_ID],
        max_age=600,
    )

    _register_exception_handlers(app)

    app.include_router(health_router)
    app.include_router(api_router, prefix=API_V1_PREFIX)
    app.include_router(ws_router, prefix=WS_V1_PREFIX)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    _settings = get_settings()
    uvicorn.run(
        "neural_navigator.main:app",
        host=_settings.api_host,
        port=_settings.api_port,
        reload=not _settings.app_env.is_deployed,
        log_config=None,
    )
