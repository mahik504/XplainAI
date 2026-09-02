"""Redis cache implementation for distributed caching and state storage.

Provides high-performance key-value caching backed by Redis, with support for
TTL expiration, key namespacing, JSON serialization, and graceful error handling.
"""

from __future__ import annotations

import json
from typing import Any

import structlog

from neural_navigator.infrastructure.cache.base import BaseCache

_logger = structlog.stdlib.get_logger(__name__)


class RedisCache(BaseCache):
    """Distributed cache implementation using Redis with sync and async interfaces."""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        key_prefix: str = "xplainai:cache:",
        default_ttl_seconds: float | None = 3600.0,
        client: Any | None = None,
        async_client: Any | None = None,
    ) -> None:
        self.redis_url = redis_url
        self.key_prefix = key_prefix
        self.default_ttl_seconds = default_ttl_seconds
        self._sync_client = client
        self._async_client = async_client

    def _format_key(self, key: str) -> str:
        """Apply prefix to key."""
        if key.startswith(self.key_prefix):
            return key
        return f"{self.key_prefix}{key}"

    def _get_sync_client(self) -> Any:
        """Lazily initialize synchronous Redis client."""
        if self._sync_client is None:
            import redis

            self._sync_client = redis.Redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_timeout=3.0,
                socket_connect_timeout=3.0,
            )
        return self._sync_client

    def _get_async_client(self) -> Any:
        """Lazily initialize asynchronous Redis client."""
        if self._async_client is None:
            import redis.asyncio as aioredis

            self._async_client = aioredis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_timeout=3.0,
                socket_connect_timeout=3.0,
            )
        return self._async_client

    def _serialize(self, value: Any) -> str:
        """Serialize value to JSON string with type preservation."""
        return json.dumps(value, default=str)

    def _deserialize(self, value: str | None) -> Any | None:
        """Deserialize JSON string to Python object."""
        if value is None:
            return None
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value

    def get(self, key: str) -> Any | None:
        """Retrieve a cached value by key, or None if expired/absent."""
        try:
            client = self._get_sync_client()
            raw = client.get(self._format_key(key))
            return self._deserialize(raw)
        except Exception as exc:
            _logger.warning("redis.cache.get_failed", key=key, error=str(exc))
            return None

    def set(self, key: str, value: Any, ttl_seconds: float | None = None) -> None:
        """Store a value with an optional time-to-live in seconds."""
        try:
            client = self._get_sync_client()
            formatted_key = self._format_key(key)
            serialized = self._serialize(value)
            ttl = int(ttl_seconds if ttl_seconds is not None else (self.default_ttl_seconds or 0))

            if ttl > 0:
                client.setex(formatted_key, ttl, serialized)
            else:
                client.set(formatted_key, serialized)
        except Exception as exc:
            _logger.warning("redis.cache.set_failed", key=key, error=str(exc))

    def delete(self, key: str) -> bool:
        """Remove a key from the cache. Returns True if removed."""
        try:
            client = self._get_sync_client()
            deleted = client.delete(self._format_key(key))
            return bool(deleted > 0)
        except Exception as exc:
            _logger.warning("redis.cache.delete_failed", key=key, error=str(exc))
            return False

    def clear(self) -> None:
        """Purge all entries matching key_prefix from the cache."""
        try:
            client = self._get_sync_client()
            keys = client.keys(f"{self.key_prefix}*")
            if keys:
                client.delete(*keys)
        except Exception as exc:
            _logger.warning("redis.cache.clear_failed", error=str(exc))

    def has(self, key: str) -> bool:
        """Check whether a non-expired key exists in the cache."""
        try:
            client = self._get_sync_client()
            return bool(client.exists(self._format_key(key)))
        except Exception as exc:
            _logger.warning("redis.cache.has_failed", key=key, error=str(exc))
            return False

    async def async_get(self, key: str) -> Any | None:
        """Async retrieve a cached value by key."""
        try:
            client = self._get_async_client()
            raw = await client.get(self._format_key(key))
            return self._deserialize(raw)
        except Exception as exc:
            _logger.warning("redis.cache.async_get_failed", key=key, error=str(exc))
            return None

    async def async_set(self, key: str, value: Any, ttl_seconds: float | None = None) -> None:
        """Async store a value with an optional time-to-live in seconds."""
        try:
            client = self._get_async_client()
            formatted_key = self._format_key(key)
            serialized = self._serialize(value)
            ttl = int(ttl_seconds if ttl_seconds is not None else (self.default_ttl_seconds or 0))

            if ttl > 0:
                await client.setex(formatted_key, ttl, serialized)
            else:
                await client.set(formatted_key, serialized)
        except Exception as exc:
            _logger.warning("redis.cache.async_set_failed", key=key, error=str(exc))

    async def async_delete(self, key: str) -> bool:
        """Async remove a key from the cache."""
        try:
            client = self._get_async_client()
            deleted = await client.delete(self._format_key(key))
            return bool(deleted > 0)
        except Exception as exc:
            _logger.warning("redis.cache.async_delete_failed", key=key, error=str(exc))
            return False

    async def async_has(self, key: str) -> bool:
        """Async check whether a non-expired key exists."""
        try:
            client = self._get_async_client()
            return bool(await client.exists(self._format_key(key)))
        except Exception as exc:
            _logger.warning("redis.cache.async_has_failed", key=key, error=str(exc))
            return False

    async def async_clear(self) -> None:
        """Async purge all entries matching key_prefix from the cache."""
        try:
            client = self._get_async_client()
            keys = await client.keys(f"{self.key_prefix}*")
            if keys:
                await client.delete(*keys)
        except Exception as exc:
            _logger.warning("redis.cache.async_clear_failed", error=str(exc))

    def ping(self) -> bool:
        """Check Redis connectivity synchronously."""
        try:
            client = self._get_sync_client()
            return bool(client.ping())
        except Exception:
            return False

    async def async_ping(self) -> bool:
        """Check Redis connectivity asynchronously."""
        try:
            client = self._get_async_client()
            return bool(await client.ping())
        except Exception:
            return False

    def close(self) -> None:
        """Close sync client connection."""
        if self._sync_client is not None:
            try:
                self._sync_client.close()
            except Exception:
                pass
            self._sync_client = None

    async def aclose(self) -> None:
        """Close async client connection."""
        if self._async_client is not None:
            try:
                await self._async_client.aclose()
            except Exception:
                pass
            self._async_client = None
