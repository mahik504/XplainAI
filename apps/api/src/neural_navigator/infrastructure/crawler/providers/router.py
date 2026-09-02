"""Search Provider Router for dispatching queries across multiple search engines."""

from __future__ import annotations

import asyncio
import re
from typing import Any

import structlog

from neural_navigator.infrastructure.crawler.base import SearchProvider
from neural_navigator.infrastructure.crawler.dedup import UrlCanonicalizer
from neural_navigator.infrastructure.crawler.providers.arxiv import ArxivSearchProvider
from neural_navigator.infrastructure.crawler.providers.ddg import DuckDuckGoSearchProvider
from neural_navigator.infrastructure.crawler.providers.google import GoogleSearchProvider
from neural_navigator.infrastructure.crawler.providers.wikipedia import WikipediaSearchProvider

_logger = structlog.get_logger("neural_navigator.crawler.providers.router")

_ACADEMIC_TERMS = re.compile(
    r"\b(arxiv|paper|theorem|proof|algorithm|quantum|physics|neural network|transformer|biology|chemistry|equation|peer-reviewed|dataset|benchmark)\b",
    re.I,
)


class SearchProviderRouter:
    """Intelligently routes search queries to optimal providers and merges results."""

    def __init__(self) -> None:
        self._providers: dict[str, SearchProvider] = {}
        self._register_defaults()

    def _register_defaults(self) -> None:
        self.register_provider(DuckDuckGoSearchProvider())
        self.register_provider(ArxivSearchProvider())
        self.register_provider(WikipediaSearchProvider())
        self.register_provider(GoogleSearchProvider())

    def register_provider(self, provider: SearchProvider) -> None:
        self._providers[provider.name] = provider

    def get_provider(self, name: str) -> SearchProvider | None:
        return self._providers.get(name)

    async def search(
        self,
        query: str,
        *,
        provider: str = "auto",
        max_results: int = 5,
        allowed_domains: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Dispatch query to specified provider or route automatically across providers."""
        cleaned_query = query.strip()
        if not cleaned_query:
            return []

        if provider != "auto" and provider in self._providers:
            return await self._providers[provider].search(
                cleaned_query,
                max_results=max_results,
                allowed_domains=allowed_domains,
            )

        tasks: list[asyncio.Task[list[dict[str, Any]]]] = []

        ddg = self._providers.get("duckduckgo")
        if ddg:
            tasks.append(
                asyncio.create_task(
                    ddg.search(
                        cleaned_query,
                        max_results=max_results,
                        allowed_domains=allowed_domains,
                    )
                )
            )

        if _ACADEMIC_TERMS.search(cleaned_query):
            arxiv = self._providers.get("arxiv")
            if arxiv:
                tasks.append(
                    asyncio.create_task(
                        arxiv.search(cleaned_query, max_results=min(3, max_results))
                    )
                )

        wiki = self._providers.get("wikipedia")
        if wiki:
            tasks.append(
                asyncio.create_task(
                    wiki.search(cleaned_query, max_results=min(3, max_results))
                )
            )

        provider_results = await asyncio.gather(*tasks, return_exceptions=True)

        combined: list[dict[str, Any]] = []
        seen_urls: set[str] = set()

        for res in provider_results:
            if isinstance(res, list):
                for item in res:
                    url = item.get("url", "")
                    canon_url = UrlCanonicalizer.canonicalize(url)
                    if canon_url and canon_url not in seen_urls:
                        seen_urls.add(canon_url)
                        combined.append(item)

        combined.sort(key=lambda x: float(x.get("authority", 0.8)), reverse=True)
        return combined[:max_results]
