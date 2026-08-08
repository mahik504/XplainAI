"""Tool abstractions for observable research / evidence gathering.

API keys come only from Settings / environment — never hardcoded.
"""

from __future__ import annotations

import ast
import operator
import re
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote_plus

import httpx
import structlog

from neural_navigator.core.config import Settings

_logger = structlog.get_logger("neural_navigator.orchestration.tools")

_SAFE_BINOPS: dict[type[ast.operator], Any] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
}


@dataclass(slots=True)
class ToolResult:
    tool: str
    status: str  # ok | error | skipped
    started_ms: float
    completed_ms: float
    duration_ms: float
    summary: str
    data: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "tool": self.tool,
            "status": self.status,
            "started_ms": self.started_ms,
            "completed_ms": self.completed_ms,
            "duration_ms": self.duration_ms,
            "summary": self.summary,
            "data": self.data,
        }


def _finish(tool: str, started: float, *, status: str, summary: str, data: dict[str, Any] | None = None) -> ToolResult:
    completed = time.perf_counter() * 1000
    return ToolResult(
        tool=tool,
        status=status,
        started_ms=started,
        completed_ms=completed,
        duration_ms=round(completed - started, 2),
        summary=summary,
        data=data or {},
    )


def _safe_eval_arith(expression: str) -> float:
    node = ast.parse(expression, mode="eval")

    def _eval(n: ast.AST) -> float:
        if isinstance(n, ast.Expression):
            return _eval(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return float(n.value)
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
            return -_eval(n.operand)
        if isinstance(n, ast.BinOp) and type(n.op) in _SAFE_BINOPS:
            return float(_SAFE_BINOPS[type(n.op)](_eval(n.left), _eval(n.right)))
        raise ValueError("unsupported expression")

    return _eval(node)


async def run_calculator(expression: str) -> ToolResult:
    started = time.perf_counter() * 1000
    cleaned = expression.strip()
    if not cleaned:
        return _finish("calculator", started, status="error", summary="Empty expression")
    try:
        value = _safe_eval_arith(cleaned)
        return _finish(
            "calculator",
            started,
            status="ok",
            summary=f"{cleaned} = {value}",
            data={"expression": cleaned, "result": value},
        )
    except Exception as exc:  # noqa: BLE001 — tool boundary
        return _finish("calculator", started, status="error", summary=f"Calculator failed: {exc}")


def _ddg_topic_rows(item: dict[str, Any], *, max_results: int, sink: list[dict[str, str]]) -> None:
    """Flatten DuckDuckGo RelatedTopics (including nested Topic groups)."""
    if len(sink) >= max_results:
        return
    topics = item.get("Topics")
    if isinstance(topics, list):
        for nested in topics:
            if isinstance(nested, dict):
                _ddg_topic_rows(nested, max_results=max_results, sink=sink)
            if len(sink) >= max_results:
                return
        return
    text = str(item.get("Text") or "").strip()
    if not text:
        return
    sink.append(
        {
            "title": text.split(" - ", 1)[0][:80],
            "snippet": text[:400],
            "url": str(item.get("FirstURL") or ""),
        }
    )


async def run_web_search(query: str, *, max_results: int = 5) -> ToolResult:
    """DuckDuckGo Instant Answer API — no API key required."""
    started = time.perf_counter() * 1000
    url = f"https://api.duckduckgo.com/?q={quote_plus(query)}&format=json&no_html=1&skip_disambig=1"
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            payload = response.json()
        abstract = str(payload.get("AbstractText") or "").strip()
        heading = str(payload.get("Heading") or "").strip()
        related = payload.get("RelatedTopics") or []
        snippets: list[dict[str, str]] = []
        if abstract:
            snippets.append(
                {
                    "title": heading or "Summary",
                    "snippet": abstract[:400],
                    "url": str(payload.get("AbstractURL") or ""),
                }
            )
        if isinstance(related, list):
            for item in related:
                if isinstance(item, dict):
                    _ddg_topic_rows(item, max_results=max_results, sink=snippets)
                if len(snippets) >= max_results:
                    break
        if not snippets:
            return _finish(
                "web_search",
                started,
                status="ok",
                summary="No usable source metadata returned by the research tool.",
                data={"query": query, "results": [], "empty_reason": "no_structured_results"},
            )
        return _finish(
            "web_search",
            started,
            status="ok",
            summary=f"Retrieved {len(snippets)} source(s) for “{query[:60]}”",
            data={"query": query, "results": snippets},
        )
    except Exception as exc:  # noqa: BLE001
        _logger.warning("tool.web_search.failed", error=str(exc))
        return _finish(
            "web_search",
            started,
            status="error",
            summary="Research source unavailable. Continuing with available evidence.",
            data={"query": query, "error": str(exc)},
        )


async def run_news(query: str, *, settings: Settings) -> ToolResult:
    started = time.perf_counter() * 1000
    key = settings.newsdata_api_key
    if key is None:
        return _finish(
            "news",
            started,
            status="skipped",
            summary="News tool skipped (NEWSDATA_API_KEY unset).",
        )
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(
                "https://newsdata.io/api/1/latest",
                params={"apikey": key.get_secret_value(), "q": query},
            )
            response.raise_for_status()
            payload = response.json()
        results = payload.get("results") or []
        items = []
        for row in results[:5]:
            if not isinstance(row, dict):
                continue
            items.append(
                {
                    "title": str(row.get("title") or "")[:120],
                    "snippet": str(row.get("description") or "")[:300],
                    "url": str(row.get("link") or ""),
                }
            )
        return _finish(
            "news",
            started,
            status="ok",
            summary=f"Retrieved {len(items)} news item(s)",
            data={"query": query, "results": items},
        )
    except Exception as exc:  # noqa: BLE001
        return _finish(
            "news",
            started,
            status="error",
            summary="Research source unavailable. Continuing with available evidence.",
            data={"error": str(exc)},
        )


async def run_weather(city: str, *, settings: Settings) -> ToolResult:
    started = time.perf_counter() * 1000
    key = settings.openweather_api_key
    if key is None:
        return _finish(
            "weather",
            started,
            status="skipped",
            summary="Weather tool skipped (OPENWEATHER_API_KEY unset).",
        )
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"q": city, "appid": key.get_secret_value(), "units": "metric"},
            )
            response.raise_for_status()
            payload = response.json()
        main = payload.get("main") or {}
        weather = (payload.get("weather") or [{}])[0]
        summary = (
            f"{payload.get('name', city)}: {weather.get('description', 'n/a')}, "
            f"{main.get('temp', '?')}°C"
        )
        return _finish(
            "weather",
            started,
            status="ok",
            summary=summary,
            data={"city": city, "payload": {"temp": main.get("temp"), "desc": weather.get("description")}},
        )
    except Exception as exc:  # noqa: BLE001
        return _finish(
            "weather",
            started,
            status="error",
            summary="Research source unavailable. Continuing with available evidence.",
            data={"error": str(exc)},
        )


_MATH_RE = re.compile(
    r"(?:what\s+is|calculate|compute)?\s*([-+]?\d[\d\s\.]*[\+\-\*/\^%][\d\s\.\+\-\*/\^%]+)",
    re.I,
)
_WEATHER_RE = re.compile(r"\bweather\b.*\bin\b\s+([A-Za-z][A-Za-z\s\-]{1,40})", re.I)


def detect_math_expression(text: str) -> str | None:
    match = _MATH_RE.search(text)
    if not match:
        return None
    expr = match.group(1).strip().replace("^", "**")
    if not re.fullmatch(r"[\d\s\.\+\-\*/%\(\)]+", expr.replace("**", "*")):
        # allow ** after replace check via simplified pattern
        if not re.search(r"\d", expr):
            return None
    return expr


def detect_weather_city(text: str) -> str | None:
    match = _WEATHER_RE.search(text)
    if not match:
        return None
    return match.group(1).strip()
