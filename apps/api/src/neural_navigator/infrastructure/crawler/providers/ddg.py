"""DuckDuckGo search provider implementing the SearchProvider interface."""

from __future__ import annotations

import re
import urllib.parse
from typing import Any

import httpx
import structlog
from bs4 import BeautifulSoup

from neural_navigator.infrastructure.crawler.base import SearchProvider
from neural_navigator.orchestration.tool_registry import is_safe_external_url, sanitize_untrusted_content

_logger = structlog.get_logger("neural_navigator.crawler.providers.ddg")


class DuckDuckGoSearchProvider(SearchProvider):
    """DuckDuckGo multi-source web search provider."""

    @property
    def name(self) -> str:
        return "duckduckgo"

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

        if allowed_domains:
            domain_filter = " " + " OR ".join(f"site:{d}" for d in allowed_domains)
            search_query = cleaned_query + domain_filter
        else:
            search_query = cleaned_query

        results: list[dict[str, Any]] = []

        # 1. Instant Answer JSON API
        try:
            api_url = f"https://api.duckduckgo.com/?q={urllib.parse.quote_plus(search_query)}&format=json&no_html=1&skip_disambig=1"
            async with httpx.AsyncClient(
                timeout=6.0, headers={"User-Agent": "XplainAI-Bot/2.2"}
            ) as client:
                resp = await client.get(api_url)
                if resp.status_code == 200:
                    data = resp.json()
                    abstract = data.get("AbstractText", "")
                    abstract_url = data.get("AbstractURL", "")
                    heading = data.get("Heading", "")
                    if abstract and abstract_url and is_safe_external_url(abstract_url):
                        domain = urllib.parse.urlparse(abstract_url).netloc.lower()
                        results.append(
                            {
                                "title": heading or f"Overview: {cleaned_query}",
                                "url": abstract_url,
                                "snippet": sanitize_untrusted_content(abstract, max_chars=1200),
                                "domain": domain,
                                "authority": 0.90,
                            }
                        )

                    for topic in data.get("RelatedTopics", []):
                        if len(results) >= max_results:
                            break
                        if isinstance(topic, dict) and "Text" in topic and "FirstURL" in topic:
                            topic_url = topic["FirstURL"]
                            if is_safe_external_url(topic_url):
                                domain = urllib.parse.urlparse(topic_url).netloc.lower()
                                results.append(
                                    {
                                        "title": topic.get("Text", "").split(" - ")[0][:100],
                                        "url": topic_url,
                                        "snippet": sanitize_untrusted_content(
                                            topic.get("Text", ""), max_chars=800
                                        ),
                                        "domain": domain,
                                        "authority": 0.85,
                                    }
                                )
        except Exception as exc:
            _logger.debug("ddg_api.failed", error=str(exc))

        # 2. HTML search fallback
        if len(results) < max_results:
            try:
                html_url = "https://html.duckduckgo.com/html/"
                async with httpx.AsyncClient(
                    timeout=8.0,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Accept-Language": "en-US,en;q=0.9",
                    },
                ) as client:
                    resp = await client.post(html_url, data={"q": search_query})
                    if resp.status_code == 200:
                        soup = BeautifulSoup(resp.text, "html.parser")
                        links = soup.find_all("div", class_=re.compile(r"result\s|result__body"))
                        for item in links:
                            if len(results) >= max_results:
                                break
                            title_elem = item.find("a", class_=re.compile(r"result__snippet|result__url|result__a"))
                            snippet_elem = item.find("a", class_=re.compile(r"result__snippet")) or item.find(
                                "div", class_=re.compile(r"result__snippet")
                            )
                            if not title_elem:
                                continue

                            raw_href = title_elem.get("href", "")
                            if "uddg=" in raw_href:
                                parsed_href = urllib.parse.parse_qs(urllib.parse.urlparse(raw_href).query)
                                target_url = parsed_href.get("uddg", [raw_href])[0]
                            else:
                                target_url = raw_href

                            if not target_url or not is_safe_external_url(target_url):
                                continue

                            domain = urllib.parse.urlparse(target_url).netloc.lower()
                            title = title_elem.get_text().strip()
                            snippet = snippet_elem.get_text().strip() if snippet_elem else ""

                            if not any(r["url"] == target_url for r in results):
                                results.append(
                                    {
                                        "title": title or target_url,
                                        "url": target_url,
                                        "snippet": sanitize_untrusted_content(snippet, max_chars=1200),
                                        "domain": domain,
                                        "authority": 0.82,
                                    }
                                )
            except Exception as exc:
                _logger.debug("ddg_html.failed", error=str(exc))

        return results[:max_results]
