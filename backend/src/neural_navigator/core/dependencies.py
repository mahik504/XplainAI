"""FastAPI dependency providers.

Long-lived collaborators are created once in the application lifespan and stored on
``app.state``; the functions here adapt them into the dependency system. Routes
therefore declare what they need and are trivially testable via
``app.dependency_overrides``.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, HTTPException, Query, WebSocket, WebSocketException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import ConfigDict, Field
from starlette.requests import HTTPConnection

from neural_navigator.core.config import Settings, get_settings
from neural_navigator.schemas.base import BaseSchema, PaginationParams
from neural_navigator.services.events import EventBus
from neural_navigator.services.llm import LLMService
from neural_navigator.utils.constants import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    ErrorCode,
    WSCloseCode,
)

_bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token")

ANONYMOUS_SUBJECT = "anonymous"


class Principal(BaseSchema):
    """The authenticated caller behind a request or socket."""

    # Frozen because `ANONYMOUS_PRINCIPAL` below is a shared process-wide instance.
    model_config = ConfigDict(frozen=True)

    subject: str
    scopes: frozenset[str] = Field(default_factory=frozenset)
    is_anonymous: bool = False

    def has_scope(self, scope: str) -> bool:
        return scope in self.scopes


ANONYMOUS_PRINCIPAL = Principal(subject=ANONYMOUS_SUBJECT, is_anonymous=True)


def _state_value(connection: HTTPConnection, key: str) -> Any:
    """Read a lifespan-created collaborator, failing loudly if startup was skipped."""
    value = getattr(connection.app.state, key, None)
    if value is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{key} is not initialised; application startup did not complete",
        )
    return value


def get_app_settings(connection: HTTPConnection) -> Settings:
    """Return the settings the running application was built with.

    Reads ``app.state`` rather than the cached module singleton: an app constructed
    via ``create_app(settings=...)`` must actually be governed by those settings,
    otherwise security-relevant flags silently revert to the process defaults.
    """
    settings: Settings | None = getattr(connection.app.state, "settings", None)
    return settings if settings is not None else get_settings()


def get_llm_service(connection: HTTPConnection) -> LLMService:
    service: LLMService = _state_value(connection, "llm_service")
    return service


def get_event_bus(connection: HTTPConnection) -> EventBus:
    bus: EventBus = _state_value(connection, "event_bus")
    return bus


def get_request_id(connection: HTTPConnection) -> str:
    """Request id assigned by ``RequestContextMiddleware``."""
    return str(connection.scope.get("state", {}).get("request_id", ""))


def get_correlation_id(connection: HTTPConnection) -> str:
    return str(connection.scope.get("state", {}).get("correlation_id", ""))


def get_pagination(
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginationParams:
    return PaginationParams(limit=limit, offset=offset)


def decode_access_token(token: str, settings: Settings) -> Principal:
    """Validate a JWT and project it onto a `Principal`.

    Raises `JWTError` on any failure; callers decide the transport-specific response.
    """
    claims = jwt.decode(
        token,
        settings.jwt_secret.get_secret_value(),
        algorithms=[settings.jwt_algorithm],
        audience=settings.jwt_audience,
        issuer=settings.jwt_issuer,
        options={
            "verify_aud": settings.jwt_audience is not None,
            "verify_iss": settings.jwt_issuer is not None,
        },
    )
    subject = claims.get("sub")
    if not subject:
        raise JWTError("token is missing the 'sub' claim")

    raw_scopes = claims.get("scope") or claims.get("scopes") or ""
    scopes = raw_scopes.split() if isinstance(raw_scopes, str) else list(raw_scopes)
    return Principal(subject=str(subject), scopes=frozenset(scopes))


def get_principal(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> Principal:
    """Resolve the caller for an HTTP request.

    When ``auth_required`` is off an unauthenticated caller is admitted as anonymous,
    which keeps local development frictionless. A token that is *present* is always
    validated, so a broken client cannot silently degrade to anonymous access.
    """
    if credentials is None:
        if settings.auth_required:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ErrorCode.UNAUTHENTICATED.value,
                headers={"WWW-Authenticate": "Bearer"},
            )
        return ANONYMOUS_PRINCIPAL

    try:
        return decode_access_token(credentials.credentials, settings)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"invalid access token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def require_authenticated(
    principal: Annotated[Principal, Depends(get_principal)],
) -> Principal:
    if principal.is_anonymous:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorCode.UNAUTHENTICATED.value,
            headers={"WWW-Authenticate": "Bearer"},
        )
    return principal


async def get_ws_principal(
    websocket: WebSocket,
    settings: Annotated[Settings, Depends(get_app_settings)],
    token: Annotated[str | None, Query(description="JWT access token")] = None,
) -> Principal:
    """Resolve the caller for a WebSocket handshake.

    Browsers cannot set an ``Authorization`` header on a WebSocket, so the token
    arrives as a query parameter. Rejection happens before ``accept()``, which closes
    the handshake with an application close code the client can act on.
    """
    supplied = token or _bearer_from_headers(websocket)

    if supplied is None:
        if settings.auth_required:
            raise WebSocketException(
                code=WSCloseCode.UNAUTHENTICATED, reason="missing access token"
            )
        return ANONYMOUS_PRINCIPAL

    try:
        return decode_access_token(supplied, settings)
    except JWTError as exc:
        raise WebSocketException(
            code=WSCloseCode.UNAUTHENTICATED, reason=f"invalid access token: {exc}"
        ) from exc


def _bearer_from_headers(websocket: WebSocket) -> str | None:
    """Accept a bearer header too, for non-browser clients that can send one."""
    header = websocket.headers.get("authorization")
    if not header:
        return None
    scheme, _, value = header.partition(" ")
    if scheme.lower() != "bearer" or not value:
        return None
    return value.strip()


SettingsDep = Annotated[Settings, Depends(get_app_settings)]
LLMServiceDep = Annotated[LLMService, Depends(get_llm_service)]
EventBusDep = Annotated[EventBus, Depends(get_event_bus)]
RequestIdDep = Annotated[str, Depends(get_request_id)]
CorrelationIdDep = Annotated[str, Depends(get_correlation_id)]
PaginationDep = Annotated[PaginationParams, Depends(get_pagination)]
PrincipalDep = Annotated[Principal, Depends(get_principal)]
AuthenticatedDep = Annotated[Principal, Depends(require_authenticated)]
WSPrincipalDep = Annotated[Principal, Depends(get_ws_principal)]
