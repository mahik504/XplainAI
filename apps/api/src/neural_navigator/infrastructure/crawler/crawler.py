"""Deep Web Crawler orchestrator with politeness, rate limiting, and deduplication."""

from __future__ import annotations

import asyncio
import time
import urllib.parse
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

import httpx
import structlog

from neural_navigator.infrastructure.crawler.base import (
    CrawledPage,
    CrawlRequest,
    FetchStatus,
)
from neural_navigator.infrastructure.crawler.dedup import ContentHasher, UrlCanonicalizer
from neural_navigator.infrastructure.crawler.extractor import ContentExtractor
from neural_navigator.infrastructure.crawler.rate_limiter import DomainRateLimiter
from neural_navigator.infrastructure.crawler.robots import RobotsTxtParser
from neural_navigator.orchestration.tool_registry import is_safe_external_url

_logger = structlog.get_logger("neural_navigator.infrastructure.crawler")


def utc_now() -> datetime:
    return datetime.now(UTC)


class DeepWebCrawler:
    """Asynchronous crawler coordinating robots.txt, rate limits, parsing, and deduplication."""

    def __init__(
        self,
        user_agent: str = "XplainAI-Bot/2.2",
        default_rate_interval: float = 0.5,
        max_retries: int = 2,
    ) -> None:
        self.user_agent = user_agent
        self.max_retries = max_retries
        self.robots_parser = RobotsTxtParser(user_agent=user_agent)
        self.rate_limiter = DomainRateLimiter(default_interval=default_rate_interval)
        self.seen_urls: set[str] = set()
        self.seen_content_hashes: set[str] = set()

    async def fetch_page(self, request: CrawlRequest) -> CrawledPage:
        """Fetch and parse a single URL with full politeness and safety checks."""
        raw_url = request.url.strip()
        if not raw_url:
            return CrawledPage(
                url=raw_url,
                canonical_url="",
                status=FetchStatus.HTTP_ERROR,
                status_code=400,
                error_message="Empty URL",
            )

        # 1. SSRF Safety Check
        if not is_safe_external_url(raw_url):
            _logger.warning("crawler.ssrf_blocked", url=raw_url)
            return CrawledPage(
                url=raw_url,
                canonical_url="",
                status=FetchStatus.SSRF_BLOCKED,
                status_code=403,
                error_message="SSRF protection blocked destination host or IP",
            )

        canonical_url = UrlCanonicalizer.canonicalize(raw_url)
        if canonical_url in self.seen_urls:
            return CrawledPage(
                url=raw_url,
                canonical_url=canonical_url,
                status=FetchStatus.DEDUPLICATED,
                status_code=200,
                error_message="URL already visited in current crawl session",
            )

        # 2. Robots.txt Compliance Check
        allowed, crawl_delay = await self.robots_parser.can_fetch(raw_url)
        if not allowed:
            _logger.info("crawler.robots_disallowed", url=raw_url)
            return CrawledPage(
                url=raw_url,
                canonical_url=canonical_url,
                status=FetchStatus.ROBOTS_DISALLOWED,
                status_code=403,
                error_message="Robots.txt forbids crawling this path",
            )

        # 3. Domain Rate Limiter Check
        domain = urllib.parse.urlparse(raw_url).netloc.lower()
        await self.rate_limiter.acquire(domain, min_delay=crawl_delay)

        # 4. Asynchronous HTTP Fetch with Retry
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            **request.custom_headers,
        }

        started = time.perf_counter()
        last_error: str | None = None
        status_code = 0
        resp_text = ""
        resp_headers: dict[str, str] = {}
        content_type = "text/html"

        for attempt in range(self.max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=request.timeout_seconds,
                    follow_redirects=True,
                    headers=headers,
                ) as client:
                    resp = await client.get(raw_url)
                    status_code = resp.status_code
                    resp_headers = dict(resp.headers)
                    content_type = resp.headers.get("content-type", "text/html").split(";")[0]

                    if resp.status_code == 200:
                        resp_text = resp.text
                        last_error = None
                        break
                    elif resp.status_code == 429:
                        last_error = "Rate limited (HTTP 429)"
                        if attempt < self.max_retries:
                            await asyncio.sleep(1.0 * (attempt + 1))
                            continue
                        return CrawledPage(
                            url=raw_url,
                            canonical_url=canonical_url,
                            status=FetchStatus.RATE_LIMITED,
                            status_code=429,
                            error_message=last_error,
                        )
                    else:
                        last_error = f"HTTP {resp.status_code}"
                        if attempt < self.max_retries and resp.status_code >= 500:
                            await asyncio.sleep(0.5 * (attempt + 1))
                            continue
                        break
            except httpx.TimeoutException:
                last_error = f"Request timed out after {request.timeout_seconds}s"
                if attempt < self.max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                return CrawledPage(
                    url=raw_url,
                    canonical_url=canonical_url,
                    status=FetchStatus.TIMEOUT,
                    status_code=504,
                    error_message=last_error,
                )
            except Exception as exc:
                last_error = f"Fetch failed: {exc}"
                if attempt < self.max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                break

        duration_ms = (time.perf_counter() - started) * 1000

        if status_code != 200 or not resp_text:
            return CrawledPage(
                url=raw_url,
                canonical_url=canonical_url,
                status=FetchStatus.HTTP_ERROR,
                status_code=status_code or 500,
                headers=resp_headers,
                fetch_duration_ms=duration_ms,
                error_message=last_error or f"HTTP status {status_code}",
            )

        # 5. Extract Content & Links
        try:
            extracted = ContentExtractor.extract(resp_text, base_url=raw_url)
            text_body = extracted.get("extracted_text", "")
            title = extracted.get("title", "")
            links = extracted.get("links", [])
            content_hash = ContentHasher.sha256_hash(text_body)

            if content_hash in self.seen_content_hashes:
                return CrawledPage(
                    url=raw_url,
                    canonical_url=canonical_url,
                    status=FetchStatus.DEDUPLICATED,
                    status_code=200,
                    content_type=content_type,
                    title=title,
                    raw_html=resp_text,
                    extracted_text=text_body,
                    content_hash=content_hash,
                    headers=resp_headers,
                    links=links,
                    fetch_duration_ms=duration_ms,
                    error_message="Duplicate content body hash",
                )

            self.seen_urls.add(canonical_url)
            self.seen_content_hashes.add(content_hash)

            return CrawledPage(
                url=raw_url,
                canonical_url=canonical_url,
                status=FetchStatus.SUCCESS,
                status_code=200,
                content_type=content_type,
                title=title,
                raw_html=resp_text,
                extracted_text=text_body,
                content_hash=content_hash,
                headers=resp_headers,
                links=links,
                fetch_duration_ms=duration_ms,
            )
        except Exception as exc:
            _logger.error("crawler.parse_failed", url=raw_url, error=str(exc))
            return CrawledPage(
                url=raw_url,
                canonical_url=canonical_url,
                status=FetchStatus.PARSE_ERROR,
                status_code=status_code,
                headers=resp_headers,
                fetch_duration_ms=duration_ms,
                error_message=f"Extraction error: {exc}",
            )

    async def crawl(
        self,
        request: CrawlRequest,
        *,
        max_pages: int = 10,
    ) -> list[CrawledPage]:
        """Perform a breadth-first recursive crawl up to max_depth."""
        results: list[CrawledPage] = []
        queue: list[tuple[str, int]] = [(request.url, 0)]
        enqueued: set[str] = {UrlCanonicalizer.canonicalize(request.url)}

        while queue and len(results) < max_pages:
            current_url, depth = queue.pop(0)
            req = CrawlRequest(
                url=current_url,
                depth=depth,
                max_depth=request.max_depth,
                session_id=request.session_id,
                allowed_domains=request.allowed_domains,
                custom_headers=request.custom_headers,
                timeout_seconds=request.timeout_seconds,
            )

            page = await self.fetch_page(req)
            results.append(page)

            if page.status == FetchStatus.SUCCESS and depth < request.max_depth:
                for link in page.links:
                    canon_link = UrlCanonicalizer.canonicalize(link)
                    if canon_link in enqueued:
                        continue

                    if request.allowed_domains:
                        link_domain = urllib.parse.urlparse(link).netloc.lower()
                        if not any(
                            link_domain == ad.lower() or link_domain.endswith(f".{ad.lower()}")
                            for ad in request.allowed_domains
                        ):
                            continue

                    enqueued.add(canon_link)
                    queue.append((link, depth + 1))
                    if len(queue) + len(results) >= max_pages * 2:
                        break

        return results
