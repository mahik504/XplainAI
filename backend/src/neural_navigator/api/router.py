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

from fastapi import APIRouter, Response, status
from starlette.requests import Request

from neural_navigator.api import chat, websocket
from neural_navigator.core.dependencies import SettingsDep
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
        "Reports whether the collaborators built during startup are present. "
        "Returns 503 so an orchestrator withholds traffic until they are."
    ),
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": HealthResponse}},
)
async def readiness(
    request: Request, response: Response, settings: SettingsDep
) -> HealthResponse:
    checks = {
        "llm_service": getattr(request.app.state, "llm_service", None) is not None,
        "event_bus": getattr(request.app.state, "event_bus", None) is not None,
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


api_router = APIRouter()
api_router.include_router(chat.router)

ws_router = APIRouter()
ws_router.include_router(websocket.router)

__all__ = ["api_router", "health_router", "ws_router"]
