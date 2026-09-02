"""ArXiv scientific preprint search provider."""

from __future__ import annotations

import re
import urllib.parse
from typing import Any
import xml.etree.ElementTree as ET

import httpx
import structlog

from neural_navigator.infrastructure.crawler.base import SearchProvider
from neural_navigator.orchestration.tool_registry import sanitize_untrusted_content

_logger = structlog.get_logger("neural_navigator.crawler.providers.arxiv")


class ArxivSearchProvider(SearchProvider):
    """ArXiv preprint search provider for peer-reviewed & preprint scientific literature."""

    @property
    def name(self) -> str:
        return "arxiv"

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
            f"https://export.arxiv.org/api/query?search_query=all:{urllib.parse.quote_plus(cleaned_query)}"
            f"&start=0&max_results={max(1, min(max_results, 20))}&sortBy=relevance&sortOrder=descending"
        )

        results: list[dict[str, Any]] = []
        try:
            async with httpx.AsyncClient(
                timeout=10.0, headers={"User-Agent": "XplainAI-Research/2.2"}
            ) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    root = ET.fromstring(resp.text)
                    ns = {"atom": "http://www.w3.org/2005/Atom"}
                    for entry in root.findall("atom:entry", ns):
                        title_elem = entry.find("atom:title", ns)
                        summary_elem = entry.find("atom:summary", ns)
                        id_elem = entry.find("atom:id", ns)
                        published_elem = entry.find("atom:published", ns)

                        authors = [
                            a.find("atom:name", ns).text.strip()
                            for a in entry.findall("atom:author", ns)
                            if a.find("atom:name", ns) is not None and a.find("atom:name", ns).text
                        ]

                        title = title_elem.text.strip().replace("\n", " ") if title_elem is not None and title_elem.text else ""
                        summary = summary_elem.text.strip().replace("\n", " ") if summary_elem is not None and summary_elem.text else ""
                        paper_url = id_elem.text.strip() if id_elem is not None and id_elem.text else ""
                        published = published_elem.text.strip() if published_elem is not None and published_elem.text else None

                        if paper_url and title:
                            results.append(
                                {
                                    "title": f"ArXiv: {title}",
                                    "url": paper_url,
                                    "snippet": sanitize_untrusted_content(summary, max_chars=1200),
                                    "domain": "arxiv.org",
                                    "authority": 0.96,
                                    "author": ", ".join(authors[:3]) if authors else None,
                                    "published_date": published,
                                    "source_type": "paper",
                                }
                            )
        except Exception as exc:
            _logger.warning("arxiv_search.failed", query=query, error=str(exc))

        return results[:max_results]
