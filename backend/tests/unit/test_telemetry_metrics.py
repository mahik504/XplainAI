"""Unit tests for OpenTelemetry distributed tracing and Prometheus metrics."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from neural_navigator.core.config import Settings
from neural_navigator.core.metrics import (
    get_metrics_payload,
    record_graph_metrics,
    record_http_request,
    record_llm_duration,
    record_llm_tokens,
    record_tool_execution,
    record_ws_connect,
    record_ws_disconnect,
    record_ws_message,
)
from neural_navigator.core.telemetry import (
    async_trace_span,
    extract_trace_context,
    get_current_span_id,
    get_current_trace_id,
    get_trace_correlation_context,
    get_tracer,
    init_telemetry,
    inject_trace_context,
    trace_span,
)
from neural_navigator.main import create_app


def test_telemetry_tracer_and_spans() -> None:
    settings = Settings(otel_service_name="test-service")
    app = create_app(settings)
    provider = init_telemetry(app, settings)
    assert provider is not None

    tracer = get_tracer("test_tracer")
    assert tracer is not None

    with trace_span("test_span", {"custom.key": "val123", "numeric.val": 42}) as span:
        assert span is not None
        trace_id = get_current_trace_id()
        span_id = get_current_span_id()
        assert trace_id is not None
        assert span_id is not None
        assert len(trace_id) == 32
        assert len(span_id) == 16

        ctx = get_trace_correlation_context()
        assert ctx.get("trace_id") == trace_id
        assert ctx.get("span_id") == span_id

        carrier: dict[str, str] = {}
        inject_trace_context(carrier)
        assert "traceparent" in carrier

        extracted = extract_trace_context(carrier)
        assert extracted is not None


@pytest.mark.asyncio
async def test_async_trace_span() -> None:
    async with async_trace_span("async_test_span", {"async.key": "test"}) as span:
        assert span is not None
        assert get_current_trace_id() is not None


def test_prometheus_metrics_recording() -> None:
    # 1. HTTP Metrics
    record_http_request(
        method="GET",
        path="/api/v1/conversations/123",
        status_code=200,
        duration_seconds=0.045,
    )
    record_http_request(
        method="POST",
        path="/api/v1/chat/completions",
        status_code=200,
        duration_seconds=0.25,
    )

    # 2. WebSocket Metrics
    record_ws_connect()
    record_ws_message(message_type="chat.send", direction="inbound")
    record_ws_message(message_type="stream.chunk", direction="outbound")
    record_ws_disconnect()

    # 3. LLM Metrics
    record_llm_tokens(
        provider="openai",
        model="gpt-4o-mini",
        prompt_tokens=150,
        completion_tokens=85,
    )
    record_llm_duration(
        provider="openai",
        model="gpt-4o-mini",
        duration_seconds=1.23,
    )

    # 4. Tool & Graph Metrics
    record_tool_execution(tool="arxiv_search", status="success", duration_seconds=0.45)
    record_graph_metrics(nodes_count=8, egi_score=0.89)

    # 5. Payload Generation
    payload, _ = get_metrics_payload()
    assert isinstance(payload, bytes)
    assert len(payload) > 0
    text = payload.decode("utf-8")
    assert "xplainai_http_requests_total" in text
    assert "xplainai_ws_active_connections" in text
    assert "xplainai_llm_tokens_total" in text
    assert "xplainai_tool_execution_duration_seconds" in text
    assert "xplainai_egi_score" in text


def test_metrics_endpoint_via_http_client() -> None:
    settings = Settings()
    app = create_app(settings)
    client = TestClient(app)

    # Call a regular health endpoint to generate traffic
    live_resp = client.get("/health/live")
    assert live_resp.status_code == 200

    # Query /metrics endpoint
    metrics_resp = client.get("/metrics")
    assert metrics_resp.status_code == 200
    assert "text/plain" in metrics_resp.headers.get("content-type", "")
    content = metrics_resp.text
    assert "xplainai_http_requests_total" in content
    assert 'path="/health/live"' in content
