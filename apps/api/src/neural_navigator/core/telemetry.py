"""OpenTelemetry distributed tracing setup and instrumentation.

Provides TracerProvider configuration, OTLP SpanExporter integration,
FastAPI automatic request instrumentation, W3C TraceContext propagation,
and span context extractors for structlog correlation.
"""

from __future__ import annotations

from contextlib import asynccontextmanager, contextmanager
from typing import TYPE_CHECKING, Any

import structlog
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
    OTLPSpanExporter as OTLPGrpcSpanExporter,
)
from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
    OTLPSpanExporter as OTLPHttpSpanExporter,
)
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import (
    SERVICE_NAME as RESOURCE_SERVICE_NAME,
)
from opentelemetry.sdk.resources import (
    SERVICE_VERSION as RESOURCE_SERVICE_VERSION,
)
from opentelemetry.sdk.resources import (
    Resource,
)
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter, SpanExporter
from opentelemetry.trace import Span, StatusCode, Tracer
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Iterator, Mapping, MutableMapping

    from fastapi import FastAPI

    from neural_navigator.core.config import Settings

_logger = structlog.stdlib.get_logger(__name__)
_propagator = TraceContextTextMapPropagator()
_initialized = False


def init_telemetry(app: FastAPI, settings: Settings) -> TracerProvider:
    """Initialize OpenTelemetry TracerProvider and instrument FastAPI application.

    Idempotent: safe to call multiple times without creating duplicate providers.
    """
    global _initialized
    if _initialized:
        current = trace.get_tracer_provider()
        if isinstance(current, TracerProvider):
            return current

    resource = Resource.create(
        {
            RESOURCE_SERVICE_NAME: settings.otel_service_name,
            RESOURCE_SERVICE_VERSION: settings.version,
            "deployment.environment": settings.app_env.value,
        }
    )

    provider = TracerProvider(resource=resource)

    # Configure OTLP exporter if endpoint is set
    endpoint = settings.otel_exporter_otlp_endpoint
    if endpoint and endpoint.strip():
        endpoint_clean = endpoint.strip()
        try:
            exporter: SpanExporter
            if endpoint_clean.startswith("http://") or endpoint_clean.startswith("https://"):
                if ":4318" in endpoint_clean or endpoint_clean.endswith("/v1/traces"):
                    exporter = OTLPHttpSpanExporter(endpoint=endpoint_clean)
                else:
                    # gRPC endpoint with http:// scheme prefix
                    insecure = endpoint_clean.startswith("http://")
                    target = endpoint_clean.split("://", 1)[1]
                    exporter = OTLPGrpcSpanExporter(endpoint=target, insecure=insecure)
            else:
                # Default gRPC endpoint host:port
                exporter = OTLPGrpcSpanExporter(endpoint=endpoint_clean, insecure=True)

            provider.add_span_processor(BatchSpanProcessor(exporter))
            _logger.info("telemetry.otlp_exporter_configured", endpoint=endpoint_clean)
        except Exception as exc:
            _logger.warning("telemetry.otlp_init_failed", error=str(exc))
    elif not settings.app_env.is_deployed and settings.log_level == "DEBUG":
        # In local debug mode without OTLP collector, attach console exporter if DEBUG
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    trace.set_tracer_provider(provider)

    # Instrument FastAPI application, excluding health and metrics endpoints
    FastAPIInstrumentor.instrument_app(
        app,
        tracer_provider=provider,
        excluded_urls="health/live,health/ready,metrics",
    )

    _initialized = True
    _logger.info(
        "telemetry.initialized",
        service=settings.otel_service_name,
        endpoint=endpoint or "disabled",
    )
    return provider


def get_tracer(name: str = "neural_navigator") -> Tracer:
    """Return a named tracer instance."""
    return trace.get_tracer(name)


def get_current_trace_id() -> str | None:
    """Return the current 32-character hex trace ID or None if no active span."""
    span = trace.get_current_span()
    ctx = span.get_span_context()
    if ctx.is_valid:
        return f"{ctx.trace_id:032x}"
    return None


def get_current_span_id() -> str | None:
    """Return the current 16-character hex span ID or None if no active span."""
    span = trace.get_current_span()
    ctx = span.get_span_context()
    if ctx.is_valid:
        return f"{ctx.span_id:016x}"
    return None


def get_trace_correlation_context() -> dict[str, str]:
    """Return trace_id and span_id dict for log context binding."""
    trace_id = get_current_trace_id()
    span_id = get_current_span_id()
    context: dict[str, str] = {}
    if trace_id:
        context["trace_id"] = trace_id
    if span_id:
        context["span_id"] = span_id
    return context


def inject_trace_context(carrier: MutableMapping[str, str]) -> None:
    """Inject current trace context into an outbound dictionary / HTTP headers."""
    _propagator.inject(carrier)


def extract_trace_context(carrier: Mapping[str, str]) -> Any:
    """Extract trace context from an inbound dictionary / HTTP headers."""
    return _propagator.extract(carrier)


@contextmanager
def trace_span(
    name: str,
    attributes: dict[str, Any] | None = None,
    tracer_name: str = "neural_navigator",
) -> Iterator[Span]:
    """Synchronous context manager creating an active trace span."""
    tracer = get_tracer(tracer_name)
    with tracer.start_as_current_span(name) as span:
        if attributes:
            for key, val in attributes.items():
                if val is not None:
                    attr_val = val if isinstance(val, (bool, int, float, str)) else str(val)
                    span.set_attribute(key, attr_val)
        try:
            yield span
        except Exception as exc:
            span.record_exception(exc)
            span.set_status(StatusCode.ERROR, str(exc))
            raise


@asynccontextmanager
async def async_trace_span(
    name: str,
    attributes: dict[str, Any] | None = None,
    tracer_name: str = "neural_navigator",
) -> AsyncIterator[Span]:
    """Asynchronous context manager creating an active trace span."""
    tracer = get_tracer(tracer_name)
    with tracer.start_as_current_span(name) as span:
        if attributes:
            for key, val in attributes.items():
                if val is not None:
                    attr_val = val if isinstance(val, (bool, int, float, str)) else str(val)
                    span.set_attribute(key, attr_val)
        try:
            yield span
        except Exception as exc:
            span.record_exception(exc)
            span.set_status(StatusCode.ERROR, str(exc))
            raise
