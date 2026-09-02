"""Unit tests for CostCircuitBreaker sliding window budget limits and token pricing."""

from __future__ import annotations

import pytest

from neural_navigator.services.circuit_breaker import CostCircuitBreaker


def test_pricing_calculation_and_estimation() -> None:
    breaker = CostCircuitBreaker()

    # gpt-4o-mini: $0.00015 / 1k in, $0.0006 / 1k out
    cost_mini = breaker.calculate_actual_cost("gpt-4o-mini", input_tokens=1000, output_tokens=1000)
    assert round(cost_mini, 6) == round(0.00015 + 0.0006, 6)

    # gpt-4o: $0.0025 / 1k in, $0.010 / 1k out
    cost_4o = breaker.calculate_actual_cost("gpt-4o", input_tokens=2000, output_tokens=1000)
    assert round(cost_4o, 6) == round(0.0050 + 0.010, 6)

    # estimate_cost
    est = breaker.estimate_cost("gpt-4o-mini", input_tokens=1000, output_tokens=2000)
    assert est > 0


def test_ip_daily_spend_limit_trip() -> None:
    breaker = CostCircuitBreaker(
        daily_limit_usd=10.0,
        hourly_limit_usd=2.0,
        ip_daily_limit_usd=0.10,
    )
    breaker.reset()

    ip = "192.168.1.100"
    allowed, reason, retry = breaker.check_budget(client_ip=ip, estimated_cost=0.05)
    assert allowed is True
    assert reason is None

    # Record $0.08 spend (under $0.10 limit)
    # Using default model pricing to record spend
    breaker.record_spend(client_ip=ip, model="gpt-4o", input_tokens=10000, output_tokens=5500)

    # Check stats
    stats = breaker.get_spend_stats(client_ip=ip)
    assert stats["current_spend_estimate"]["client_ip_daily"] > 0

    # Next check for $0.05 will exceed $0.10 limit
    allowed, reason, retry = breaker.check_budget(client_ip=ip, estimated_cost=0.05)
    assert allowed is False
    assert "exhausted" in reason.lower()
    assert retry > 0


def test_global_hourly_limit_trip() -> None:
    breaker = CostCircuitBreaker(
        daily_limit_usd=10.0,
        hourly_limit_usd=0.05,
        ip_daily_limit_usd=1.0,
    )
    breaker.reset()

    # First user
    allowed, _, _ = breaker.check_budget(client_ip="10.0.0.1", estimated_cost=0.01)
    assert allowed is True

    # Record spend that fills the hourly bucket
    breaker.record_spend(client_ip="10.0.0.1", model="gpt-4o", input_tokens=10000, output_tokens=3000)

    # Second user on a different IP should be blocked by the global hourly budget
    allowed, reason, retry = breaker.check_budget(client_ip="10.0.0.2", estimated_cost=0.02)
    assert allowed is False
    assert "hourly" in reason.lower()
    assert retry > 0


def test_global_daily_limit_trip() -> None:
    breaker = CostCircuitBreaker(
        daily_limit_usd=0.05,
        hourly_limit_usd=1.0,
        ip_daily_limit_usd=1.0,
    )
    breaker.reset()

    breaker.record_spend(client_ip="10.0.0.1", model="gpt-4o", input_tokens=10000, output_tokens=3000)

    allowed, reason, retry = breaker.check_budget(client_ip="10.0.0.2", estimated_cost=0.02)
    assert allowed is False
    assert "daily" in reason.lower()


@pytest.mark.asyncio
async def test_async_circuit_breaker_flow() -> None:
    breaker = CostCircuitBreaker(
        daily_limit_usd=10.0,
        hourly_limit_usd=2.0,
        ip_daily_limit_usd=0.05,
    )
    breaker.reset()

    ip = "172.16.0.5"
    allowed, reason, retry = await breaker.check_budget_async(client_ip=ip, estimated_cost=0.01)
    assert allowed is True

    cost = await breaker.record_spend_async(client_ip=ip, model="gpt-4o", input_tokens=10000, output_tokens=3000)
    assert cost > 0.04

    allowed, reason, retry = await breaker.check_budget_async(client_ip=ip, estimated_cost=0.02)
    assert allowed is False
    assert "exhausted" in reason.lower()


def test_circuit_breaker_disabled() -> None:
    breaker = CostCircuitBreaker(
        daily_limit_usd=0.01,
        enabled=False,
    )
    allowed, reason, retry = breaker.check_budget(client_ip="1.2.3.4", estimated_cost=100.0)
    assert allowed is True
    assert reason is None
    assert retry == 0.0
