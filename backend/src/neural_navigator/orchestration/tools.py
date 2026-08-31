"""Tool abstractions for observable research / evidence gathering.

API keys come only from Settings / environment — never hardcoded.
"""

from __future__ import annotations

import ast
import operator
import re
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any
from urllib.parse import quote_plus

import httpx
import structlog

if TYPE_CHECKING:
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


def _finish(
    tool: str, started: float, *, status: str, summary: str, data: dict[str, Any] | None = None
) -> ToolResult:
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
    except Exception as exc:
        return _finish("calculator", started, status="error", summary=f"Calculator failed: {exc}")


async def run_web_search(query: str, *, max_results: int = 5) -> ToolResult:
    """DuckDuckGo web search using duckduckgo-search package."""
    started = time.perf_counter() * 1000
    try:
        from duckduckgo_search import DDGS
        import asyncio
        
        def _sync_search() -> list[dict[str, str]]:
            with DDGS() as ddgs:
                results = ddgs.text(query, max_results=max_results)
                return list(results) if results else []
                
        # Run synchronous DDGS in thread pool
        raw_results = await asyncio.to_thread(_sync_search)
        
        snippets: list[dict[str, str]] = []
        for r in raw_results:
            snippets.append(
                {
                    "title": str(r.get("title") or "Search Result")[:80],
                    "snippet": str(r.get("body") or "")[:400],
                    "url": str(r.get("href") or ""),
                    "domain": "web",
                    "authority": 0.85,
                }
            )
            
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
            summary=f"Retrieved {len(snippets)} source(s) for '{query[:60]}'",
            data={"query": query, "results": snippets},
        )
    except Exception as exc:
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
    except Exception as exc:
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
            data={
                "city": city,
                "payload": {"temp": main.get("temp"), "desc": weather.get("description")},
            },
        )
    except Exception as exc:
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
    if not re.fullmatch(r"[\d\s\.\+\-\*/%\(\)]+", expr.replace("**", "*")) and not re.search(
        r"\d", expr
    ):
        return None
    return expr


def detect_weather_city(text: str) -> str | None:
    match = _WEATHER_RE.search(text)
    if not match:
        return None
    return match.group(1).strip()
