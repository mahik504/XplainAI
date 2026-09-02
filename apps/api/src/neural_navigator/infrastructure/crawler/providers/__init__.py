"""Search provider implementations."""

from neural_navigator.infrastructure.crawler.providers.arxiv import ArxivSearchProvider
from neural_navigator.infrastructure.crawler.providers.ddg import DuckDuckGoSearchProvider
from neural_navigator.infrastructure.crawler.providers.google import GoogleSearchProvider
from neural_navigator.infrastructure.crawler.providers.router import SearchProviderRouter
from neural_navigator.infrastructure.crawler.providers.wikipedia import WikipediaSearchProvider

__all__ = [
    "ArxivSearchProvider",
    "DuckDuckGoSearchProvider",
    "GoogleSearchProvider",
    "SearchProviderRouter",
    "WikipediaSearchProvider",
]
