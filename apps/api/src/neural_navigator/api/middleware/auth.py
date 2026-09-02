"""Authentication and Authorization Middleware for Developer API & Multi-Tenant Access.

Provides API key generation, SHA-256 verification with Redis-backed key caching,
JWT decoding, Principal resolution, and fine-grained scope enforcement.
"""

from __future__ import annotations

import dataclasses
import hashlib
import secrets
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

import structlog
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select

from neural_navigator.core.config import Settings, get_settings
from neural_navigator.core.dependencies import SettingsDep
from neural_navigator.infrastructure.cache.redis import RedisCache
from neural_navigator.infrastructure.db.models.api_key import ApiKeyModel
from neural_navigator.utils.constants import ErrorCode

if TYPE_CHECKING:
    from collections.abc import Callable

_logger = structlog.stdlib.get_logger(__name__)

# Redis cache key prefix for API keys
API_KEY_CACHE_PREFIX = "xplainai:apikey:"
API_KEY_CACHE_TTL_SECONDS = 300


@dataclasses.dataclass
class Principal:
    """Security principal representing authenticated caller."""

    user_id: str
    tenant_id: str = "default_tenant"
    tier: str = "free"
    scopes: list[str] = dataclasses.field(default_factory=list)
    rate_limit: int = 300
    key_id: str | None = None
    auth_type: str = "anonymous"
    is_authenticated: bool = True

    def has_scope(self, required_scope: str) -> bool:
        """Check if principal possesses the required permission scope."""
        if "*" in self.scopes or "admin" in self.scopes:
            return True
        if required_scope in self.scopes:
            return True
        # Check domain wildcard e.g., 'research:*' matching 'research:jobs:write'
        if ":" in required_scope:
            domain = required_scope.split(":", 1)[0]
            if f"{domain}:*" in self.scopes:
                return True
        return False

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Principal:
        return cls(**data)


def hash_api_key(raw_key: str) -> str:
    """Compute SHA-256 digest of raw API key."""
    return hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()


def generate_api_key(
    prefix: str = "xpk_live_",
) -> tuple[str, str]:
    """Generate a new secure API key and its SHA-256 hash.

    Returns:
        (raw_key: str, key_hash: str)
    """
    entropy = secrets.token_urlsafe(32)
    raw_key = f"{prefix}{entropy}"
    key_hash = hash_api_key(raw_key)
    return raw_key, key_hash


async def _resolve_key_from_db_or_cache(
    raw_key: str,
    request: Request,
    settings: Settings,
) -> Principal | None:
    """Resolve API key against Redis cache or PostgreSQL database."""
    key_hash = hash_api_key(raw_key)
    cache_key = f"{API_KEY_CACHE_PREFIX}{key_hash}"

    # 1. Try Redis cache if available
    redis_url = settings.redis_url
    redis_cache: RedisCache | None = getattr(request.app.state, "redis_cache", None)
    if redis_cache is None and redis_url:
        redis_cache = RedisCache(redis_url=redis_url)
        request.app.state.redis_cache = redis_cache

    if redis_cache is not None:
        try:
            cached_data = await redis_cache.async_get(cache_key)
            if cached_data and isinstance(cached_data, dict):
                return Principal.from_dict(cached_data)
        except Exception as exc:
            _logger.warning("auth.redis_cache_read_failed", error=str(exc))

    # 2. Query Database
    db_manager = getattr(request.app.state, "db_manager", None)
    if db_manager is None:
        # Check if settings or app state has session factory
        from neural_navigator.infrastructure.db.manager import DatabaseManager

        db_manager = DatabaseManager(settings=settings)
        request.app.state.db_manager = db_manager

    try:
        async with db_manager.session() as session:
            stmt = select(ApiKeyModel).where(
                ApiKeyModel.key_hash == key_hash,
                ApiKeyModel.is_active == True,  # noqa: E712
            )
            result = await session.execute(stmt)
            api_key_record = result.scalars().first()

            if api_key_record is None:
                return None

            # Check expiration
            now = datetime.now(timezone.utc)
            if api_key_record.expires_at is not None:
                expires_at = api_key_record.expires_at
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at <= now:
                    _logger.info("auth.api_key_expired", key_id=api_key_record.id)
                    return None

            # Update last_used_at
            api_key_record.last_used_at = now

            principal = Principal(
                user_id=api_key_record.user_id,
                tenant_id=api_key_record.tenant_id,
                tier=api_key_record.tier,
                scopes=list(api_key_record.scopes or []),
                rate_limit=api_key_record.rate_limit,
                key_id=api_key_record.id,
                auth_type="api_key",
                is_authenticated=True,
            )

            # Store in Redis cache
            if redis_cache is not None:
                try:
                    await redis_cache.async_set(
                        cache_key, principal.to_dict(), ttl_seconds=API_KEY_CACHE_TTL_SECONDS
                    )
                except Exception as exc:
                    _logger.warning("auth.redis_cache_write_failed", error=str(exc))

            return principal
    except Exception as exc:
        _logger.error("auth.db_lookup_failed", error=str(exc))
        return None


async def get_api_key_principal(
    request: Request,
    settings: SettingsDep,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None),
) -> Principal:
    """FastAPI dependency to authenticate and resolve Developer API Key."""
    raw_key = x_api_key
    if not raw_key and authorization and authorization.lower().startswith("bearer xpk_"):
        raw_key = authorization[7:].strip()

    if not raw_key:
        if not settings.auth_required:
            return Principal(
                user_id="usr_anonymous",
                tenant_id="default_tenant",
                tier="free",
                scopes=["*"],
                rate_limit=300,
                auth_type="anonymous",
                is_authenticated=False,
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Provide X-API-Key header or Bearer xpk_... token.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    principal = await _resolve_key_from_db_or_cache(raw_key, request, settings)
    if principal is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    return principal


async def get_current_principal(
    request: Request,
    settings: SettingsDep,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    authorization: str | None = Header(default=None),
) -> Principal:
    """FastAPI dependency resolving API key, JWT token, or anonymous principal."""
    # 1. Check API Key
    raw_key = x_api_key
    if not raw_key and authorization and authorization.lower().startswith("bearer xpk_"):
        raw_key = authorization[7:].strip()

    if raw_key:
        principal = await _resolve_key_from_db_or_cache(raw_key, request, settings)
        if principal is not None:
            return principal
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # 2. Check JWT Bearer
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        try:
            from jose import jwt

            payload = jwt.decode(
                token,
                settings.jwt_secret.get_secret_value(),
                algorithms=[settings.jwt_algorithm],
                audience=settings.jwt_audience,
                issuer=settings.jwt_issuer,
            )
            user_id = payload.get("sub", "usr_jwt_user")
            tenant_id = payload.get("tenant_id", "default_tenant")
            scopes = payload.get("scopes", ["*"])
            tier = payload.get("tier", "authenticated")
            return Principal(
                user_id=user_id,
                tenant_id=tenant_id,
                tier=tier,
                scopes=scopes,
                rate_limit=100,
                auth_type="jwt",
                is_authenticated=True,
            )
        except Exception:
            if settings.auth_required:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired authentication token.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

    # 3. Fallback to Anonymous
    if not settings.auth_required:
        return Principal(
            user_id="usr_anonymous",
            tenant_id="default_tenant",
            tier="free",
            scopes=["*"],
            rate_limit=60,
            auth_type="anonymous",
            is_authenticated=False,
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_scope(required_scope: str) -> Callable[..., Any]:
    """Dependency factory enforcing that the principal possesses a specific scope."""

    async def _scope_checker(
        principal: Principal = Depends(get_current_principal),
    ) -> Principal:
        if not principal.has_scope(required_scope):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: scope '{required_scope}' is required.",
            )
        return principal

    return _scope_checker
