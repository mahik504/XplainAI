"""Per-domain token-bucket rate limiter for polite web crawling."""

from __future__ import annotations

import asyncio
import time


class DomainRateLimiter:
    """Polite per-domain rate limiter ensuring polite request spacing."""

    def __init__(self, default_interval: float = 1.0) -> None:
        self.default_interval = default_interval
        self._last_access: dict[str, float] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    def _get_lock(self, domain: str) -> asyncio.Lock:
        clean_domain = domain.lower().strip()
        if clean_domain not in self._locks:
            self._locks[clean_domain] = asyncio.Lock()
        return self._locks[clean_domain]

    async def acquire(self, domain: str, min_delay: float = 0.0) -> None:
        """Wait until enough time has elapsed to safely fetch from domain."""
        clean_domain = domain.lower().strip()
        delay_needed = max(self.default_interval, min_delay)
        lock = self._get_lock(clean_domain)

        async with lock:
            now = time.monotonic()
            last = self._last_access.get(clean_domain, 0.0)
            elapsed = now - last
            if elapsed < delay_needed:
                await asyncio.sleep(delay_needed - elapsed)
            self._last_access[clean_domain] = time.monotonic()

    def reset(self) -> None:
        self._last_access.clear()
        self._locks.clear()
