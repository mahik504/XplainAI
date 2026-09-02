"""Rate Limiting Middleware with Distributed Redis Sliding Window and RFC 9457 Responses.

Enforces per-client request limits using atomic Redis Lua scripts with graceful fallback
to an in-memory sliding-window rate limiter when Redis is unreachable.
Supports multi-tier quotas (anonymous: 20 req/min, authenticated: 60 req/min, developer API: 300 req/min).
Returns RFC 9457 ProblemDetail on HTTP 429 with standard `Retry-After` and `X-RateLimit-*` headers.
"""

from __future__ import annotations

import collections
import hashlib
import math
import threading
import time
from typing import TYPE_CHECKING, Any

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from neural_navigator.core.dependencies import get_request_id
from neural_navigator.schemas.base import problem_from_exception, serialise_problem
from neural_navigator.utils.constants import ErrorCode

if TYPE_CHECKING:
    from collections.abc import Set

    from starlette.requests import Request

_logger = structlog.stdlib.get_logger(__name__)

DEFAULT_EXEMPT_PATHS: frozenset[str] = frozenset(
    {
        "/health/live",
        "/health/ready",
        "/metrics",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/favicon.ico",
    }
)

# Multi-tier quota constants (requests per minute)
TIER_LIMIT_ANONYMOUS: int = 20
TIER_LIMIT_AUTHENTICATED: int = 60
TIER_LIMIT_DEV_KEY: int = 300
TIER_LIMIT_DEV_PRO: int = 300
TIER_LIMIT_DEV_ENTERPRISE: int = 1200

# Redis Lua Script for Atomic Sliding-Window Rate Limiting
# Returns: {allowed: 1/0, remaining: number, retry_after_seconds: number}
LUA_SLIDING_WINDOW_SCRIPT = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clear_before = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, clear_before)
local current_requests = redis.call('ZCARD', key)

if current_requests < limit then
    redis.call('ZADD', key, now, now)
    redis.call('PEXPIRE', key, math.ceil(window))
    return {1, limit - current_requests - 1, 0}
else
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local oldest_ts = tonumber(oldest[2]) or (now - window)
    local retry_after = math.ceil((oldest_ts + window - now) / 1000)
    if retry_after <= 0 then retry_after = 1 end
    return {0, 0, retry_after}
end
"""


class SlidingWindowRateLimiter:
    """In-memory thread-safe sliding window rate limiter fallback."""

    def __init__(
        self,
        requests_per_minute: int = 60,
        window_seconds: float = 60.0,
    ) -> None:
        self.requests_per_minute = requests_per_minute
        self.window_seconds = window_seconds
        self._buckets: dict[str, collections.deque[float]] = {}
        self._lock = threading.Lock()

    def _cleanup_old_entries(self, queue: collections.deque[float], now: float) -> None:
        cutoff = now - self.window_seconds
        while queue and queue[0] <= cutoff:
            queue.popleft()

    def acquire(self, key: str, limit: int | None = None) -> tuple[bool, int, int]:
        """Check and acquire a rate limit slot for the given key.

        Returns:
            (allowed: bool, remaining_requests: int, retry_after_seconds: int)
        """
        max_limit = limit if limit is not None else self.requests_per_minute
        now = time.monotonic()
        with self._lock:
            if key not in self._buckets:
                self._buckets[key] = collections.deque()
            queue = self._buckets[key]

            self._cleanup_old_entries(queue, now)

            if len(queue) >= max_limit:
                if queue:
                    oldest = queue[0]
                    retry_after = max(1, math.ceil(self.window_seconds - (now - oldest)))
                else:
                    retry_after = max(1, int(self.window_seconds))
                return False, 0, retry_after

            queue.append(now)
            remaining = max(0, max_limit - len(queue))
            return True, remaining, 0

    def reset(self) -> None:
        """Clear all active buckets (useful for test isolation)."""
        with self._lock:
            self._buckets.clear()


class RedisRateLimiter:
    """Distributed sliding-window rate limiter powered by Redis with in-memory fallback."""

    def __init__(
        self,
        redis_url: str | None = None,
        key_prefix: str = "xplainai:ratelimit:",
        window_seconds: float = 60.0,
        default_limit: int = 60,
        fallback_limiter: SlidingWindowRateLimiter | None = None,
        client: Any | None = None,
        async_client: Any | None = None,
    ) -> None:
        self.redis_url = redis_url
        self.key_prefix = key_prefix
        self.window_seconds = window_seconds
        self.default_limit = default_limit
        self._fallback = fallback_limiter or SlidingWindowRateLimiter(
            requests_per_minute=default_limit,
            window_seconds=window_seconds,
        )
        self._sync_client = client
        self._async_client = async_client
        self._lua_sha: str | None = None
        self._async_lua_sha: str | None = None

    @property
    def fallback(self) -> SlidingWindowRateLimiter:
        return self._fallback

    def _get_sync_client(self) -> Any | None:
        if self._sync_client is not None:
            return self._sync_client
        if not self.redis_url:
            return None
        try:
            import redis

            self._sync_client = redis.Redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_timeout=1.5,
                socket_connect_timeout=1.5,
            )
            return self._sync_client
        except Exception as exc:
            _logger.warning("ratelimit.redis_sync_client_init_failed", error=str(exc))
            return None

    def _get_async_client(self) -> Any | None:
        if self._async_client is not None:
            return self._async_client
        if not self.redis_url:
            return None
        try:
            import redis.asyncio as aioredis

            self._async_client = aioredis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_timeout=1.5,
                socket_connect_timeout=1.5,
            )
            return self._async_client
        except Exception as exc:
            _logger.warning("ratelimit.redis_async_client_init_failed", error=str(exc))
            return None

    def acquire(self, key: str, limit: int | None = None) -> tuple[bool, int, int]:
        """Synchronous check and acquire."""
        max_limit = limit if limit is not None else self.default_limit
        redis_client = self._get_sync_client()

        if redis_client is not None:
            try:
                now_ms = int(time.time() * 1000)
                window_ms = int(self.window_seconds * 1000)
                redis_key = f"{self.key_prefix}{key}"

                res = redis_client.eval(
                    LUA_SLIDING_WINDOW_SCRIPT,
                    1,
                    redis_key,
                    now_ms,
                    window_ms,
                    max_limit,
                )
                allowed = bool(res[0] == 1)
                remaining = int(res[1])
                retry_after = int(res[2])
                return allowed, remaining, retry_after
            except Exception as exc:
                _logger.warning("ratelimit.redis_acquire_failed_fallback", error=str(exc), key=key)

        return self._fallback.acquire(key, limit=max_limit)

    async def async_acquire(self, key: str, limit: int | None = None) -> tuple[bool, int, int]:
        """Asynchronous check and acquire."""
        max_limit = limit if limit is not None else self.default_limit
        redis_client = self._get_async_client()

        if redis_client is not None:
            try:
                now_ms = int(time.time() * 1000)
                window_ms = int(self.window_seconds * 1000)
                redis_key = f"{self.key_prefix}{key}"

                res = await redis_client.eval(
                    LUA_SLIDING_WINDOW_SCRIPT,
                    1,
                    redis_key,
                    now_ms,
                    window_ms,
                    max_limit,
                )
                allowed = bool(res[0] == 1)
                remaining = int(res[1])
                retry_after = int(res[2])
                return allowed, remaining, retry_after
            except Exception as exc:
                _logger.warning("ratelimit.async_redis_acquire_failed_fallback", error=str(exc), key=key)

        return self._fallback.acquire(key, limit=max_limit)

    def reset(self) -> None:
        """Reset limiter state."""
        self._fallback.reset()
        client = self._get_sync_client()
        if client is not None:
            try:
                keys = client.keys(f"{self.key_prefix}*")
                if keys:
                    client.delete(*keys)
            except Exception:
                pass


def resolve_client_tier_and_key(request: Request) -> tuple[str, int, str]:
    """Extract client key, quota limit (RPM), and tier category from request.

    Returns:
        (client_key: str, limit_rpm: int, tier_name: str)
    """
    # 1. Developer API Key in X-API-Key header or Authorization: Bearer xpk_...
    api_key = request.headers.get("x-api-key")
    auth_header = request.headers.get("authorization", "")

    if not api_key and auth_header.lower().startswith("bearer xpk_"):
        api_key = auth_header[7:].strip()

    if api_key:
        key_digest = hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:16]
        # Check for enterprise / pro prefix markers or custom header
        tier_header = request.headers.get("x-tier", "").lower()
        if tier_header == "enterprise":
            return f"apikey:{key_digest}", TIER_LIMIT_DEV_ENTERPRISE, "enterprise"
        elif tier_header == "pro":
            return f"apikey:{key_digest}", TIER_LIMIT_DEV_PRO, "pro"
        return f"apikey:{key_digest}", TIER_LIMIT_DEV_KEY, "developer"

    # 2. Authenticated User JWT in Authorization: Bearer <token>
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        if token:
            token_digest = hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]
            return f"token:{token_digest}", TIER_LIMIT_AUTHENTICATED, "authenticated"

    # 3. Anonymous Client IP
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
        if client_ip:
            return f"ip:{client_ip}", TIER_LIMIT_ANONYMOUS, "anonymous"

    if request.client and request.client.host:
        return f"ip:{request.client.host}", TIER_LIMIT_ANONYMOUS, "anonymous"

    return "ip:127.0.0.1", TIER_LIMIT_ANONYMOUS, "anonymous"


def get_client_identifier(request: Request) -> str:
    """Extract a stable identifier from authentication or client IP (backwards compatibility)."""
    key, _, _ = resolve_client_tier_and_key(request)
    return key


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Starlette middleware intercepting requests to enforce distributed rate limits."""

    def __init__(
        self,
        app: Any,
        requests_per_minute: int = 60,
        window_seconds: float = 60.0,
        exempt_paths: Set[str] | None = None,
        rate_limiter: RedisRateLimiter | SlidingWindowRateLimiter | None = None,
        redis_url: str | None = None,
    ) -> None:
        super().__init__(app)
        if rate_limiter is None:
            self.rate_limiter: RedisRateLimiter | SlidingWindowRateLimiter = RedisRateLimiter(
                redis_url=redis_url,
                default_limit=requests_per_minute,
                window_seconds=window_seconds,
            )
        else:
            self.rate_limiter = rate_limiter

        self.requests_per_minute = requests_per_minute
        self.window_seconds = window_seconds
        self.exempt_paths = set(exempt_paths if exempt_paths is not None else DEFAULT_EXEMPT_PATHS)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Check exemption
        if request.url.path in self.exempt_paths:
            return await call_next(request)

        client_key, quota_limit, tier = resolve_client_tier_and_key(request)

        # If a custom SlidingWindowRateLimiter was explicitly injected, honor its configured limit
        if isinstance(self.rate_limiter, SlidingWindowRateLimiter):
            effective_limit = self.rate_limiter.requests_per_minute
        else:
            effective_limit = quota_limit

        # Acquire rate limit slot
        if isinstance(self.rate_limiter, RedisRateLimiter):
            allowed, remaining, retry_after = await self.rate_limiter.async_acquire(
                client_key, limit=effective_limit
            )
        else:
            allowed, remaining, retry_after = self.rate_limiter.acquire(
                client_key, limit=effective_limit
            )

        if not allowed:
            request_id = get_request_id(request) or request.headers.get("X-Request-ID")
            problem = problem_from_exception(
                status=429,
                title="Too many requests",
                code=ErrorCode.RATE_LIMITED,
                detail=(
                    f"Rate limit of {effective_limit} requests per "
                    f"{int(self.window_seconds)}s exceeded for tier '{tier}'. "
                    f"Please retry after {retry_after} second(s)."
                ),
                instance=request.url.path,
                request_id=request_id,
            )
            return JSONResponse(
                status_code=429,
                content=serialise_problem(problem),
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(effective_limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(retry_after),
                    "Content-Type": "application/problem+json",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(effective_limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
