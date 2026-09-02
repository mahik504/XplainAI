"""Unit tests for distributed Redis cache and rate limiting middleware."""

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock

import pytest
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from neural_navigator.api.middleware.rate_limit import (
    TIER_LIMIT_ANONYMOUS,
    TIER_LIMIT_AUTHENTICATED,
    TIER_LIMIT_DEV_ENTERPRISE,
    TIER_LIMIT_DEV_KEY,
    TIER_LIMIT_DEV_PRO,
    RateLimitMiddleware,
    RedisRateLimiter,
    SlidingWindowRateLimiter,
    resolve_client_tier_and_key,
)
from neural_navigator.infrastructure.cache.redis import RedisCache


def test_redis_cache_sync_and_async_interface() -> None:
    # Test RedisCache with mock client
    mock_redis = MagicMock()
    mock_redis.get.return_value = '{"foo": "bar"}'
    mock_redis.exists.return_value = 1
    mock_redis.delete.return_value = 1
    mock_redis.ping.return_value = True

    cache = RedisCache(client=mock_redis)

    # 1. Sync Get & Set
    val = cache.get("test_key")
    assert val == {"foo": "bar"}
    mock_redis.get.assert_called_with("xplainai:cache:test_key")

    cache.set("test_key", {"foo": "bar"}, ttl_seconds=60)
    mock_redis.setex.assert_called_with("xplainai:cache:test_key", 60, '{"foo": "bar"}')

    assert cache.has("test_key") is True
    assert cache.delete("test_key") is True
    assert cache.ping() is True


@pytest.mark.asyncio
async def test_redis_cache_async_methods() -> None:
    mock_async_redis = AsyncMock()
    mock_async_redis.get.return_value = '{"number": 42}'
    mock_async_redis.exists.return_value = 1
    mock_async_redis.delete.return_value = 1
    mock_async_redis.ping.return_value = True

    cache = RedisCache(async_client=mock_async_redis)

    val = await cache.async_get("async_key")
    assert val == {"number": 42}

    await cache.async_set("async_key", {"number": 42}, ttl_seconds=120)
    mock_async_redis.setex.assert_called_with("xplainai:cache:async_key", 120, '{"number": 42}')

    assert await cache.async_has("async_key") is True
    assert await cache.async_delete("async_key") is True
    assert await cache.async_ping() is True


def test_sliding_window_rate_limiter_multitier() -> None:
    limiter = SlidingWindowRateLimiter(requests_per_minute=3, window_seconds=60.0)

    # First 3 allowed
    allowed1, rem1, retry1 = limiter.acquire("user1")
    assert allowed1 is True
    assert rem1 == 2
    assert retry1 == 0

    allowed2, rem2, retry2 = limiter.acquire("user1")
    assert allowed2 is True
    assert rem2 == 1

    allowed3, rem3, retry3 = limiter.acquire("user1")
    assert allowed3 is True
    assert rem3 == 0

    # 4th blocked
    allowed4, rem4, retry4 = limiter.acquire("user1")
    assert allowed4 is False
    assert rem4 == 0
    assert retry4 >= 1

    # Different key is still allowed
    allowed_other, rem_other, _ = limiter.acquire("user2")
    assert allowed_other is True
    assert rem_other == 2


@pytest.mark.asyncio
async def test_redis_rate_limiter_lua_and_fallback() -> None:
    # 1. Test Redis Rate Limiter with Lua script simulation
    mock_async_redis = AsyncMock()
    # Mock Redis eval returning [allowed=1, remaining=4, retry_after=0]
    mock_async_redis.eval.return_value = [1, 4, 0]

    limiter = RedisRateLimiter(async_client=mock_async_redis, default_limit=5)
    allowed, remaining, retry_after = await limiter.async_acquire("client1", limit=5)
    assert allowed is True
    assert remaining == 4
    assert retry_after == 0

    # Mock Redis eval returning [allowed=0, remaining=0, retry_after=15]
    mock_async_redis.eval.return_value = [0, 0, 15]
    allowed2, rem2, retry2 = await limiter.async_acquire("client1", limit=5)
    assert allowed2 is False
    assert rem2 == 0
    assert retry2 == 15

    # 2. Test Graceful Fallback when Redis raises ConnectionError
    mock_failing_redis = AsyncMock()
    mock_failing_redis.eval.side_effect = ConnectionError("Redis connection refused")

    fallback_limiter = RedisRateLimiter(async_client=mock_failing_redis, default_limit=2)
    # Should fall back to in-memory limiter without crashing
    f_allowed1, _, _ = await fallback_limiter.async_acquire("fallback_key", limit=2)
    assert f_allowed1 is True
    f_allowed2, _, _ = await fallback_limiter.async_acquire("fallback_key", limit=2)
    assert f_allowed2 is True
    f_allowed3, _, f_retry = await fallback_limiter.async_acquire("fallback_key", limit=2)
    assert f_allowed3 is False
    assert f_retry >= 1


def test_resolve_client_tier_and_key() -> None:
    # 1. Developer API Key in header
    scope = {
        "type": "http",
        "headers": [(b"x-api-key", b"xpk_live_secret123456")],
        "client": ("192.168.1.50", 12345),
    }
    req = Request(scope)
    key, limit, tier = resolve_client_tier_and_key(req)
    assert key.startswith("apikey:")
    assert limit == TIER_LIMIT_DEV_KEY
    assert tier == "developer"

    # 2. Developer API Key Enterprise tier
    scope_ent = {
        "type": "http",
        "headers": [(b"x-api-key", b"xpk_live_enterprise"), (b"x-tier", b"enterprise")],
        "client": ("192.168.1.50", 12345),
    }
    req_ent = Request(scope_ent)
    _, limit_ent, tier_ent = resolve_client_tier_and_key(req_ent)
    assert limit_ent == TIER_LIMIT_DEV_ENTERPRISE
    assert tier_ent == "enterprise"

    # 3. Authenticated User JWT
    scope_jwt = {
        "type": "http",
        "headers": [(b"authorization", b"Bearer eyJhbGciOiJIUzI1NiJ9.user_token")],
        "client": ("192.168.1.50", 12345),
    }
    req_jwt = Request(scope_jwt)
    key_jwt, limit_jwt, tier_jwt = resolve_client_tier_and_key(req_jwt)
    assert key_jwt.startswith("token:") or key_jwt.startswith("user:")
    assert limit_jwt == TIER_LIMIT_AUTHENTICATED
    assert tier_jwt == "authenticated"

    # 4. Anonymous Client IP
    scope_anon = {
        "type": "http",
        "headers": [(b"x-forwarded-for", b"203.0.113.195, 10.0.0.1")],
        "client": ("192.168.1.50", 12345),
    }
    req_anon = Request(scope_anon)
    key_anon, limit_anon, tier_anon = resolve_client_tier_and_key(req_anon)
    assert key_anon == "ip:203.0.113.195"
    assert limit_anon == TIER_LIMIT_ANONYMOUS
    assert tier_anon == "anonymous"


@pytest.mark.asyncio
async def test_rate_limit_middleware_429_problem_detail() -> None:
    limiter = SlidingWindowRateLimiter(requests_per_minute=1, window_seconds=60.0)

    async def dummy_app(scope, receive, send):
        response = Response("OK", status_code=200)
        await response(scope, receive, send)

    middleware = RateLimitMiddleware(app=dummy_app, rate_limiter=limiter)

    # Call 1 -> 200 OK
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/chat/models",
        "headers": [(b"x-forwarded-for", b"1.2.3.4")],
        "client": ("1.2.3.4", 80),
    }
    req1 = Request(scope)

    async def call_next(r):
        return Response("OK", status_code=200)

    resp1 = await middleware.dispatch(req1, call_next)
    assert resp1.status_code == 200
    assert resp1.headers["X-RateLimit-Limit"] in ["1", "20"]
    assert "X-RateLimit-Remaining" in resp1.headers

    # Call 2 with 1-request quota -> 429 Too Many Requests
    limiter_strict = SlidingWindowRateLimiter(requests_per_minute=0, window_seconds=60.0)
    middleware_strict = RateLimitMiddleware(app=dummy_app, rate_limiter=limiter_strict)

    resp2 = await middleware_strict.dispatch(req1, call_next)
    assert resp2.status_code == 429
    assert resp2.headers["Content-Type"] == "application/problem+json"
    assert resp2.headers["X-RateLimit-Remaining"] == "0"
    assert "Retry-After" in resp2.headers
