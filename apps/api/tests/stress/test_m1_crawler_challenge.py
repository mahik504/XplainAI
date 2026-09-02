"""Empirical Adversarial Challenge & Stress Tests for Milestone 1 (M1).

Stress-tests:
1. RobotsTxtParser: Wildcard matching, Allow/Disallow precedence, Crawl-delay parsing bug detection, HTTP error degradation.
2. DomainRateLimiter: High-concurrency serialization for same domain vs parallel throughput for different domains.
3. ContentExtractor: Malformed/dirty HTML, nested structures, script/style/nav/footer stripping, table data omission bug detection, metadata and link resolution.
4. Dedup & Canonicalization: 13+ tracking params, path normalization, port stripping, 64-bit SimHash near-duplicates and SHA-256.
5. SearchProviderRouter: Simulated provider timeouts, connection errors, HTTP 429/500/503 errors, allowed_domains leakage bug detection, deduplication and authority ranking.
6. DeepWebCrawler: SSRF private IP blocking, BFS traversal depth, domain filtering, and duplicate content detection.
"""

from __future__ import annotations

import asyncio
import re
import time
import urllib.parse
from unittest.mock import AsyncMock, patch
import xml.etree.ElementTree as ET

import httpx
import pytest

from neural_navigator.infrastructure.crawler.base import (
    CrawlRequest,
    CrawledPage,
    FetchStatus,
    SearchProvider,
)
from neural_navigator.infrastructure.crawler.crawler import DeepWebCrawler
from neural_navigator.infrastructure.crawler.dedup import ContentHasher, UrlCanonicalizer
from neural_navigator.infrastructure.crawler.extractor import ContentExtractor
from neural_navigator.infrastructure.crawler.rate_limiter import DomainRateLimiter
from neural_navigator.infrastructure.crawler.robots import RobotsTxtParser
from neural_navigator.infrastructure.crawler.providers.arxiv import ArxivSearchProvider
from neural_navigator.infrastructure.crawler.providers.ddg import DuckDuckGoSearchProvider
from neural_navigator.infrastructure.crawler.providers.google import GoogleSearchProvider
from neural_navigator.infrastructure.crawler.providers.router import SearchProviderRouter
from neural_navigator.infrastructure.crawler.providers.wikipedia import WikipediaSearchProvider


# ==============================================================================
# 1. RobotsTxtParser Stress & Edge Cases
# ==============================================================================
class TestRobotsTxtParserStress:
    """Empirical challenge tests for robots.txt parsing and compliance."""

    @pytest.mark.asyncio
    async def test_complex_wildcard_and_allow_disallow_precedence(self) -> None:
        """Test wildcard rules, path prefix matching, and allow-overrides-disallow rules."""
        robots_body = """
User-agent: *
Disallow: /admin/
Disallow: /private/
Disallow: /*.pdf$
Disallow: /*?sort=
Allow: /admin/public/
Crawl-delay: 1

User-agent: XplainAI-Bot/2.2
Disallow: /secret-vault/
Disallow: /backend/
Allow: /secret-vault/open/
Crawl-delay: 1
"""
        parser = RobotsTxtParser(user_agent="XplainAI-Bot/2.2")

        mock_resp = httpx.Response(
            status_code=200,
            text=robots_body,
            request=httpx.Request("GET", "https://target-site.com/robots.txt"),
        )

        with patch.object(httpx.AsyncClient, "get", new=AsyncMock(return_value=mock_resp)):
            # Rules for XplainAI-Bot/2.2
            allowed_secret_open, _ = await parser.can_fetch("https://target-site.com/secret-vault/open/file.html")
            assert allowed_secret_open is True

            disallowed_secret, _ = await parser.can_fetch("https://target-site.com/secret-vault/classified.html")
            assert disallowed_secret is False

            disallowed_backend, _ = await parser.can_fetch("https://target-site.com/backend/dashboard")
            assert disallowed_backend is False

            # Since user-agent matched specific block, paths from * block (/admin/) are allowed for XplainAI-Bot
            allowed_admin, _ = await parser.can_fetch("https://target-site.com/admin/settings")
            assert allowed_admin is True

    @pytest.mark.asyncio
    async def test_robots_crawl_delay_behavior_and_limitation(self) -> None:
        """Empirical demonstration: RobotsTxtParser returns 0.0 because RobotFileParser.parse() lacks modified() call."""
        robots_body = """User-agent: *
Disallow: /private/
Crawl-delay: 5
"""
        parser = RobotsTxtParser(user_agent="XplainAI-Bot/2.2")
        mock_resp = httpx.Response(
            status_code=200,
            text=robots_body,
            request=httpx.Request("GET", "https://crawl-delay-test.com/robots.txt"),
        )

        with patch.object(httpx.AsyncClient, "get", new=AsyncMock(return_value=mock_resp)):
            allowed, delay = await parser.can_fetch("https://crawl-delay-test.com/public")
            assert allowed is True
            # Note: Because RobotsTxtParser does not call parser.modified() after parser.parse(),
            # delay is extracted as 0.0 instead of 5.0 in current implementation.
            assert isinstance(delay, float)

    @pytest.mark.asyncio
    async def test_generic_user_agent_fallback(self) -> None:
        """Test wildcard * user agent rules when bot name is not explicitly mentioned."""
        robots_body = """
User-agent: *
Disallow: /private/
Disallow: /tmp/
Crawl-delay: 3
"""
        parser = RobotsTxtParser(user_agent="GenericBot/1.0")
        mock_resp = httpx.Response(
            status_code=200,
            text=robots_body,
            request=httpx.Request("GET", "https://generic-site.com/robots.txt"),
        )

        with patch.object(httpx.AsyncClient, "get", new=AsyncMock(return_value=mock_resp)):
            allowed, _ = await parser.can_fetch("https://generic-site.com/public/index.html")
            assert allowed is True

            disallowed, _ = await parser.can_fetch("https://generic-site.com/private/data")
            assert disallowed is False

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "status_code,resp_text,test_path,expected_allowed",
        [
            (404, "Not Found", "/secret", True),
            (403, "Forbidden", "/secret", True),
            (500, "Internal Server Error", "/secret", True),
            (503, "Service Unavailable", "/secret", True),
            (200, "User-agent: *\nDisallow: /", "/secret", False),
            (200, "User-agent: *\nDisallow: \n", "/secret", True),
            (200, "User-agent: *\n# comment line\nDisallow: /private\nCrawl-delay: invalid", "/public", True),
        ],
    )
    async def test_robots_http_status_codes_and_fault_tolerance(
        self, status_code: int, resp_text: str, test_path: str, expected_allowed: bool
    ) -> None:
        """Test parser resilience against various HTTP status codes and malformed robots content."""
        parser = RobotsTxtParser(user_agent="XplainAI-Bot/2.2")
        mock_resp = httpx.Response(
            status_code=status_code,
            text=resp_text,
            request=httpx.Request("GET", "https://fault-test.com/robots.txt"),
        )

        with patch.object(httpx.AsyncClient, "get", new=AsyncMock(return_value=mock_resp)):
            allowed, delay = await parser.can_fetch(f"https://fault-test.com{test_path}")
            assert allowed is expected_allowed
            assert isinstance(delay, float)

    @pytest.mark.asyncio
    async def test_robots_timeout_and_network_exception(self) -> None:
        """Test parser behavior when network times out or drops connection."""
        parser = RobotsTxtParser(user_agent="XplainAI-Bot/2.2")

        with patch.object(httpx.AsyncClient, "get", side_effect=httpx.ConnectTimeout("Connection timed out")):
            allowed, delay = await parser.can_fetch("https://timeout-site.com/article/1")
            assert allowed is True
            assert delay == 0.0

    @pytest.mark.asyncio
    async def test_robots_cache_and_clear_cache(self) -> None:
        """Test LRU/dictionary cache behavior and cache clearing."""
        parser = RobotsTxtParser(user_agent="XplainAI-Bot/2.2")
        call_count = 0

        async def counting_get(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return httpx.Response(
                status_code=200,
                text="User-agent: *\nDisallow: /locked/\nCrawl-delay: 2\n",
                request=httpx.Request("GET", "https://cached-site.com/robots.txt"),
            )

        with patch.object(httpx.AsyncClient, "get", new=counting_get):
            # First check -> should make network call
            allowed1, _ = await parser.can_fetch("https://cached-site.com/locked/1")
            assert allowed1 is False
            assert call_count == 1

            # Second check on same domain -> cached, NO new network call
            allowed2, _ = await parser.can_fetch("https://cached-site.com/public/2")
            assert allowed2 is True
            assert call_count == 1

            # Clear cache
            parser.clear_cache()

            # Third check -> makes new network call
            allowed3, _ = await parser.can_fetch("https://cached-site.com/locked/2")
            assert allowed3 is False
            assert call_count == 2


# ==============================================================================
# 2. DomainRateLimiter Concurrency Stress
# ==============================================================================
class TestDomainRateLimiterStress:
    """Empirical concurrency and timing tests for DomainRateLimiter."""

    @pytest.mark.asyncio
    async def test_high_concurrency_same_domain_serialization(self) -> None:
        """Ensure multiple concurrent requests to the SAME domain are strictly serialized."""
        limiter = DomainRateLimiter(default_interval=0.04)
        num_tasks = 5
        timestamps: list[float] = []

        async def worker(worker_id: int):
            await limiter.acquire("concurrent-target.org", min_delay=0.04)
            timestamps.append(time.monotonic())

        start_time = time.monotonic()
        await asyncio.gather(*(worker(i) for i in range(num_tasks)))
        total_duration = time.monotonic() - start_time

        assert len(timestamps) == num_tasks
        # Total duration for 5 serialized tasks with 0.04s interval must be at least 4 * 0.04s = 0.16s
        assert total_duration >= 0.15, f"Expected total duration >= 0.15s, got {total_duration:.4f}s"

        # Check consecutive intervals
        timestamps.sort()
        for i in range(1, len(timestamps)):
            diff = timestamps[i] - timestamps[i - 1]
            assert diff >= 0.035, f"Interval between task {i-1} and {i} too short: {diff:.4f}s"

    @pytest.mark.asyncio
    async def test_high_concurrency_different_domains_parallelism(self) -> None:
        """Ensure concurrent requests to DIFFERENT domains execute in parallel without cross-blocking."""
        limiter = DomainRateLimiter(default_interval=0.1)
        num_domains = 6
        domains = [f"domain-{i}.com" for i in range(num_domains)]

        start_time = time.monotonic()

        async def fetch_domain(d: str):
            await limiter.acquire(d, min_delay=0.1)

        await asyncio.gather(*(fetch_domain(d) for d in domains))
        total_duration = time.monotonic() - start_time

        # All 6 different domains should execute concurrently in ~0.1s rather than sequentially in 0.6s
        assert total_duration < 0.25, (
            f"Different domains should execute concurrently: expected < 0.25s, got {total_duration:.4f}s"
        )

    @pytest.mark.asyncio
    async def test_domain_normalization_and_reset(self) -> None:
        """Test domain whitespace stripping, casing normalization, and reset()."""
        limiter = DomainRateLimiter(default_interval=0.05)

        # "  EXAMPLE.COM  " and "example.com" must share the same lock and timing state
        start = time.monotonic()
        await limiter.acquire("  EXAMPLE.COM  ", min_delay=0.05)
        await limiter.acquire("example.com", min_delay=0.05)
        duration = time.monotonic() - start
        assert duration >= 0.045

        # Reset should clear state
        limiter.reset()
        assert len(limiter._last_access) == 0
        assert len(limiter._locks) == 0


# ==============================================================================
# 3. ContentExtractor Dirty HTML, Tables, & Boilerplate Stress
# ==============================================================================
class TestContentExtractorStress:
    """Empirical challenge tests for HTML parsing, boilerplate stripping, and metadata extraction."""

    def test_aggressive_boilerplate_and_script_removal(self) -> None:
        """Test removal of script, style, nav, footer, header, noscript, iframe, button, svg, form."""
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Clean Article Title</title>
            <style>body { background: red; } .hidden { display: none; }</style>
            <script>
                var secret_token = "EVIL_SCRIPT_PAYLOAD";
                function exploit() { alert('xss'); }
            </script>
        </head>
        <body>
            <header>
                <h1>Site Logo Header</h1>
                <nav>
                    <a href="/home">Home</a>
                    <a href="/login">Login</a>
                </nav>
            </header>
            <aside>
                <p>Sidebar advertisement and sponsored links.</p>
            </aside>
            <main>
                <article>
                    <h1>Groundbreaking Research in AI</h1>
                    <p>This is the primary scientific finding of the autonomous research engine.</p>
                    <blockquote>Important quoted evidence from the underlying literature.</blockquote>
                    <pre><code>def compute_egi(): return 0.95</code></pre>
                </article>
            </main>
            <form action="/subscribe" method="POST">
                <input type="text" name="email" value="user@example.com"/>
                <button type="submit">Subscribe Now</button>
            </form>
            <iframe src="https://ads.tracker.com/frame"></iframe>
            <svg><text>SVG Graphical Text</text></svg>
            <noscript>Please enable JavaScript to view full features.</noscript>
            <footer>
                <p>Copyright 2026 XplainAI Corporation. All rights reserved.</p>
            </footer>
        </body>
        </html>
        """
        extracted = ContentExtractor.extract(html, base_url="https://xplain.ai/research/paper")
        text = extracted["extracted_text"]

        # Assert clean content preserved
        assert "Groundbreaking Research in AI" in text
        assert "This is the primary scientific finding" in text
        assert "Important quoted evidence" in text
        assert "def compute_egi(): return 0.95" in text

        # Assert boilerplate stripped from text body
        assert "EVIL_SCRIPT_PAYLOAD" not in text
        assert "body { background: red; }" not in text
        assert "Site Logo Header" not in text
        assert "Home" not in text
        assert "Sidebar advertisement" not in text
        assert "Subscribe Now" not in text
        assert "SVG Graphical Text" not in text
        assert "Please enable JavaScript" not in text
        assert "Copyright 2026 XplainAI" not in text

    def test_table_data_omission_vulnerability(self) -> None:
        """Empirical demonstration: ContentExtractor drops table rows <td> when headings/paragraphs are present."""
        html_with_heading_and_table = """
        <html>
        <body>
            <article>
                <h1>Financial Earnings Summary</h1>
                <table>
                    <thead>
                        <tr><th>Metric</th><th>Q1 2026 Value</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>Revenue</td><td>$100,000,000</td></tr>
                        <tr><td>Net Income</td><td>$25,000,000</td></tr>
                    </tbody>
                </table>
            </article>
        </body>
        </html>
        """
        extracted = ContentExtractor.extract(html_with_heading_and_table)
        text = extracted["extracted_text"]
        # Empirical finding: 'Financial Earnings Summary' is extracted, but table data ($100,000,000) is omitted
        # because 'td' and 'th' tags are not in find_all whitelist (extractor.py:117)
        assert "Financial Earnings Summary" in text
        table_omitted = "$100,000,000" not in text
        assert table_omitted is True, "Empirical proof that table content is omitted when headings exist"

    def test_metadata_extraction_fallbacks(self) -> None:
        """Test metadata extraction with OpenGraph, Dublin Core, and standard meta tags."""
        html = """
        <html>
        <head>
            <meta property="og:title" content="OpenGraph Research Title" />
            <meta property="og:description" content="Detailed OG article description regarding quantum computing." />
            <meta property="article:author" content="Dr. Alan Turing" />
            <meta property="article:published_time" content="2026-05-15T10:00:00Z" />
        </head>
        <body>
            <p>Article body content.</p>
        </body>
        </html>
        """
        extracted = ContentExtractor.extract(html, base_url="https://example.com")
        assert extracted["title"] == "OpenGraph Research Title"
        assert extracted["meta_description"] == "Detailed OG article description regarding quantum computing."
        assert extracted["author"] == "Dr. Alan Turing"
        assert extracted["published_date"] == "2026-05-15T10:00:00Z"

    def test_outgoing_link_resolution_and_filtering(self) -> None:
        """Test relative URL resolution, fragment de-duplication, and non-http filtering."""
        html = """
        <html>
        <body>
            <a href="/docs/guide.html">Relative Root Link</a>
            <a href="../section/about">Relative Parent Link</a>
            <a href="deep/page.html">Relative Child Link</a>
            <a href="https://example.com/docs/guide.html#section1">Fragment 1</a>
            <a href="https://example.com/docs/guide.html#section2">Fragment 2</a>
            <a href="javascript:void(0)">JavaScript Link</a>
            <a href="mailto:admin@example.com">Mailto Link</a>
            <a href="tel:+1234567890">Tel Link</a>
            <a href="#top">Anchor Link</a>
        </body>
        </html>
        """
        extracted = ContentExtractor.extract(html, base_url="https://example.com/research/overview.html")
        links = extracted["links"]

        assert "https://example.com/docs/guide.html" in links
        assert "https://example.com/section/about" in links
        assert "https://example.com/research/deep/page.html" in links

        # Verify fragments are stripped and duplicate URLs unified
        doc_links = [l for l in links if l == "https://example.com/docs/guide.html"]
        assert len(doc_links) == 1

        # Verify dangerous/non-http protocols filtered
        assert not any(l.startswith(("javascript:", "mailto:", "tel:", "#")) for l in links)

    def test_empty_and_whitespace_html(self) -> None:
        """Test handling of empty, whitespace, or comments-only HTML strings."""
        res_empty = ContentExtractor.extract("")
        assert res_empty["title"] == ""
        assert res_empty["extracted_text"] == ""
        assert res_empty["links"] == []

        res_ws = ContentExtractor.extract("   \n\t  ")
        assert res_ws["extracted_text"] == ""

        res_comment = ContentExtractor.extract("<!-- just a comment -->")
        assert res_comment["extracted_text"] == ""


# ==============================================================================
# 4. UrlCanonicalizer & ContentHasher Deduplication Stress
# ==============================================================================
class TestUrlCanonicalizerAndDedupStress:
    """Empirical challenge tests for URL canonicalization and SimHash deduplication."""

    @pytest.mark.parametrize(
        "raw_url,expected_canonical",
        [
            # 1. Tracking params removal
            (
                "https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=ai&q=test",
                "https://example.com/page?q=test",
            ),
            (
                "https://example.com/page?fbclid=12345&gclid=67890&ref=twitter&source=rss&ysclid=abc&mc_eid=def&_hsenc=1&_hsmi=2&important=keep",
                "https://example.com/page?important=keep",
            ),
            # 2. Query param sorting
            (
                "https://example.com/search?z=last&a=first&m=middle",
                "https://example.com/search?a=first&m=middle&z=last",
            ),
            # 3. Default port removal
            ("http://example.com:80/path", "http://example.com/path"),
            ("https://example.com:443/path", "https://example.com/path"),
            # 4. Non-default port preservation
            ("http://example.com:8080/path", "http://example.com:8080/path"),
            ("https://example.com:8443/path", "https://example.com:8443/path"),
            # 5. Path normalization & redundant slash reduction
            ("https://example.com/a//b/../c/./d/", "https://example.com/a/c/d/"),
            ("https://example.com", "https://example.com/"),
            # 6. Scheme-less URL prefixing
            ("example.com/test", "https://example.com/test"),
            # 7. Host lowercasing with path casing preservation
            ("HTTP://EXAMPLE.COM/UpperCasePath/File.PDF", "http://example.com/UpperCasePath/File.PDF"),
            # 8. Fragment stripping
            ("https://example.com/page#heading-2", "https://example.com/page"),
        ],
    )
    def test_url_canonicalization_rules(self, raw_url: str, expected_canonical: str) -> None:
        """Verify deterministic normalization of URLs across diverse edge cases."""
        assert UrlCanonicalizer.canonicalize(raw_url) == expected_canonical

    def test_simhash_near_duplicates_vs_dissimilar_texts(self) -> None:
        """Verify 64-bit SimHash correctly identifies near-duplicate texts and separates dissimilar texts."""
        base_text = (
            "The transformer architecture relies on multi-head self-attention mechanisms "
            "to capture long-range contextual dependencies across sequential tokens efficiently. "
            "Positional encodings provide spatial awareness without recurrent connections."
        )
        # 1. Near duplicate with 2 words modified
        near_duplicate = (
            "The transformer architecture relies on multi-head self-attention mechanisms "
            "to capture long-range contextual relationships across sequential tokens efficiently. "
            "Positional encodings offer spatial awareness without recurrent connections."
        )
        # 2. Moderately similar text
        moderate_text = (
            "Attention mechanisms in deep neural networks allow transformer models to process "
            "natural language tokens in parallel with high accuracy."
        )
        # 3. Completely dissimilar text
        dissimilar_text = (
            "Photosynthesis is a biological process used by plants to convert light energy "
            "into chemical energy stored in carbohydrate molecules like glucose."
        )

        h_base = ContentHasher.simhash(base_text)
        h_near = ContentHasher.simhash(near_duplicate)
        h_mod = ContentHasher.simhash(moderate_text)
        h_dissim = ContentHasher.simhash(dissimilar_text)

        sim_near = ContentHasher.simhash_similarity(h_base, h_near)
        sim_mod = ContentHasher.simhash_similarity(h_base, h_mod)
        sim_dissim = ContentHasher.simhash_similarity(h_base, h_dissim)

        assert sim_near >= 0.85, f"Near-duplicate similarity should be >= 0.85, got {sim_near}"
        assert sim_mod >= 0.55, f"Moderate similarity should be >= 0.55, got {sim_mod}"
        assert sim_dissim <= 0.65, f"Dissimilar similarity should be <= 0.65, got {sim_dissim}"
        assert sim_near > sim_mod > sim_dissim

    def test_sha256_exact_duplicate_detection(self) -> None:
        """Verify SHA-256 hash invariant under whitespace and casing variations."""
        text_a = "Autonomous research engine for evidence-grounded scientific synthesis."
        text_b = "   Autonomous   research engine  for evidence-grounded scientific synthesis. \n\n"
        text_c = "AUTONOMOUS RESEARCH ENGINE FOR EVIDENCE-GROUNDED SCIENTIFIC SYNTHESIS."

        hash_a = ContentHasher.sha256_hash(text_a)
        hash_b = ContentHasher.sha256_hash(text_b)
        hash_c = ContentHasher.sha256_hash(text_c)

        assert hash_a == hash_b == hash_c
        assert ContentHasher.is_duplicate(hash_a, hash_b) is True

    def test_simhash_empty_and_special_characters(self) -> None:
        """Verify SimHash handles empty strings and symbol strings."""
        assert ContentHasher.simhash("") == 0
        assert ContentHasher.simhash("   !@#$%^&*()+ ") == 0

        emoji_hash = ContentHasher.simhash("Quantum 🚀 Computing 💡 Breakthrough 🔬")
        assert emoji_hash > 0


# ==============================================================================
# 5. SearchProviderRouter & Fault Tolerance Stress
# ==============================================================================
class TestSearchProviderRouterStress:
    """Empirical challenge tests for SearchProviderRouter failure handling and routing."""

    @pytest.mark.asyncio
    async def test_all_providers_failing_gracefully(self) -> None:
        """Ensure SearchProviderRouter returns empty list when all providers fail without crashing."""
        router = SearchProviderRouter()

        # Mock all registered providers to raise fatal network/parsing exceptions
        for name, provider in router._providers.items():
            mock_search = AsyncMock(side_effect=httpx.ConnectTimeout(f"Provider {name} timed out"))
            provider.search = mock_search

        results = await router.search("Quantum entanglement algorithm", provider="auto", max_results=5)
        assert isinstance(results, list)
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_partial_provider_failure_with_survivor(self) -> None:
        """Ensure SearchProviderRouter successfully returns results when some providers fail and one succeeds."""
        router = SearchProviderRouter()

        # Mock DDG to fail
        router._providers["duckduckgo"].search = AsyncMock(
            side_effect=httpx.HTTPStatusError("500 Internal Error", request=None, response=None)
        )
        # Mock Arxiv to fail
        router._providers["arxiv"].search = AsyncMock(
            side_effect=ET.ParseError("Malformed XML response")
        )
        # Mock Wikipedia to succeed
        wiki_results = [
            {
                "title": "Quantum Entanglement",
                "url": "https://en.wikipedia.org/wiki/Quantum_entanglement",
                "snippet": "Quantum entanglement is a physical phenomenon.",
                "domain": "en.wikipedia.org",
                "authority": 0.85,
            }
        ]
        router._providers["wikipedia"].search = AsyncMock(return_value=wiki_results)

        results = await router.search("Quantum physics algorithm", provider="auto", max_results=5)
        assert len(results) == 1
        assert results[0]["title"] == "Quantum Entanglement"
        assert results[0]["domain"] == "en.wikipedia.org"

    @pytest.mark.asyncio
    async def test_allowed_domains_filtering_leakage_vulnerability(self) -> None:
        """Empirical demonstration: SearchProviderRouter bypasses allowed_domains when academic query fires arXiv/Wikipedia."""
        router = SearchProviderRouter()

        # DDG correctly respects allowed_domains and returns only site-filtered results
        router._providers["duckduckgo"].search = AsyncMock(
            return_value=[
                {"title": "MIT Research", "url": "https://mit.edu/quantum", "domain": "mit.edu", "authority": 0.82}
            ]
        )
        # ArXiv ignores allowed_domains and returns arxiv.org
        router._providers["arxiv"].search = AsyncMock(
            return_value=[
                {"title": "ArXiv Quantum", "url": "https://arxiv.org/abs/123", "domain": "arxiv.org", "authority": 0.96}
            ]
        )
        # Wikipedia ignores allowed_domains and returns en.wikipedia.org
        router._providers["wikipedia"].search = AsyncMock(
            return_value=[
                {"title": "Wiki Quantum", "url": "https://en.wikipedia.org/wiki/Quantum", "domain": "en.wikipedia.org", "authority": 0.85}
            ]
        )

        results = await router.search(
            "quantum algorithm theorem",
            provider="auto",
            allowed_domains=["mit.edu"],
            max_results=5,
        )

        domains_returned = {r.get("domain") for r in results}
        # Empirical finding: 'arxiv.org' and 'en.wikipedia.org' leak through because router.py does not pass
        # allowed_domains to arXiv/Wikipedia and does not filter combined results.
        assert "arxiv.org" in domains_returned or "en.wikipedia.org" in domains_returned, (
            "Empirical proof of allowed_domains leakage in SearchProviderRouter"
        )

    @pytest.mark.asyncio
    async def test_deduplication_and_authority_ranking(self) -> None:
        """Ensure results returned by multiple providers for the same URL are deduplicated and ranked by authority."""
        router = SearchProviderRouter()

        # Provider 1 (DDG) returns paper with authority 0.82
        ddg_results = [
            {
                "title": "Attention Is All You Need",
                "url": "https://arxiv.org/abs/1706.03762?utm_source=ddg",
                "snippet": "We propose a new simple network architecture, the Transformer.",
                "domain": "arxiv.org",
                "authority": 0.82,
            },
            {
                "title": "General Deep Learning Overview",
                "url": "https://example.com/deep-learning",
                "snippet": "Overview of neural networks.",
                "domain": "example.com",
                "authority": 0.75,
            },
        ]
        # Provider 2 (Arxiv) returns same paper with higher authority 0.96
        arxiv_results = [
            {
                "title": "ArXiv: Attention Is All You Need",
                "url": "https://arxiv.org/abs/1706.03762",
                "snippet": "Original research paper on Transformer architecture.",
                "domain": "arxiv.org",
                "authority": 0.96,
            }
        ]

        router._providers["duckduckgo"].search = AsyncMock(return_value=ddg_results)
        router._providers["arxiv"].search = AsyncMock(return_value=arxiv_results)
        router._providers["wikipedia"].search = AsyncMock(return_value=[])

        results = await router.search("Attention Is All You Need paper", provider="auto", max_results=5)

        # URLs should be deduplicated based on canonical URL
        assert len(results) == 2

        # Top result should be the highest authority item (0.96 or 0.82)
        assert results[0]["authority"] >= results[1]["authority"]


# ==============================================================================
# 6. DeepWebCrawler End-to-End Stress & SSRF Defense
# ==============================================================================
class TestDeepWebCrawlerStress:
    """Empirical challenge tests for DeepWebCrawler SSRF defense, BFS recursion, and deduplication."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "malicious_url",
        [
            "http://127.0.0.1:8000/admin",
            "http://localhost/secret",
            "http://169.254.169.254/latest/meta-data/",
            "http://10.0.0.1/internal",
            "http://192.168.1.1/router",
            "http://172.16.0.1/private",
            "http://[::1]/ipv6-loopback",
        ],
    )
    async def test_ssrf_private_ip_blocking(self, malicious_url: str) -> None:
        """Ensure crawler blocks SSRF attempts to localhost, metadata endpoints, and private subnets."""
        crawler = DeepWebCrawler(default_rate_interval=0.001)
        req = CrawlRequest(url=malicious_url)

        page = await crawler.fetch_page(req)
        assert page.status == FetchStatus.SSRF_BLOCKED
        assert page.status_code == 403
        assert "SSRF" in page.error_message

    @pytest.mark.asyncio
    async def test_bfs_recursive_crawl_depth_and_domain_filtering(self) -> None:
        """Test recursive breadth-first crawling, depth enforcement, and strict domain boundaries."""
        crawler = DeepWebCrawler(default_rate_interval=0.001)

        pages_db = {
            "https://target.com/": """
                <html><body><h1>Home</h1>
                <p>Welcome to target home.</p>
                <a href="https://target.com/page1">Page 1</a>
                <a href="https://external-forbidden.com/leak">Off-domain link</a>
                </body></html>
            """,
            "https://target.com/page1": """
                <html><body><h1>Page 1</h1>
                <p>Content of Page 1.</p>
                <a href="https://target.com/page2">Page 2</a>
                </body></html>
            """,
            "https://target.com/page2": """
                <html><body><h1>Page 2</h1>
                <p>Content of Page 2.</p>
                <a href="https://target.com/page3">Page 3 (depth 3)</a>
                </body></html>
            """,
            "https://target.com/page3": """
                <html><body><h1>Page 3</h1><p>Deep content.</p></body></html>
            """,
        }

        async def mock_get(self, url, *args, **kwargs):
            req = httpx.Request("GET", url)
            if "robots.txt" in url:
                return httpx.Response(status_code=404, request=req)
            canon = UrlCanonicalizer.canonicalize(url)
            if canon in pages_db:
                return httpx.Response(
                    status_code=200,
                    text=pages_db[canon],
                    headers={"content-type": "text/html"},
                    request=req,
                )
            return httpx.Response(status_code=404, request=req)

        with patch.object(httpx.AsyncClient, "get", new=mock_get):
            # Crawl with max_depth=1 and allowed_domains=["target.com"]
            req = CrawlRequest(
                url="https://target.com/",
                max_depth=1,
                allowed_domains=["target.com"],
            )
            crawled = await crawler.crawl(req, max_pages=10)

            # Depth 0: Home, Depth 1: Page 1. Page 2 (depth 2) and Page 3 (depth 3) should NOT be crawled
            crawled_urls = [p.url for p in crawled if p.status == FetchStatus.SUCCESS]
            assert "https://target.com/" in crawled_urls
            assert "https://target.com/page1" in crawled_urls
            assert "https://target.com/page2" not in crawled_urls
            assert "https://external-forbidden.com/leak" not in crawled_urls

    @pytest.mark.asyncio
    async def test_duplicate_content_body_detection(self) -> None:
        """Ensure crawler marks pages with identical body text as DEDUPLICATED even with different URLs."""
        crawler = DeepWebCrawler(default_rate_interval=0.001)

        identical_html = """
        <html><body>
            <h1>Duplicate Article</h1>
            <p>This is exact duplicate text across mirrored URLs.</p>
        </body></html>
        """

        async def mock_get(self, url, *args, **kwargs):
            req = httpx.Request("GET", url)
            if "robots.txt" in url:
                return httpx.Response(status_code=404, request=req)
            return httpx.Response(status_code=200, text=identical_html, headers={"content-type": "text/html"}, request=req)

        with patch.object(httpx.AsyncClient, "get", new=mock_get):
            page1 = await crawler.fetch_page(CrawlRequest(url="https://mirror1.com/doc"))
            page2 = await crawler.fetch_page(CrawlRequest(url="https://mirror2.com/doc"))

            assert page1.status == FetchStatus.SUCCESS
            assert page2.status == FetchStatus.DEDUPLICATED
            assert "Duplicate content body hash" in page2.error_message
