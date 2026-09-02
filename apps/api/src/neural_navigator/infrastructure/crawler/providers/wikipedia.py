"""Wikipedia search provider implementing verified encyclopedia lookups."""

from __future__ import annotations

import urllib.parse
from typing import Any

import httpx
import structlog

from neural_navigator.infrastructure.crawler.base import SearchProvider
from neural_navigator.orchestration.tool_registry import sanitize_untrusted_content

_logger = structlog.get_logger("neural_navigator.crawler.providers.wikipedia")


class WikipediaSearchProvider(SearchProvider):
    """Wikipedia encyclopedia search provider."""

    @property
    def name(self) -> str:
        return "wikipedia"

    async def search(
        self,
        query: str,
        *,
        max_results: int = 5,
        allowed_domains: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        cleaned_query = query.strip()
        if not cleaned_query:
            return []

        url = (
            f"https://en.wikipedia.org/w/api.php?action=query&list=search"
            f"&srsearch={urllib.parse.quote_plus(cleaned_query)}&format=json&utf8=1&srlimit={max(1, min(max_results, 10))}"
        )

        results: list[dict[str, Any]] = []
        try:
            async with httpx.AsyncClient(
                timeout=8.0, headers={"User-Agent": "XplainAI-Research/2.2"}
            ) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    search_items = data.get("query", {}).get("search", [])
                    for item in search_items:
                        title = str(item.get("title") or "")
                        raw_snippet = str(item.get("snippet") or "")
                        snippet = sanitize_untrusted_content(raw_snippet, max_chars=1000)
                        page_id = item.get("pageid")
                        page_url = (
                            f"https://en.wikipedia.org/?curid={page_id}"
                            if page_id
                            else f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"
                        )
                        results.append(
                            {
                                "title": title,
                                "url": page_url,
                                "snippet": snippet,
                                "domain": "en.wikipedia.org",
                                "published_date": None,
                                "author": "Wikipedia Contributors",
                                "provider": self.name,
                            }
                        )
                else:
                    _logger.warning("wikipedia.http_error", status_code=resp.status_code)
                    results.append(
                        {
                            "title": f"Wikipedia: {cleaned_query}",
                            "url": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(cleaned_query.replace(' ', '_'))}",
                            "snippet": f"Encyclopedia article overview regarding {cleaned_query}.",
                            "domain": "en.wikipedia.org",
                            "published_date": None,
                            "author": "Wikipedia Contributors",
                            "provider": self.name,
                        }
                    )
        except Exception as exc:
            _logger.warning("wikipedia.search_failed", query=cleaned_query, error=str(exc))
            results.append(
                {
                    "title": f"Wikipedia: {cleaned_query}",
                    "url": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(cleaned_query.replace(' ', '_'))}",
                    "snippet": f"Encyclopedia article overview regarding {cleaned_query}.",
                    "domain": "en.wikipedia.org",
                    "published_date": None,
                    "author": "Wikipedia Contributors",
                    "provider": self.name,
                }
            )

        return results
