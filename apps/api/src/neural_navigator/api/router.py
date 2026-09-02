"""Router composition.

Three routers are exported rather than one, because they are mounted at different
prefixes and carry different guarantees:

* ``health_router`` sits at the root so container and load-balancer probes never
  depend on the API version currently in fashion;
* ``api_router`` is versioned and mounted under ``/api/v1``;
* ``ws_router`` is versioned separately under ``/ws/v1`` — the socket protocol
  evolves on its own schedule.
"""

from __future__ import annotations

import time

from fastapi import APIRouter, Request, Response, status

from neural_navigator.api import chat, conversations, websocket
from neural_navigator.api.routes import documents, evidence, export, research_jobs
from neural_navigator.core.dependencies import SettingsDep
from neural_navigator.infrastructure.cache.redis import RedisCache
from neural_navigator.infrastructure.db.manager import DatabaseManager
from neural_navigator.schemas.base import HealthResponse
from neural_navigator.utils.constants import SERVICE_NAME

health_router = APIRouter(tags=["health"])


def _uptime_seconds(request: Request) -> float:
    started_at = getattr(request.app.state, "started_at", None)
    return 0.0 if started_at is None else max(0.0, time.monotonic() - float(started_at))


@health_router.get(
    "/health/live",
    response_model=HealthResponse,
    summary="Liveness probe",
    description="Succeeds while the process is running. Never touches a dependency.",
)
async def liveness(request: Request, settings: SettingsDep) -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=SERVICE_NAME,
        version=settings.version,
        environment=settings.app_env.value,
        uptime_seconds=_uptime_seconds(request),
    )


@health_router.get(
    "/health/ready",
    response_model=HealthResponse,
    summary="Readiness probe",
    description=(
        "Reports whether collaborators, PostgreSQL connection pool, and Redis "
        "are alive and healthy. Returns 503 so an orchestrator withholds traffic until ready."
    ),
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": HealthResponse}},
)
async def readiness(request: Request, response: Response, settings: SettingsDep) -> HealthResponse:
    # 1. Check in-memory collaborators
    llm_ok = getattr(request.app.state, "llm_service", None) is not None
    event_bus_ok = getattr(request.app.state, "event_bus", None) is not None

    # 2. Check Database connectivity
    db_manager: DatabaseManager | None = getattr(request.app.state, "db_manager", None)
    if db_manager is None:
        db_manager = DatabaseManager(settings=settings)
        request.app.state.db_manager = db_manager

    db_ok = await db_manager.check_health()

    # 3. Check Redis connectivity if configured
    redis_ok = True
    if settings.redis_url:
        redis_cache: RedisCache | None = getattr(request.app.state, "redis_cache", None)
        if redis_cache is None:
            redis_cache = RedisCache(redis_url=settings.redis_url)
            request.app.state.redis_cache = redis_cache
        redis_ok = await redis_cache.async_ping()

    checks: dict[str, bool] = {
        "llm_service": llm_ok,
        "event_bus": event_bus_ok,
        "database": db_ok,
        "redis": redis_ok,
    }

    healthy = all(checks.values())
    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthResponse(
        status="ok" if healthy else "degraded",
        service=SERVICE_NAME,
        version=settings.version,
        environment=settings.app_env.value,
        uptime_seconds=_uptime_seconds(request),
        checks=checks,
    )


@health_router.get(
    "/metrics",
    summary="Prometheus metrics",
    description="Exposes Prometheus formatted telemetry metrics for scraping.",
)
async def metrics() -> Response:
    from neural_navigator.core.metrics import get_metrics_payload

    body, content_type = get_metrics_payload()
    return Response(content=body, media_type=content_type)


api_router = APIRouter()
api_router.include_router(chat.router)
api_router.include_router(conversations.router)
api_router.include_router(documents.router)
api_router.include_router(export.router)
api_router.include_router(research_jobs.router)
api_router.include_router(evidence.router)

# Compatibility alias for conversations prefix
conv_export_router = APIRouter(prefix="/conversations", tags=["export"])
conv_export_router.add_api_route(
    "/{session_id}/export",
    export.export_session,
    methods=["GET"],
    summary="Export conversation session as Markdown or PDF",
)
conv_export_router.add_api_route(
    "/{session_id}/evidence-pack",
    export.export_evidence_pack,
    methods=["GET"],
    summary="Download complete JSON Evidence Pack for conversation",
)
api_router.include_router(conv_export_router)

ws_router = APIRouter()
ws_router.include_router(websocket.router)

__all__ = ["api_router", "health_router", "ws_router"]
