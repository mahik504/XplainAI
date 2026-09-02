"""Google Custom Search API provider with fallback support."""

from __future__ import annotations

import os
import urllib.parse
from typing import Any

import httpx
import structlog

from neural_navigator.infrastructure.crawler.base import SearchProvider
from neural_navigator.orchestration.tool_registry import is_safe_external_url, sanitize_untrusted_content

_logger = structlog.get_logger("neural_navigator.crawler.providers.google")


class GoogleSearchProvider(SearchProvider):
    """Google Custom Search JSON API provider."""

    def __init__(
        self,
        api_key: str | None = None,
        cx: str | None = None,
    ) -> None:
        self.api_key = api_key or os.getenv("GOOGLE_SEARCH_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.cx = cx or os.getenv("GOOGLE_SEARCH_CX") or os.getenv("GOOGLE_CSE_ID")

    @property
    def name(self) -> str:
        return "google"

    async def search(
        self,
        query: str,
        *,
        max_results: int = 5,
        allowed_domains: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        cleaned_query = query.strip()
        if not cleaned_query or not self.api_key or not self.cx:
            _logger.debug("google_search.skipped_no_credentials")
            return []

        if allowed_domains:
            domain_filter = " " + " OR ".join(f"site:{d}" for d in allowed_domains)
            search_query = cleaned_query + domain_filter
        else:
            search_query = cleaned_query

        params = {
            "key": self.api_key,
            "cx": self.cx,
            "q": search_query,
            "num": min(10, max(1, max_results)),
        }

        url = f"https://customsearch.googleapis.com/customsearch/v1?{urllib.parse.urlencode(params)}"
        results: list[dict[str, Any]] = []

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    items = data.get("items", [])
                    for item in items:
                        link = item.get("link", "")
                        if not link or not is_safe_external_url(link):
                            continue
                        domain = urllib.parse.urlparse(link).netloc.lower()
                        title = item.get("title", "")
                        snippet = item.get("snippet", "")
                        results.append(
                            {
                                "title": title,
                                "url": link,
                                "snippet": sanitize_untrusted_content(snippet, max_chars=1200),
                                "domain": domain,
                                "authority": 0.88,
                                "source_type": "web",
                            }
                        )
        except Exception as exc:
            _logger.warning("google_search.failed", query=query, error=str(exc))

        return results[:max_results]
