"""Prometheus metrics instrumentation.

Defines standard SLI metrics for HTTP requests, WebSocket connections,
LLM token usage, tool execution latency, and Explainable Grounding Index (EGI) distributions.
"""

from __future__ import annotations

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    REGISTRY,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

# --- HTTP Request Metrics ----------------------------------------------------
HTTP_REQUESTS_TOTAL = Counter(
    "xplainai_http_requests_total",
    "Total count of HTTP requests handled by the API.",
    ["method", "path", "status"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "xplainai_http_request_duration_seconds",
    "HTTP request latency distribution in seconds.",
    ["method", "path"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0),
)

# --- WebSocket Metrics -------------------------------------------------------
WS_ACTIVE_CONNECTIONS = Gauge(
    "xplainai_ws_active_connections",
    "Number of currently active WebSocket connections.",
)

WS_MESSAGES_TOTAL = Counter(
    "xplainai_ws_messages_total",
    "Total number of WebSocket frames transferred.",
    ["message_type", "direction"],  # direction: "inbound" | "outbound"
)

# --- LLM & AI Metrics --------------------------------------------------------
LLM_TOKENS_TOTAL = Counter(
    "xplainai_llm_tokens_total",
    "Total number of LLM tokens consumed.",
    ["provider", "model", "usage_type"],  # usage_type: "prompt" | "completion"
)

LLM_REQUEST_DURATION_SECONDS = Histogram(
    "xplainai_llm_request_duration_seconds",
    "LLM API request latency in seconds.",
    ["provider", "model"],
    buckets=(0.1, 0.25, 0.5, 1.0, 2.0, 3.0, 5.0, 10.0, 20.0, 30.0, 60.0),
)

# --- Agent & Tool Execution Metrics ------------------------------------------
TOOL_EXECUTION_DURATION_SECONDS = Histogram(
    "xplainai_tool_execution_duration_seconds",
    "Agent tool execution duration in seconds.",
    ["tool", "status"],  # status: "success" | "error" | "cache_hit"
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0),
)

GRAPH_NODES_COUNT = Histogram(
    "xplainai_graph_nodes_count",
    "Distribution of node counts generated in explainability graphs.",
    buckets=(1, 2, 5, 10, 15, 20, 30, 50, 100),
)

EGI_SCORE = Histogram(
    "xplainai_egi_score",
    "Distribution of Explainable Grounding Index (EGI) scores.",
    buckets=(0.0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0),
)


def record_http_request(method: str, path: str, status_code: int, duration_seconds: float) -> None:
    """Record an HTTP request count and latency."""
    normalized_path = _normalize_path(path)
    HTTP_REQUESTS_TOTAL.labels(
        method=method.upper(),
        path=normalized_path,
        status=str(status_code),
    ).inc()
    HTTP_REQUEST_DURATION_SECONDS.labels(
        method=method.upper(),
        path=normalized_path,
    ).observe(duration_seconds)


def record_ws_connect() -> None:
    """Increment active WebSocket gauge."""
    WS_ACTIVE_CONNECTIONS.inc()


def record_ws_disconnect() -> None:
    """Decrement active WebSocket gauge."""
    WS_ACTIVE_CONNECTIONS.dec()


def record_ws_message(message_type: str, direction: str = "inbound") -> None:
    """Record a WebSocket message event."""
    WS_MESSAGES_TOTAL.labels(message_type=message_type, direction=direction).inc()


def record_llm_tokens(
    provider: str, model: str, prompt_tokens: int, completion_tokens: int
) -> None:
    """Record token counts for prompt and completion."""
    if prompt_tokens > 0:
        LLM_TOKENS_TOTAL.labels(provider=provider, model=model, usage_type="prompt").inc(
            prompt_tokens
        )
    if completion_tokens > 0:
        LLM_TOKENS_TOTAL.labels(provider=provider, model=model, usage_type="completion").inc(
            completion_tokens
        )


def record_llm_duration(provider: str, model: str, duration_seconds: float) -> None:
    """Record LLM generation latency."""
    LLM_REQUEST_DURATION_SECONDS.labels(provider=provider, model=model).observe(duration_seconds)


def record_tool_execution(tool: str, status: str, duration_seconds: float) -> None:
    """Record agent tool execution latency and status."""
    TOOL_EXECUTION_DURATION_SECONDS.labels(tool=tool, status=status).observe(duration_seconds)


def record_graph_metrics(nodes_count: int, egi_score: float | None = None) -> None:
    """Record graph node count and EGI score distribution."""
    GRAPH_NODES_COUNT.observe(nodes_count)
    if egi_score is not None:
        EGI_SCORE.observe(max(0.0, min(1.0, float(egi_score))))


def get_metrics_payload() -> tuple[bytes, str]:
    """Generate Prometheus scrape format output with content-type."""
    return generate_latest(REGISTRY), CONTENT_TYPE_LATEST


def _normalize_path(path: str) -> str:
    """Normalize REST endpoints with variable path parameters."""
    if not path:
        return "/"
    parts = path.strip("/").split("/")
    normalized: list[str] = []
    for part in parts:
        is_hex = len(part) in (32, 36) and all(c in "0123456789abcdefABCDEF-" for c in part)
        if is_hex or part.isdigit():
            normalized.append(":id")
        else:
            normalized.append(part)
    return "/" + "/".join(normalized)
