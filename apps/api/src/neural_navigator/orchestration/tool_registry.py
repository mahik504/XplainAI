"""Hardened Tool Registry with RBAC Permissions and Multi-Source Research Tools.

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

from neural_navigator.core.security.permissions import ToolPermission
from neural_navigator.orchestration.tools import ToolResult, _safe_eval_arith

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from neural_navigator.core.config import Settings

_logger = structlog.get_logger("neural_navigator.orchestration.tool_registry")

_PROMPT_INJECTION_RE = re.compile(
    r"(?i)\b(ignore\s+(all\s+)?previous\s+instructions|system\s+prompt|you\s+are\s+now|new\s+instruction)\b"
)
_HTML_TAG_RE = re.compile(r"<[^>]+>")

_BLOCKED_HOSTNAMES: frozenset[str] = frozenset(
    {
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
        "instance-data",
        "metadata.google.internal",
        "metadata",
        "169.254.169.254",
        "169.254.170.2",
    }
)

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

        try:
            ip = ipaddress.ip_address(hostname_clean)
            return not _is_disallowed_ip(ip)
        except ValueError:
            pass

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
    required_permission: ToolPermission = ToolPermission.READ_PUBLIC
    requires_confirmation: bool = False
    is_sandboxed: bool = False
    timeout_seconds: float = 10.0
    auth_required: bool = False
    rate_limit_per_min: int = 60


class ToolRegistry:
    """Explicit registry of verified research tools with RBAC permission enforcement."""

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
                "required_permission": t.required_permission.name,
                "requires_confirmation": t.requires_confirmation,
                "is_sandboxed": t.is_sandboxed,
                "auth_required": t.auth_required,
            }
            for t in self._tools.values()
        ]

    async def execute(
        self,
        name: str,
        *,
        user_permissions: ToolPermission | None = None,
        **kwargs: Any,
    ) -> ToolResult:
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

        # RBAC Permission Check
        if user_permissions is not None:
            if not (user_permissions & tool.required_permission):
                completed = time.perf_counter() * 1000
                _logger.warning("tool.permission_denied", tool=name, required=tool.required_permission)
                return ToolResult(
                    tool=name,
                    status="error",
                    started_ms=started,
                    completed_ms=completed,
                    duration_ms=round(completed - started, 2),
                    summary=f"Permission denied: '{name}' requires {tool.required_permission.name}",
                    data={"error": "permission_denied"},
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
                description="Performs multi-source research using Wikipedia, open web, and databases.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "max_results": {"type": "integer", "default": 5},
                    },
                    "required": ["query"],
                },
                handler=self._handle_web_search,
                required_permission=ToolPermission.READ_PUBLIC,
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
                required_permission=ToolPermission.READ_PUBLIC,
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
                required_permission=ToolPermission.READ_PUBLIC,
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
                required_permission=ToolPermission.EXECUTE_LOCAL,
                timeout_seconds=2.0,
            )
        )
        self.register(
            ToolDefinition(
                name="url_ingest",
                description="Ingests and scrapes web pages, GitHub repositories, and YouTube metadata.",
                parameters_schema={
                    "type": "object",
                    "properties": {"url": {"type": "string"}},
                    "required": ["url"],
                },
                handler=self._handle_url_ingest,
                required_permission=ToolPermission.EXECUTE_NETWORK,
                timeout_seconds=10.0,
            )
        )
        self.register(
            ToolDefinition(
                name="deep_crawler",
                description="Polite deep web crawler with robots.txt compliance and rate limiting.",
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "url": {"type": "string"},
                        "max_depth": {"type": "integer", "default": 1},
                        "max_pages": {"type": "integer", "default": 5},
                    },
                    "required": ["url"],
                },
                handler=self._handle_deep_crawler,
                required_permission=ToolPermission.EXECUTE_NETWORK,
                timeout_seconds=20.0,
            )
        )

    async def _handle_deep_crawler(
        self,
        url: str = "",
        max_depth: int = 1,
        max_pages: int = 5,
    ) -> ToolResult:
        from neural_navigator.infrastructure.crawler.base import CrawlRequest
        from neural_navigator.infrastructure.crawler.crawler import DeepWebCrawler

        started = time.perf_counter() * 1000
        crawler = DeepWebCrawler()
        req = CrawlRequest(url=url, max_depth=max_depth)
        pages = await crawler.crawl(req, max_pages=max_pages)
        completed = time.perf_counter() * 1000

        successful_pages = [p for p in pages if p.status == "success"]
        sources = [
            {
                "title": p.title or p.url,
                "url": p.url,
                "snippet": sanitize_untrusted_content(p.extracted_text, max_chars=1200),
                "domain": urllib.parse.urlparse(p.url).netloc.lower(),
                "authority": 0.85,
            }
            for p in successful_pages
        ]

        return ToolResult(
            tool="deep_crawler",
            status="ok" if successful_pages else "error",
            started_ms=started,
            completed_ms=completed,
            duration_ms=round(completed - started, 2),
            summary=f"Crawled {len(successful_pages)} pages from {url}",
            data={"results": sources, "pages": [p.as_dict() for p in pages], "count": len(successful_pages)},
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
        from neural_navigator.infrastructure.crawler.providers.wikipedia import WikipediaSearchProvider

        started = time.perf_counter() * 1000
        provider = WikipediaSearchProvider()
        results = await provider.search(query=query, max_results=4)
        completed = time.perf_counter() * 1000

        return ToolResult(
            tool="wikipedia",
            status="ok" if results else "ok",
            started_ms=started,
            completed_ms=completed,
            duration_ms=round(completed - started, 2),
            summary=f"Found {len(results)} Wikipedia results for '{query}'",
            data={"results": results, "query": query, "count": len(results)},
        )

    async def _handle_arxiv(self, query: str = "", max_results: int = 3) -> ToolResult:
        from neural_navigator.infrastructure.crawler.providers.arxiv import ArxivSearchProvider

        started = time.perf_counter() * 1000
        provider = ArxivSearchProvider()
        results = await provider.search(query=query, max_results=max_results)
        completed = time.perf_counter() * 1000

        return ToolResult(
            tool="arxiv",
            status="ok" if results else "ok",
            started_ms=started,
            completed_ms=completed,
            duration_ms=round(completed - started, 2),
            summary=f"Found {len(results)} ArXiv preprints for '{query}'",
            data={"results": results, "query": query, "count": len(results)},
        )

    async def _handle_web_search(self, query: str = "", max_results: int = 5) -> ToolResult:
        from neural_navigator.infrastructure.crawler.providers.router import SearchProviderRouter

        started = time.perf_counter() * 1000
        router = SearchProviderRouter()
        results = await router.search(query=query, max_results=max_results)
        completed = time.perf_counter() * 1000

        return ToolResult(
            tool="web_search",
            status="ok" if results else "ok",
            started_ms=started,
            completed_ms=completed,
            duration_ms=round(completed - started, 2),
            summary=f"Found {len(results)} search results for '{query}'",
            data={"results": results, "query": query, "count": len(results)},
        )
