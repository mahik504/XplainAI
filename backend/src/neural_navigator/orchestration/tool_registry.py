"""Hardened Tool Registry with Schema Validation and Multi-Source Research Tools.

All retrieved external content is treated as untrusted data inputs and sanitized.
"""

from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
import time
import urllib.parse
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any
from urllib.parse import quote, quote_plus

import httpx
import structlog

from neural_navigator.orchestration.tools import ToolResult, _safe_eval_arith

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from neural_navigator.core.config import Settings

_logger = structlog.get_logger("neural_navigator.orchestration.tool_registry")

# Untrusted content sanitization patterns
_PROMPT_INJECTION_RE = re.compile(
    r"(?i)\b(ignore\s+(all\s+)?previous\s+instructions|system\s+prompt|you\s+are\s+now|new\s+instruction)\b"
)
_HTML_TAG_RE = re.compile(r"<[^>]+>")

_BLOCKED_HOSTNAMES: frozenset[str] = frozenset({
    "localhost",
    "127.0.0.1",
    "0.0.0.0",  # noqa: S104
    "::1",
    "instance-data",
    "metadata.google.internal",
    "metadata",
    "169.254.169.254",
    "169.254.170.2",
})

_PRIVATE_SUBNETS: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("::1/128"),
]


def _is_disallowed_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        return True
    return any(ip in subnet for subnet in _PRIVATE_SUBNETS)


def is_safe_external_url(url: str) -> bool:
    """Verifies that an outbound URL does not target localhost, private subnets, or metadata."""
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False
        hostname_clean = hostname.strip().lower()
        if not hostname_clean or hostname_clean in _BLOCKED_HOSTNAMES:
            return False
        if hostname_clean.endswith((".localhost", ".local", ".internal", ".lan")):
            return False

        # Direct IP check
        try:
            ip = ipaddress.ip_address(hostname_clean)
            return not _is_disallowed_ip(ip)
        except ValueError:
            pass

        # DNS re-resolution check to prevent DNS rebinding attacks
        try:
            addr_info = socket.getaddrinfo(hostname_clean, None, proto=socket.IPPROTO_TCP)
            if not addr_info:
                return False
            for entry in addr_info:
                sockaddr = entry[4]
                ip_str = str(sockaddr[0])
                resolved_ip = ipaddress.ip_address(ip_str)
                if _is_disallowed_ip(resolved_ip):
                    return False
        except (TimeoutError, socket.gaierror, OSError):
            return False

        return True
    except Exception:
        return False


def sanitize_untrusted_content(text: str, max_chars: int = 2000) -> str:
    """Sanitizes external web content to prevent prompt injections and format breaks."""
    cleaned = _HTML_TAG_RE.sub(" ", text)
    cleaned = _PROMPT_INJECTION_RE.sub("[SANITIZED_INSTRUCTION]", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:max_chars]


@dataclass(slots=True)
class ToolDefinition:
    name: str
    description: str
    parameters_schema: dict[str, Any]
    handler: Callable[..., Awaitable[ToolResult]]
    timeout_seconds: float = 10.0
    auth_required: bool = False
    rate_limit_per_min: int = 60


class ToolRegistry:
    """Explicit registry of verified research tools."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._tools: dict[str, ToolDefinition] = {}
        self._register_default_tools()

    def register(self, tool: ToolDefinition) -> None:
        self._tools[tool.name] = tool
        _logger.info("tool_registry.registered", tool=tool.name)

    def get(self, name: str) -> ToolDefinition | None:
        return self._tools.get(name)

    def list_tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters_schema,
                "auth_required": t.auth_required,
            }
            for t in self._tools.values()
        ]

    async def execute(self, name: str, **kwargs: Any) -> ToolResult:
        tool = self.get(name)
        started = time.perf_counter() * 1000
        if not tool:
            completed = time.perf_counter() * 1000
            return ToolResult(
                tool=name,
                status="error",
                started_ms=started,
                completed_ms=completed,
                duration_ms=round(completed - started, 2),
                summary=f"Tool '{name}' not found in registry",
                data={"error": "not_found"},
            )
        try:
            return await asyncio.wait_for(tool.handler(**kwargs), timeout=tool.timeout_seconds)
        except TimeoutError:
            completed = time.perf_counter() * 1000
            _logger.warning("tool.timeout", tool=name)
            return ToolResult(
                tool=name,
                status="error",
                started_ms=started,
                completed_ms=completed,
                duration_ms=round(completed - started, 2),
                summary=f"Tool '{name}' timed out after {tool.timeout_seconds}s",
                data={"error": "timeout"},
            )
        except Exception as exc:
            completed = time.perf_counter() * 1000
            _logger.error("tool.error", tool=name, error=str(exc))
            return ToolResult(
                tool=name,
                status="error",
                started_ms=started,
                completed_ms=completed,
                duration_ms=round(completed - started, 2),
                summary=f"Tool '{name}' failed: {exc}",
                data={"error": str(exc)},
            )

    def _register_default_tools(self) -> None:
        self.register(
            ToolDefinition(
                name="web_search",
                description=(
                    "Performs multi-source research using Wikipedia, open web, and databases."
                ),
                parameters_schema={
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                    "required": ["query"],
                },
                handler=self._handle_web_search,
                timeout_seconds=12.0,
            )
        )
        self.register(
            ToolDefinition(
                name="wikipedia",
                description="Fetches verified encyclopedia entries and structured summaries.",
                parameters_schema={
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                    "required": ["query"],
                },
                handler=self._handle_wikipedia,
                timeout_seconds=8.0,
            )
        )
        self.register(
            ToolDefinition(
                name="arxiv",
                description="Searches ArXiv for scientific preprints and peer-reviewed abstracts.",
                parameters_schema={
                    "type": "object",
                    "properties": {"query": {"type": "string"}},
                    "required": ["query"],
                },
                handler=self._handle_arxiv,
                timeout_seconds=10.0,
            )
        )
        self.register(
            ToolDefinition(
                name="calculator",
                description="Safely computes exact arithmetic and mathematical expressions.",
                parameters_schema={
                    "type": "object",
                    "properties": {"expression": {"type": "string"}},
                    "required": ["expression"],
                },
                handler=self._handle_calculator,
                timeout_seconds=2.0,
            )
        )
        self.register(
            ToolDefinition(
                name="url_ingest",
                description=(
                    "Ingests and scrapes web pages, GitHub repositories, and YouTube metadata."
                ),
                parameters_schema={
                    "type": "object",
                    "properties": {"url": {"type": "string"}},
                    "required": ["url"],
                },
                handler=self._handle_url_ingest,
                timeout_seconds=10.0,
            )
        )

    async def _handle_url_ingest(self, url: str = "") -> ToolResult:
        from neural_navigator.orchestration.url_ingest import fetch_and_parse_url

        return await fetch_and_parse_url(url)

    async def _handle_calculator(self, expression: str = "") -> ToolResult:
        started = time.perf_counter() * 1000
        cleaned = expression.strip()
        if not cleaned:
            return ToolResult(
                tool="calculator",
                status="error",
                started_ms=started,
                completed_ms=started,
                duration_ms=0,
                summary="Empty expression",
                data={},
            )
        try:
            val = _safe_eval_arith(cleaned)
            completed = time.perf_counter() * 1000
            return ToolResult(
                tool="calculator",
                status="ok",
                started_ms=started,
                completed_ms=completed,
                duration_ms=round(completed - started, 2),
                summary=f"{cleaned} = {val}",
                data={"expression": cleaned, "result": val},
            )
        except Exception as exc:
            completed = time.perf_counter() * 1000
            return ToolResult(
                tool="calculator",
                status="error",
                started_ms=started,
                completed_ms=completed,
                duration_ms=round(completed - started, 2),
                summary=f"Math evaluation failed: {exc}",
                data={"error": str(exc)},
            )

    async def _handle_wikipedia(self, query: str = "") -> ToolResult:
        started = time.perf_counter() * 1000
        cleaned = query.strip()
        url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={quote_plus(cleaned)}&format=json&utf8=1&srlimit=4"
        try:
            async with httpx.AsyncClient(
                timeout=8.0, headers={"User-Agent": "XplainAI-Research/2.2"}
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
            search_items = data.get("query", {}).get("search", [])
            results = []
            for item in search_items:
                title = str(item.get("title") or "")
                raw_snippet = str(item.get("snippet") or "")
                snippet = sanitize_untrusted_content(raw_snippet)
                page_id = item.get("pageid")
                page_url = (
                    f"https://en.wikipedia.org/?curid={page_id}"
                    if page_id
                    else f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"
                )
                results.append(
                    {
                        "title": f"Wikipedia: {title}",
                        "snippet": snippet,
                        "url": page_url,
                        "domain": "en.wikipedia.org",
                        "authority": 0.92,
                    }
                )
            completed = time.perf_counter() * 1000
            return ToolResult(
                tool="wikipedia",
                status="ok",
                started_ms=started,
                completed_ms=completed,
                duration_ms=round(completed - started, 2),
                summary=f"Retrieved {len(results)} Wikipedia reference(s) for '{cleaned[:40]}'",
                data={"query": cleaned, "results": results},
            )
        except Exception as exc:
            completed = time.perf_counter() * 1000
            return ToolResult(
                tool="wikipedia",
                status="error",
                started_ms=started,
                completed_ms=completed,
                duration_ms=round(completed - started, 2),
                summary="Wikipedia retrieval unavailable",
                data={"error": str(exc)},
            )

    async def _handle_arxiv(self, query: str = "") -> ToolResult:
        started = time.perf_counter() * 1000
        cleaned = query.strip()
        url = f"http://export.arxiv.org/api/query?search_query=all:{quote_plus(cleaned)}&start=0&max_results=3"
        try:
            async with httpx.AsyncClient(
                timeout=10.0, headers={"User-Agent": "XplainAI-Research/2.2"}
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                xml_text = resp.text
            # Lightweight XML extraction for ArXiv entries
            entries = xml_text.split("<entry>")
            results = []
            for entry in entries[1:]:
                title_match = re.search(r"<title>(.*?)</title>", entry, re.DOTALL)
                summary_match = re.search(r"<summary>(.*?)</summary>", entry, re.DOTALL)
                id_match = re.search(r"<id>(.*?)</id>", entry)
                if title_match and summary_match:
                    t = sanitize_untrusted_content(title_match.group(1).strip())
                    s = sanitize_untrusted_content(summary_match.group(1).strip(), max_chars=350)
                    u = id_match.group(1).strip() if id_match else "https://arxiv.org"
                    results.append(
                        {
                            "title": f"ArXiv Paper: {t}",
                            "snippet": s,
                            "url": u,
                            "domain": "arxiv.org",
                            "authority": 0.95,
                        }
                    )
            completed = time.perf_counter() * 1000
            return ToolResult(
                tool="arxiv",
                status="ok",
                started_ms=started,
                completed_ms=completed,
                duration_ms=round(completed - started, 2),
                summary=f"Found {len(results)} academic paper(s) on ArXiv",
                data={"query": cleaned, "results": results},
            )
        except Exception as exc:
            completed = time.perf_counter() * 1000
            return ToolResult(
                tool="arxiv",
                status="error",
                started_ms=started,
                completed_ms=completed,
                duration_ms=round(completed - started, 2),
                summary="ArXiv paper search unavailable",
                data={"error": str(exc)},
            )

    async def _handle_web_search(self, query: str = "", max_results: int = 4) -> ToolResult:
        """Unified multi-source search querying Wikipedia + DuckDuckGo in parallel."""
        started = time.perf_counter() * 1000
        cleaned = query.strip()

        # Parallel query across Wikipedia and DuckDuckGo
        wiki_res, ddg_res = await asyncio.gather(
            self._handle_wikipedia(cleaned),
            self._fetch_ddg_sources(cleaned, max_results=max_results),
            return_exceptions=True,
        )

        combined_results: list[dict[str, Any]] = []
        if isinstance(wiki_res, ToolResult) and wiki_res.status == "ok":
            combined_results.extend(wiki_res.data.get("results", []))
        if isinstance(ddg_res, list):
            combined_results.extend(ddg_res)

        # Deduplicate results by URL
        seen_urls = set()
        deduped = []
        for row in combined_results:
            u = row.get("url", "")
            if u and u not in seen_urls:
                seen_urls.add(u)
                deduped.append(row)

        completed = time.perf_counter() * 1000
        return ToolResult(
            tool="web_search",
            status="ok" if deduped else "skipped",
            started_ms=started,
            completed_ms=completed,
            duration_ms=round(completed - started, 2),
            summary=f"Retrieved {len(deduped)} grounded source(s) for ?{cleaned[:50]}?",
            data={"query": cleaned, "results": deduped[: max_results + 2]},
        )

    async def _fetch_ddg_sources(self, query: str, max_results: int = 3) -> list[dict[str, Any]]:
        url = f"https://api.duckduckgo.com/?q={quote_plus(query)}&format=json&no_html=1&skip_disambig=1"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    return []
                payload = resp.json()
            abstract = sanitize_untrusted_content(str(payload.get("AbstractText") or ""))
            heading = str(payload.get("Heading") or "Web Summary")
            abstract_url = str(payload.get("AbstractURL") or "")
            results = []
            if abstract and abstract_url:
                results.append(
                    {
                        "title": heading,
                        "snippet": abstract,
                        "url": abstract_url,
                        "domain": "duckduckgo.com",
                        "authority": 0.8,
                    }
                )
            return results
        except Exception:
            return []
