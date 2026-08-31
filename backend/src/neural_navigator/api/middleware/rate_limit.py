"""Rate Limiting Middleware with Sliding Window Algorithm and RFC 9457 Responses.

Enforces per-client request limits using sliding-window timestamp tracking in memory.
Returns RFC 9457 ProblemDetail on HTTP 429 with standard `Retry-After` and `X-RateLimit-*` headers.
"""

from __future__ import annotations

import collections
import hashlib
import math
import time
from threading import Lock
from typing import TYPE_CHECKING, Any

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from neural_navigator.core.dependencies import get_request_id
from neural_navigator.schemas.base import problem_from_exception, serialise_problem
from neural_navigator.utils.constants import ErrorCode

if TYPE_CHECKING:
    from collections.abc import Set

    from starlette.requests import Request

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


class SlidingWindowRateLimiter:
    """In-memory thread-safe sliding window rate limiter."""

    def __init__(
        self,
        requests_per_minute: int = 60,
        window_seconds: float = 60.0,
    ) -> None:
        self.requests_per_minute = requests_per_minute
        self.window_seconds = window_seconds
        self._buckets: dict[str, collections.deque[float]] = {}
        self._lock = Lock()

    def _cleanup_old_entries(self, queue: collections.deque[float], now: float) -> None:
        cutoff = now - self.window_seconds
        while queue and queue[0] <= cutoff:
            queue.popleft()

    def acquire(self, key: str) -> tuple[bool, int, int]:
        """Check and acquire a rate limit slot for the given key.

        Returns:
            (allowed: bool, remaining_requests: int, retry_after_seconds: int)
        """
        now = time.monotonic()
        with self._lock:
            if key not in self._buckets:
                self._buckets[key] = collections.deque()
            queue = self._buckets[key]

            self._cleanup_old_entries(queue, now)

            if len(queue) >= self.requests_per_minute:
                oldest = queue[0]
                retry_after = max(1, math.ceil(self.window_seconds - (now - oldest)))
                return False, 0, retry_after

            queue.append(now)
            remaining = max(0, self.requests_per_minute - len(queue))
            return True, remaining, 0

    def reset(self) -> None:
        """Clear all active buckets (useful for test isolation)."""
        with self._lock:
            self._buckets.clear()


def get_client_identifier(request: Request) -> str:
    """Extract a stable identifier from authentication or client IP."""
    # 1. Check Bearer token in Authorization header
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        if token:
            token_digest = hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]
            return f"token:{token_digest}"

    # 2. Check X-Forwarded-For header
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
        if client_ip:
            return f"ip:{client_ip}"

    # 3. Fallback to direct client host
    if request.client and request.client.host:
        return f"ip:{request.client.host}"

    return "ip:127.0.0.1"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Starlette middleware intercepting requests to enforce rate limits."""

    def __init__(
        self,
        app: Any,
        requests_per_minute: int = 60,
        window_seconds: float = 60.0,
        exempt_paths: Set[str] | None = None,
        rate_limiter: SlidingWindowRateLimiter | None = None,
    ) -> None:
        super().__init__(app)
        self.rate_limiter = rate_limiter or SlidingWindowRateLimiter(
            requests_per_minute=requests_per_minute,
            window_seconds=window_seconds,
        )
        self.exempt_paths = set(exempt_paths if exempt_paths is not None else DEFAULT_EXEMPT_PATHS)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Check exemption
        if request.url.path in self.exempt_paths:
            return await call_next(request)

        client_key = get_client_identifier(request)
        allowed, remaining, retry_after = self.rate_limiter.acquire(client_key)

        if not allowed:
            request_id = get_request_id(request) or request.headers.get("X-Request-ID")
            problem = problem_from_exception(
                status=429,
                title="Too many requests",
                code=ErrorCode.RATE_LIMITED,
                detail=(
                    f"Rate limit of {self.rate_limiter.requests_per_minute} requests per "
                    f"{int(self.rate_limiter.window_seconds)}s exceeded. "
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
                    "X-RateLimit-Limit": str(self.rate_limiter.requests_per_minute),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(retry_after),
                    "Content-Type": "application/problem+json",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.rate_limiter.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
