"""Cache interfaces and protocols for XplainAI infrastructure.

Defines the abstract contract for transient and persistent key-value caching
across tool executions, query analyses, and expensive LLM synthesis steps.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class BaseCache(Protocol):
    """Abstract protocol for key-value caching backends."""

    def get(self, key: str) -> Any | None:
        """Retrieve a cached value by key, or None if expired/absent."""
        ...

    def set(self, key: str, value: Any, ttl_seconds: float | None = None) -> None:
        """Store a value with an optional time-to-live in seconds."""
        ...

    def delete(self, key: str) -> bool:
        """Remove a key from the cache. Returns True if removed."""
        ...

    def clear(self) -> None:
        """Purge all entries from the cache."""
        ...

    def has(self, key: str) -> bool:
        """Check whether a non-expired key exists in the cache."""
        ...

    async def async_get(self, key: str) -> Any | None:
        """Async retrieve a cached value by key."""
        ...

    async def async_set(self, key: str, value: Any, ttl_seconds: float | None = None) -> None:
        """Async store a value with an optional time-to-live in seconds."""
        ...

    async def async_delete(self, key: str) -> bool:
        """Async remove a key from the cache."""
        ...
