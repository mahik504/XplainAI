"""Unit and integration tests for Deep Web Crawler subsystem."""

from unittest.mock import AsyncMock, patch
import httpx
import pytest

from neural_navigator.infrastructure.crawler.base import CrawlRequest, FetchStatus
from neural_navigator.infrastructure.crawler.crawler import DeepWebCrawler
from neural_navigator.infrastructure.crawler.dedup import ContentHasher, UrlCanonicalizer
from neural_navigator.infrastructure.crawler.extractor import ContentExtractor
from neural_navigator.infrastructure.crawler.rate_limiter import DomainRateLimiter
from neural_navigator.infrastructure.crawler.robots import RobotsTxtParser
from neural_navigator.infrastructure.crawler.providers.ddg import DuckDuckGoSearchProvider
from neural_navigator.infrastructure.crawler.providers.arxiv import ArxivSearchProvider
from neural_navigator.infrastructure.crawler.providers.wikipedia import WikipediaSearchProvider
from neural_navigator.infrastructure.crawler.providers.google import GoogleSearchProvider
from neural_navigator.infrastructure.crawler.providers.router import SearchProviderRouter


def test_url_canonicalizer() -> None:
    raw_url = "HTTP://Example.COM:80/path/to/page/?utm_source=twitter&b=2&a=1&fbclid=xyz#section"
    canon = UrlCanonicalizer.canonicalize(raw_url)
    assert canon == "http://example.com/path/to/page/?a=1&b=2"

    raw_https = "https://sub.domain.org:443/api//v1/../v2/endpoint/?utm_campaign=spring&q=search"
    canon_https = UrlCanonicalizer.canonicalize(raw_https)
    assert canon_https == "https://sub.domain.org/api/v2/endpoint/?q=search"

    hash_val = UrlCanonicalizer.url_hash(raw_url)
    assert isinstance(hash_val, str) and len(hash_val) == 64


def test_content_hasher_and_simhash() -> None:
    text1 = "Deep neural networks are artificial intelligence models that process multimodal data."
    text2 = "Deep neural networks are artificial intelligence models that process multimodal data."
    text3 = "Deep neural networks are AI models that process multimodal inputs."

    hash1 = ContentHasher.sha256_hash(text1)
    hash2 = ContentHasher.sha256_hash(text2)
    hash3 = ContentHasher.sha256_hash(text3)

    assert hash1 == hash2
    assert hash1 != hash3
    assert ContentHasher.is_duplicate(hash1, hash2) is True
    assert ContentHasher.is_duplicate(hash1, hash3) is False

    sim1 = ContentHasher.simhash(text1)
    sim3 = ContentHasher.simhash(text3)
    similarity = ContentHasher.simhash_similarity(sim1, sim3)
    assert 0.6 <= similarity <= 1.0


def test_content_extractor() -> None:
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Quantum Computing Breakthrough</title>
        <meta name="description" content="A comprehensive analysis of fault-tolerant quantum computing.">
        <meta name="author" content="Dr. Jane Doe">
    </head>
    <body>
        <nav><a href="/home">Home</a><a href="/about">About</a></nav>
        <article>
            <h1>Quantum Computing Breakthrough</h1>
            <p>Fault-tolerant quantum processors have achieved a critical threshold.</p>
            <p>Logical qubits demonstrated lower error rates than physical qubits.</p>
            <a href="https://example.com/paper.pdf">Read Full Paper</a>
        </article>
        <footer><p>Copyright 2026</p></footer>
    </body>
    </html>
    """
    extracted = ContentExtractor.extract(html, base_url="https://example.com/article")
    assert extracted["title"] == "Quantum Computing Breakthrough"
    assert "Fault-tolerant quantum processors" in extracted["extracted_text"]
    assert "Home" not in extracted["extracted_text"]
    assert "Copyright 2026" not in extracted["extracted_text"]
    assert extracted["author"] == "Dr. Jane Doe"
    assert "https://example.com/paper.pdf" in extracted["links"]


@pytest.mark.asyncio
async def test_robots_txt_parser_allowed_and_disallowed() -> None:
    parser = RobotsTxtParser(user_agent="XplainAI-Bot/2.2")

    robots_content = """User-agent: *
Disallow: /private/
Disallow: /admin/
Crawl-delay: 2
"""
    mock_resp = httpx.Response(
        status_code=200,
        text=robots_content,
        request=httpx.Request("GET", "https://allowed-domain.org/robots.txt"),
    )

    with patch.object(httpx.AsyncClient, "get", new=AsyncMock(return_value=mock_resp)):
        allowed, delay = await parser.can_fetch("https://allowed-domain.org/public/page")
        assert allowed is True
        assert delay == 2.0

        disallowed, delay = await parser.can_fetch("https://allowed-domain.org/private/secret")
        assert disallowed is False


@pytest.mark.asyncio
async def test_domain_rate_limiter() -> None:
    limiter = DomainRateLimiter(default_interval=0.01)
    await limiter.acquire("example.com")
    await limiter.acquire("example.com", min_delay=0.02)
    limiter.reset()


@pytest.mark.asyncio
async def test_deep_web_crawler_fetch_and_crawl() -> None:
    crawler = DeepWebCrawler(default_rate_interval=0.001)

    html_root = """
    <html>
    <head><title>Root Page</title></head>
    <body>
        <h1>Root Overview</h1>
        <p>This is the root page content.</p>
        <a href="https://example.com/subpage">Subpage Link</a>
    </body>
    </html>
    """
    html_sub = """
    <html>
    <head><title>Subpage</title></head>
    <body>
        <h1>Subpage Title</h1>
        <p>Detailed subpage analysis text.</p>
    </body>
    </html>
    """

    async def mock_get(self, url, *args, **kwargs):
        req = httpx.Request("GET", url)
        if "robots.txt" in url:
            return httpx.Response(status_code=404, request=req)
        elif "/subpage" in url:
            return httpx.Response(status_code=200, text=html_sub, headers={"content-type": "text/html"}, request=req)
        else:
            return httpx.Response(status_code=200, text=html_root, headers={"content-type": "text/html"}, request=req)

    with patch.object(httpx.AsyncClient, "get", new=mock_get):
        req = CrawlRequest(url="https://example.com/", max_depth=1)
        pages = await crawler.crawl(req, max_pages=5)

        assert len(pages) == 2
        assert pages[0].status == FetchStatus.SUCCESS
        assert pages[0].title == "Root Page"
        assert pages[1].status == FetchStatus.SUCCESS
        assert pages[1].title == "Subpage"


@pytest.mark.asyncio
async def test_search_providers_and_router() -> None:
    router = SearchProviderRouter()
    ddg = router.get_provider("duckduckgo")
    arxiv = router.get_provider("arxiv")
    wiki = router.get_provider("wikipedia")

    assert isinstance(ddg, DuckDuckGoSearchProvider)
    assert isinstance(arxiv, ArxivSearchProvider)
    assert isinstance(wiki, WikipediaSearchProvider)

    # Test auto routing
    results = await router.search("Quantum physics entanglement theorem", max_results=3)
    assert isinstance(results, list)
