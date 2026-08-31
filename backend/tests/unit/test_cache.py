"""Unit tests for cache interfaces and memory/tool cache implementations."""

import time

import pytest

from neural_navigator.infrastructure.cache.memory import InMemoryCache, ToolCache
from neural_navigator.orchestration.tools import ToolResult


def test_in_memory_cache_crud() -> None:
    cache = InMemoryCache(max_size=10, default_ttl_seconds=60)
    assert cache.size == 0

    cache.set("key1", "value1")
    assert cache.has("key1") is True
    assert cache.get("key1") == "value1"
    assert cache.size == 1

    cache.delete("key1")
    assert cache.has("key1") is False
    assert cache.get("key1") is None
    assert cache.size == 0


def test_in_memory_cache_lru_eviction() -> None:
    cache = InMemoryCache(max_size=3)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)

    # Access "a" to make it recently used
    assert cache.get("a") == 1

    # Insert "d" -> "b" should be evicted as the least recently used
    cache.set("d", 4)
    assert cache.has("b") is False
    assert cache.has("a") is True
    assert cache.has("c") is True
    assert cache.has("d") is True


def test_in_memory_cache_ttl_expiration() -> None:
    cache = InMemoryCache(max_size=10, default_ttl_seconds=1)
    cache.set("short_lived", "data", ttl_seconds=0.05)
    assert cache.get("short_lived") == "data"

    time.sleep(0.06)
    assert cache.get("short_lived") is None


@pytest.mark.asyncio
async def test_tool_cache_hit_and_miss() -> None:
    tool_cache = ToolCache()
    call_count = 0

    async def mock_tool_executor(query: str) -> ToolResult:
        nonlocal call_count
        call_count += 1
        return ToolResult(
            tool="mock_tool",
            status="ok",
            started_ms=0.0,
            completed_ms=10.0,
            duration_ms=10.0,
            summary=f"Result for {query}",
            data={"results": [f"Data for {query}"]},
        )

    # 1. First execution -> Miss, calls executor
    res1 = await tool_cache.execute_cached("mock_tool", mock_tool_executor, query="test_query")
    assert res1.status == "ok"
    assert call_count == 1
    assert "(cached)" not in res1.summary

    # 2. Second execution -> Hit, does not call executor again
    res2 = await tool_cache.execute_cached("mock_tool", mock_tool_executor, query="test_query")
    assert res2.status == "ok"
    assert call_count == 1
    assert "(cached)" in res2.summary
