"""In-memory cache implementation with TTL and LRU eviction policy.

Provides thread-safe and async-compatible caching for research tool results,
API responses, and intermediate query analysis structures.
"""

from __future__ import annotations

import hashlib
import json
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from neural_navigator.infrastructure.cache.base import BaseCache
from neural_navigator.orchestration.tools import ToolResult

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable


@dataclass(slots=True)
class _CacheEntry:
    value: Any
    expires_at: float | None  # time.monotonic timestamp


class InMemoryCache(BaseCache):
    """Thread-safe LRU cache with per-item TTL expiration."""

    def __init__(
        self,
        *,
        max_size: int = 1000,
        default_ttl_seconds: float | None = None,
    ) -> None:
        self._max_size = max(1, max_size)
        self._default_ttl = default_ttl_seconds
        self._entries: OrderedDict[str, _CacheEntry] = OrderedDict()
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0

    @property
    def size(self) -> int:
        with self._lock:
            self._purge_expired()
            return len(self._entries)

    @property
    def hits(self) -> int:
        return self._hits

    @property
    def misses(self) -> int:
        return self._misses

    def _purge_expired(self) -> None:
        now = time.monotonic()
        expired_keys = [
            k for k, v in self._entries.items() if v.expires_at is not None and v.expires_at <= now
        ]
        for k in expired_keys:
            del self._entries[k]

    def get(self, key: str) -> Any | None:
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                self._misses += 1
                return None

            now = time.monotonic()
            if entry.expires_at is not None and entry.expires_at <= now:
                del self._entries[key]
                self._misses += 1
                return None

            # Move to end (most recently used)
            self._entries.move_to_end(key)
            self._hits += 1
            return entry.value

    def set(self, key: str, value: Any, ttl_seconds: float | None = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
        expires_at = (time.monotonic() + ttl) if ttl is not None and ttl > 0 else None

        with self._lock:
            if key in self._entries:
                self._entries.move_to_end(key)
            self._entries[key] = _CacheEntry(value=value, expires_at=expires_at)

            # Evict LRU items if over capacity
            while len(self._entries) > self._max_size:
                self._entries.popitem(last=False)

    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._entries:
                del self._entries[key]
                return True
            return False

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
            self._hits = 0
            self._misses = 0

    def has(self, key: str) -> bool:
        return self.get(key) is not None

    async def async_get(self, key: str) -> Any | None:
        return self.get(key)

    async def async_set(self, key: str, value: Any, ttl_seconds: float | None = None) -> None:
        self.set(key, value, ttl_seconds=ttl_seconds)

    async def async_delete(self, key: str) -> bool:
        return self.delete(key)

    def stats(self) -> dict[str, Any]:
        with self._lock:
            self._purge_expired()
            total_lookups = self._hits + self._misses
            hit_ratio = round(self._hits / total_lookups, 3) if total_lookups > 0 else 0.0
            return {
                "size": len(self._entries),
                "max_size": self._max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_ratio": hit_ratio,
            }


class ToolCache:
    """Specialized caching layer for external research and calculation tools."""

    def __init__(self, backend: BaseCache | None = None) -> None:
        self._backend: BaseCache = backend or InMemoryCache(
            max_size=500,
            default_ttl_seconds=600,
        )

    def generate_cache_key(self, tool_name: str, **kwargs: Any) -> str:
        """Create a deterministic hash key for a tool execution."""
        canonical_args = json.dumps(kwargs, sort_keys=True, default=str)
        arg_hash = hashlib.sha256(canonical_args.encode("utf-8")).hexdigest()[:16]
        return f"tool:{tool_name}:{arg_hash}"

    async def execute_cached(
        self,
        tool_name: str,
        executor: Callable[..., Awaitable[ToolResult]],
        *,
        ttl_seconds: int = 600,
        **kwargs: Any,
    ) -> ToolResult:
        """Execute the tool if not cached; otherwise return the cached result."""
        key = self.generate_cache_key(tool_name, **kwargs)
        cached_dict = await self._backend.async_get(key)
        if isinstance(cached_dict, dict):
            # Rehydrate cached ToolResult
            return ToolResult(
                tool=cached_dict.get("tool", tool_name),
                status=cached_dict.get("status", "ok"),
                started_ms=cached_dict.get("started_ms", 0.0),
                completed_ms=cached_dict.get("completed_ms", 0.0),
                duration_ms=0.1,  # Cache hit duration is negligible
                summary=f"{cached_dict.get('summary', '')} (cached)",
                data=cached_dict.get("data", {}),
            )

        result = await executor(**kwargs)
        if result.status == "ok":
            await self._backend.async_set(key, result.as_dict(), ttl_seconds=ttl_seconds)

        return result
