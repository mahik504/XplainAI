"""Cost Circuit Breaker with Distributed Redis Sliding Window & In-Memory Fallback.

Enforces hard daily ($10.00), hourly ($2.00), and per-IP ($0.50) spend limits on LLM
usage to prevent runaway costs on public demo endpoints and authenticated calls.
"""

from __future__ import annotations

import collections
import math
import threading
import time
import uuid
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import structlog

if TYPE_CHECKING:
    from neural_navigator.core.config import Settings

_logger = structlog.stdlib.get_logger(__name__)

# Model pricing in USD per 1,000 tokens (input, output)
MODEL_PRICING_PER_1K: dict[str, tuple[float, float]] = {
    "gpt-4o-mini": (0.00015, 0.0006),
    "gpt-4o": (0.0025, 0.010),
    "o3-mini": (0.0011, 0.0044),
    "claude-3-5-sonnet": (0.003, 0.015),
    "claude-3-5-haiku": (0.0008, 0.004),
    "gemini-2.0-flash": (0.0001, 0.0004),
    "gemini-1.5-flash": (0.0001, 0.0004),
    "gemini-1.5-pro": (0.00125, 0.005),
    "deepseek-reasoner": (0.00055, 0.00219),
    "deepseek-r1": (0.00055, 0.00219),
    "deepseek-chat": (0.00014, 0.00028),
    "default": (0.0015, 0.006),
}

# Redis Lua Script for Atomic Budget Check & Spend Recording
# ARGV: [1] now_ms, [2] window_ms, [3] limit_usd, [4] cost_usd, [5] record_spend (1 or 0), [6] entry_id
LUA_BUDGET_SCRIPT = """
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit_usd = tonumber(ARGV[3])
local cost_usd = tonumber(ARGV[4])
local record_spend = tonumber(ARGV[5])
local entry_id = ARGV[6]

local clear_before = now_ms - window_ms
redis.call('ZREMRANGEBYSCORE', key, 0, clear_before)

local entries = redis.call('ZRANGE', key, 0, -1, 'WITHSCORES')
local current_spend = 0.0

for i = 1, #entries, 2 do
    local member = entries[i]
    local colon_pos = string.find(member, ':')
    if colon_pos then
        local cost_str = string.sub(member, colon_pos + 1)
        local cost_val = tonumber(cost_str) or 0.0
        current_spend = current_spend + cost_val
    end
end

if record_spend == 1 then
    if cost_usd > 0 then
        local member = entry_id .. ':' .. tostring(cost_usd)
        redis.call('ZADD', key, now_ms, member)
        redis.call('PEXPIRE', key, math.ceil(window_ms))
        current_spend = current_spend + cost_usd
    end
    return {1, tostring(current_spend), 0}
end

if (current_spend + cost_usd) > limit_usd then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local oldest_ts = tonumber(oldest[2]) or (now_ms - window_ms)
    local retry_after = math.ceil((oldest_ts + window_ms - now_ms) / 1000)
    if retry_after <= 0 then retry_after = 1 end
    return {0, tostring(current_spend), retry_after}
else
    return {1, tostring(current_spend), 0}
end
"""


@dataclass(frozen=True, slots=True)
class SpendRecord:
    timestamp: float
    cost_usd: float


class SlidingWindowSpendTracker:
    """Thread-safe in-memory sliding window cost tracker fallback."""

    def __init__(self) -> None:
        self._records: dict[str, collections.deque[SpendRecord]] = collections.defaultdict(
            collections.deque
        )
        self._lock = threading.Lock()

    def _clean_old(self, queue: collections.deque[SpendRecord], now: float, window_seconds: float) -> None:
        cutoff = now - window_seconds
        while queue and queue[0].timestamp <= cutoff:
            queue.popleft()

    def check_and_record(
        self,
        key: str,
        limit_usd: float,
        cost_usd: float,
        window_seconds: float,
        record: bool = False,
    ) -> tuple[bool, float, float]:
        """Check budget and optionally record spend.

        Returns: (allowed, current_spend, retry_after_seconds)
        """
        now = time.monotonic()
        with self._lock:
            queue = self._records[key]
            self._clean_old(queue, now, window_seconds)
            current_spend = sum(item.cost_usd for item in queue)

            if record:
                if cost_usd > 0:
                    queue.append(SpendRecord(timestamp=now, cost_usd=cost_usd))
                    current_spend += cost_usd
                return True, current_spend, 0.0

            if current_spend + cost_usd > limit_usd:
                oldest_ts = queue[0].timestamp if queue else (now - window_seconds)
                retry_after = max(1.0, math.ceil(window_seconds - (now - oldest_ts)))
                return False, current_spend, retry_after

            return True, current_spend, 0.0

    def get_current_spend(self, key: str, window_seconds: float) -> float:
        now = time.monotonic()
        with self._lock:
            queue = self._records[key]
            self._clean_old(queue, now, window_seconds)
            return sum(item.cost_usd for item in queue)

    def reset(self) -> None:
        with self._lock:
            self._records.clear()


# Backwards compatibility alias
SlidingWindowCostTracker = SlidingWindowSpendTracker


class CostCircuitBreaker:
    """Production Cost Circuit Breaker governing daily, hourly, and per-IP spend."""

    def __init__(
        self,
        settings: Settings | None = None,
        redis_url: str | None = None,
        daily_limit_usd: float = 10.0,
        hourly_limit_usd: float = 2.0,
        ip_daily_limit_usd: float = 0.50,
        daily_budget_usd: float | None = None,
        hourly_budget_usd: float | None = None,
        ip_budget_usd: float | None = None,
        enabled: bool = True,
        key_prefix: str = "xplainai:budget:",
        fallback_tracker: SlidingWindowSpendTracker | None = None,
        sync_client: Any | None = None,
        async_client: Any | None = None,
    ) -> None:
        if settings is not None:
            self.daily_limit_usd = getattr(
                settings, "omni_router_daily_budget_usd", settings.budget_daily_limit_usd
            )
            self.hourly_limit_usd = getattr(
                settings, "omni_router_hourly_budget_usd", settings.budget_hourly_limit_usd
            )
            self.ip_daily_limit_usd = getattr(
                settings, "omni_router_ip_budget_usd", settings.budget_ip_daily_limit_usd
            )
            self.enabled = settings.budget_circuit_breaker_enabled
            self.redis_url = settings.redis_url or redis_url
        else:
            self.daily_limit_usd = daily_budget_usd if daily_budget_usd is not None else daily_limit_usd
            self.hourly_limit_usd = hourly_budget_usd if hourly_budget_usd is not None else hourly_limit_usd
            self.ip_daily_limit_usd = ip_budget_usd if ip_budget_usd is not None else ip_daily_limit_usd
            self.enabled = enabled
            self.redis_url = redis_url

        self.key_prefix = key_prefix
        self._fallback = fallback_tracker or SlidingWindowSpendTracker()
        self._sync_redis: Any | None = sync_client
        self._async_redis: Any | None = async_client

    @property
    def fallback(self) -> SlidingWindowSpendTracker:
        return self._fallback

    @staticmethod
    def get_model_rates(model: str) -> tuple[float, float]:
        """Return (input_rate_per_1k, output_rate_per_1k) in USD."""
        normalized = model.lower().strip()
        for prefix, rates in MODEL_PRICING_PER_1K.items():
            if prefix in normalized:
                return rates
        return MODEL_PRICING_PER_1K["default"]

    @classmethod
    def estimate_cost(
        cls,
        model: str,
        input_tokens: int = 1000,
        output_tokens: int = 2000,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
    ) -> float:
        """Estimate projected cost in USD for a model turn."""
        in_tok = prompt_tokens if prompt_tokens is not None else input_tokens
        out_tok = completion_tokens if completion_tokens is not None else output_tokens
        in_rate, out_rate = cls.get_model_rates(model)
        return round((in_tok / 1000.0) * in_rate + (out_tok / 1000.0) * out_rate, 6)

    @classmethod
    def calculate_actual_cost(
        cls,
        model: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
    ) -> float:
        """Calculate exact realized cost in USD from model token counts."""
        in_tok = prompt_tokens if prompt_tokens is not None else input_tokens
        out_tok = completion_tokens if completion_tokens is not None else output_tokens
        in_rate, out_rate = cls.get_model_rates(model)
        return round((in_tok / 1000.0) * in_rate + (out_tok / 1000.0) * out_rate, 6)

    @classmethod
    def calculate_cost_usd(
        cls,
        model: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
    ) -> float:
        """Convenience alias for calculate_actual_cost."""
        return cls.calculate_actual_cost(
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )

    def _get_sync_client(self) -> Any | None:
        if self._sync_redis is not None:
            return self._sync_redis
        if not self.redis_url:
            return None
        try:
            import redis

            self._sync_redis = redis.Redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_timeout=1.5,
                socket_connect_timeout=1.5,
            )
            return self._sync_redis
        except Exception as exc:
            _logger.warning("circuit_breaker.redis_sync_client_failed", error=str(exc))
            return None

    def _get_async_client(self) -> Any | None:
        if self._async_redis is not None:
            return self._async_redis
        if not self.redis_url:
            return None
        try:
            import redis.asyncio as aioredis

            self._async_redis = aioredis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_timeout=1.5,
                socket_connect_timeout=1.5,
            )
            return self._async_redis
        except Exception as exc:
            _logger.warning("circuit_breaker.redis_async_client_failed", error=str(exc))
            return None

    def _clean_ip(self, ip: str) -> str:
        return ip.strip().replace(":", "_").replace("/", "_") or "127.0.0.1"

    def check_preflight(
        self,
        client_ip: str = "127.0.0.1",
        estimated_cost: float = 0.005,
    ) -> tuple[bool, str | None]:
        """Pre-flight check: returns (allowed, reason_if_rejected)."""
        allowed, reason, _ = self.check_budget(client_ip=client_ip, estimated_cost=estimated_cost)
        return allowed, reason

    async def async_check_preflight(
        self,
        client_ip: str = "127.0.0.1",
        estimated_cost: float = 0.005,
    ) -> tuple[bool, str | None]:
        """Async pre-flight check: returns (allowed, reason_if_rejected)."""
        allowed, reason, _ = await self.check_budget_async(
            client_ip=client_ip, estimated_cost=estimated_cost
        )
        return allowed, reason

    def check_budget(
        self,
        client_ip: str = "127.0.0.1",
        estimated_cost: float = 0.005,
    ) -> tuple[bool, str | None, float]:
        """Pre-flight check across global daily, global hourly, and client IP daily limits.

        Returns: (allowed: bool, reason: str | None, retry_after: float)
        """
        if not self.enabled:
            return True, None, 0.0

        clean_ip = self._clean_ip(client_ip)
        redis_client = self._get_sync_client()

        # 1. Global Daily ($10.00 / 86400s)
        allowed, reason, retry = self._eval_sync(
            redis_client,
            key=f"{self.key_prefix}global_daily",
            limit_usd=self.daily_limit_usd,
            cost_usd=estimated_cost,
            window_seconds=86400.0,
            record=False,
            budget_name="Global daily budget ($10.00/day)",
        )
        if not allowed:
            return False, reason, retry

        # 2. Global Hourly ($2.00 / 3600s)
        allowed, reason, retry = self._eval_sync(
            redis_client,
            key=f"{self.key_prefix}global_hourly",
            limit_usd=self.hourly_limit_usd,
            cost_usd=estimated_cost,
            window_seconds=3600.0,
            record=False,
            budget_name="Global hourly budget ($2.00/hr)",
        )
        if not allowed:
            return False, reason, retry

        # 3. Client IP Daily ($0.50 / 86400s)
        allowed, reason, retry = self._eval_sync(
            redis_client,
            key=f"{self.key_prefix}ip_daily:{clean_ip}",
            limit_usd=self.ip_daily_limit_usd,
            cost_usd=estimated_cost,
            window_seconds=86400.0,
            record=False,
            budget_name=f"Per-IP daily demo limit ($0.50/day for {client_ip})",
        )
        if not allowed:
            return False, reason, retry

        return True, None, 0.0

    async def check_budget_async(
        self,
        client_ip: str = "127.0.0.1",
        estimated_cost: float = 0.005,
    ) -> tuple[bool, str | None, float]:
        """Async pre-flight check across limits."""
        if not self.enabled:
            return True, None, 0.0

        clean_ip = self._clean_ip(client_ip)
        redis_client = self._get_async_client()

        # 1. Global Daily
        allowed, reason, retry = await self._eval_async(
            redis_client,
            key=f"{self.key_prefix}global_daily",
            limit_usd=self.daily_limit_usd,
            cost_usd=estimated_cost,
            window_seconds=86400.0,
            record=False,
            budget_name="Global daily budget ($10.00/day)",
        )
        if not allowed:
            return False, reason, retry

        # 2. Global Hourly
        allowed, reason, retry = await self._eval_async(
            redis_client,
            key=f"{self.key_prefix}global_hourly",
            limit_usd=self.hourly_limit_usd,
            cost_usd=estimated_cost,
            window_seconds=3600.0,
            record=False,
            budget_name="Global hourly budget ($2.00/hr)",
        )
        if not allowed:
            return False, reason, retry

        # 3. Client IP Daily
        allowed, reason, retry = await self._eval_async(
            redis_client,
            key=f"{self.key_prefix}ip_daily:{clean_ip}",
            limit_usd=self.ip_daily_limit_usd,
            cost_usd=estimated_cost,
            window_seconds=86400.0,
            record=False,
            budget_name=f"Per-IP daily demo limit ($0.50/day for {client_ip})",
        )
        if not allowed:
            return False, reason, retry

        return True, None, 0.0

    def record_spend(
        self,
        client_ip: str,
        model: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
    ) -> float:
        """Record actual spend across global daily, global hourly, and per-IP daily buckets."""
        in_tok = input_tokens if input_tokens is not None else prompt_tokens
        out_tok = output_tokens if output_tokens is not None else completion_tokens
        cost = self.calculate_actual_cost(model, input_tokens=in_tok, output_tokens=out_tok)
        if not self.enabled or cost <= 0:
            return cost

        clean_ip = self._clean_ip(client_ip)
        redis_client = self._get_sync_client()
        entry_id = uuid.uuid4().hex[:12]

        self._eval_sync(
            redis_client,
            key=f"{self.key_prefix}global_daily",
            limit_usd=self.daily_limit_usd,
            cost_usd=cost,
            window_seconds=86400.0,
            record=True,
            budget_name="Global daily",
            entry_id=entry_id,
        )
        self._eval_sync(
            redis_client,
            key=f"{self.key_prefix}global_hourly",
            limit_usd=self.hourly_limit_usd,
            cost_usd=cost,
            window_seconds=3600.0,
            record=True,
            budget_name="Global hourly",
            entry_id=entry_id,
        )
        self._eval_sync(
            redis_client,
            key=f"{self.key_prefix}ip_daily:{clean_ip}",
            limit_usd=self.ip_daily_limit_usd,
            cost_usd=cost,
            window_seconds=86400.0,
            record=True,
            budget_name="IP daily",
            entry_id=entry_id,
        )

        _logger.info(
            "circuit_breaker.spend_recorded",
            ip=clean_ip,
            model=model,
            prompt_tokens=in_tok,
            completion_tokens=out_tok,
            cost_usd=cost,
        )
        return cost

    async def async_record_spend(
        self,
        client_ip: str,
        model: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
    ) -> float:
        """Async variant of record_spend."""
        return await self.record_spend_async(
            client_ip=client_ip,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

    async def record_spend_async(
        self,
        client_ip: str,
        model: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
    ) -> float:
        """Async variant of record_spend."""
        in_tok = input_tokens if input_tokens is not None else prompt_tokens
        out_tok = output_tokens if output_tokens is not None else completion_tokens
        cost = self.calculate_actual_cost(model, input_tokens=in_tok, output_tokens=out_tok)
        if not self.enabled or cost <= 0:
            return cost

        clean_ip = self._clean_ip(client_ip)
        redis_client = self._get_async_client()
        entry_id = uuid.uuid4().hex[:12]

        await self._eval_async(
            redis_client,
            key=f"{self.key_prefix}global_daily",
            limit_usd=self.daily_limit_usd,
            cost_usd=cost,
            window_seconds=86400.0,
            record=True,
            budget_name="Global daily",
            entry_id=entry_id,
        )
        await self._eval_async(
            redis_client,
            key=f"{self.key_prefix}global_hourly",
            limit_usd=self.hourly_limit_usd,
            cost_usd=cost,
            window_seconds=3600.0,
            record=True,
            budget_name="Global hourly",
            entry_id=entry_id,
        )
        await self._eval_async(
            redis_client,
            key=f"{self.key_prefix}ip_daily:{clean_ip}",
            limit_usd=self.ip_daily_limit_usd,
            cost_usd=cost,
            window_seconds=86400.0,
            record=True,
            budget_name="IP daily",
            entry_id=entry_id,
        )

        _logger.info(
            "circuit_breaker.spend_recorded_async",
            ip=clean_ip,
            model=model,
            prompt_tokens=in_tok,
            completion_tokens=out_tok,
            cost_usd=cost,
        )
        return cost

    def _eval_sync(
        self,
        redis_client: Any | None,
        key: str,
        limit_usd: float,
        cost_usd: float,
        window_seconds: float,
        record: bool,
        budget_name: str,
        entry_id: str | None = None,
    ) -> tuple[bool, str | None, float]:
        if redis_client is not None:
            try:
                now_ms = int(time.time() * 1000)
                window_ms = int(window_seconds * 1000)
                eid = entry_id or uuid.uuid4().hex[:12]

                res = redis_client.eval(
                    LUA_BUDGET_SCRIPT,
                    1,
                    key,
                    now_ms,
                    window_ms,
                    limit_usd,
                    cost_usd,
                    1 if record else 0,
                    eid,
                )
                allowed = bool(res[0] == 1)
                retry_after = float(res[2])
                if not allowed:
                    reason = f"{budget_name} exhausted. Limit: ${limit_usd:.2f}."
                    return False, reason, retry_after
                return True, None, 0.0
            except Exception as exc:
                _logger.warning("circuit_breaker.redis_eval_failed_fallback", error=str(exc), key=key)

        allowed, current_spend, retry_after = self._fallback.check_and_record(
            key=key,
            limit_usd=limit_usd,
            cost_usd=cost_usd,
            window_seconds=window_seconds,
            record=record,
        )
        if not allowed:
            reason = f"{budget_name} exhausted (${current_spend:.4f}/${limit_usd:.2f})."
            return False, reason, retry_after
        return True, None, 0.0

    async def _eval_async(
        self,
        redis_client: Any | None,
        key: str,
        limit_usd: float,
        cost_usd: float,
        window_seconds: float,
        record: bool,
        budget_name: str,
        entry_id: str | None = None,
    ) -> tuple[bool, str | None, float]:
        if redis_client is not None:
            try:
                now_ms = int(time.time() * 1000)
                window_ms = int(window_seconds * 1000)
                eid = entry_id or uuid.uuid4().hex[:12]

                res = await redis_client.eval(
                    LUA_BUDGET_SCRIPT,
                    1,
                    key,
                    now_ms,
                    window_ms,
                    limit_usd,
                    cost_usd,
                    1 if record else 0,
                    eid,
                )
                allowed = bool(res[0] == 1)
                retry_after = float(res[2])
                if not allowed:
                    reason = f"{budget_name} exhausted. Limit: ${limit_usd:.2f}."
                    return False, reason, retry_after
                return True, None, 0.0
            except Exception as exc:
                _logger.warning("circuit_breaker.async_redis_eval_failed_fallback", error=str(exc), key=key)

        allowed, current_spend, retry_after = self._fallback.check_and_record(
            key=key,
            limit_usd=limit_usd,
            cost_usd=cost_usd,
            window_seconds=window_seconds,
            record=record,
        )
        if not allowed:
            reason = f"{budget_name} exhausted (${current_spend:.4f}/${limit_usd:.2f})."
            return False, reason, retry_after
        return True, None, 0.0

    def get_spend_stats(self, client_ip: str | None = None) -> dict[str, Any]:
        """Return spend statistics for inspection and monitoring."""
        clean_ip = self._clean_ip(client_ip) if client_ip else "127.0.0.1"
        return {
            "enabled": self.enabled,
            "limits": {
                "daily_limit_usd": self.daily_limit_usd,
                "hourly_limit_usd": self.hourly_limit_usd,
                "ip_daily_limit_usd": self.ip_daily_limit_usd,
            },
            "current_spend_estimate": {
                "global_daily": round(self._fallback.get_current_spend(f"{self.key_prefix}global_daily", 86400.0), 4),
                "global_hourly": round(self._fallback.get_current_spend(f"{self.key_prefix}global_hourly", 3600.0), 4),
                "client_ip_daily": round(self._fallback.get_current_spend(f"{self.key_prefix}ip_daily:{clean_ip}", 86400.0), 4),
            },
        }

    def reset(self) -> None:
        """Reset in-memory and Redis tracking (for testing)."""
        self._fallback.reset()
        sync_client = self._get_sync_client()
        if sync_client is not None:
            try:
                keys = sync_client.keys(f"{self.key_prefix}*")
                if keys:
                    sync_client.delete(*keys)
            except Exception:
                pass
