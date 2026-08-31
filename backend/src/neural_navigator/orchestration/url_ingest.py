"""Real-World URL & Multi-Platform Web Content Ingestion Engine.

Fetches and extracts clean, sanitized markdown/text from arbitrary links:
- Standard web pages, technical blogs, and documentation
- GitHub repositories, pull requests, and raw source code files
- YouTube video & Shorts metadata / transcript summaries
- Wikipedia and scientific publication preprints
- LinkedIn publicly accessible articles and summaries
"""

from __future__ import annotations

import re
import time
from typing import Any
from urllib.parse import urlparse

import httpx
import structlog

from neural_navigator.domain.models.research import Source, SourceType, generate_id
from neural_navigator.orchestration.tool_registry import (
    is_safe_external_url,
    sanitize_untrusted_content,
)
from neural_navigator.orchestration.tools import ToolResult

_logger = structlog.get_logger("neural_navigator.orchestration.url_ingest")

_URL_EXTRACT_RE = re.compile(r"https?://[^\s<>\"')]+", re.I)
_HTML_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)
_HTML_BODY_RE = re.compile(r"<body[^>]*>(.*?)</body>", re.I | re.S)
_HTML_TAG_CLEAN_RE = re.compile(
    r"<script[^>]*>.*?</script>|<style[^>]*>.*?</style>|<[^>]+>",
    re.I | re.S,
)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 XplainAI/2.1"
)


def extract_urls_from_text(text: str) -> list[str]:
    """Finds all HTTP/HTTPS links in a user inquiry."""
    raw_urls = _URL_EXTRACT_RE.findall(text)
    valid_urls: list[str] = []
    for u in raw_urls:
        cleaned = u.rstrip(".,;!?:)]}'\"")
        if is_safe_external_url(cleaned) and cleaned not in valid_urls:
            valid_urls.append(cleaned)
    return valid_urls


async def fetch_and_parse_url(url: str, timeout_seconds: float = 8.0) -> ToolResult:
    """Fetches a URL and extracts clean textual content, handling specialized platforms."""
    started = time.perf_counter() * 1000

    if not is_safe_external_url(url):
        completed = time.perf_counter() * 1000
        return ToolResult(
            tool="url_ingest",
            status="error",
            started_ms=started,
            completed_ms=completed,
            duration_ms=round(completed - started, 2),
            summary=f"URL '{url}' blocked by SSRF safety filter",
            data={"error": "unsafe_url", "url": url},
        )

    parsed = urlparse(url)
    domain = parsed.netloc.lower()

    # Specialized Handler 1: GitHub Repositories
    if "github.com" in domain:
        return await _handle_github_url(url, parsed, started, timeout_seconds)

    # Specialized Handler 2: YouTube Videos & Shorts
    if "youtube.com" in domain or "youtu.be" in domain:
        return await _handle_youtube_url(url, parsed, started, timeout_seconds)

    # Specialized Handler 3: PDF Documents
    if url.lower().endswith(".pdf") or parsed.path.lower().endswith(".pdf"):
        return await _handle_pdf_url(url, parsed, started, timeout_seconds)

    # General Web & Documentation Scraper
    try:
        async with httpx.AsyncClient(
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,text/plain",
            },
            follow_redirects=True,
            timeout=timeout_seconds,
        ) as client:
            resp = await client.get(url)
            completed = time.perf_counter() * 1000

            if resp.status_code != 200:
                return ToolResult(
                    tool="url_ingest",
                    status="error",
                    started_ms=started,
                    completed_ms=completed,
                    duration_ms=round(completed - started, 2),
                    summary=f"Failed to fetch {url} (HTTP {resp.status_code})",
                    data={"url": url, "status_code": resp.status_code},
                )

            html = resp.text
            title_match = _HTML_TITLE_RE.search(html)
            title = title_match.group(1).strip() if title_match else parsed.netloc

            # Strip scripts, styles, tags
            text_body = _HTML_TAG_CLEAN_RE.sub(" ", html)
            text_body = re.sub(r"\s+", " ", text_body).strip()
            sanitized = sanitize_untrusted_content(text_body, max_chars=3500)

            source_type = SourceType.DOCUMENTATION if "doc" in domain else SourceType.WEB
            source = Source(
                id=generate_id("src"),
                title=title[:120],
                url=url,
                domain=parsed.netloc,
                source_type=source_type,
                snippet=sanitized[:400],
                authority_score=0.88,
            )

            return ToolResult(
                tool="url_ingest",
                status="ok",
                started_ms=started,
                completed_ms=completed,
                duration_ms=round(completed - started, 2),
                summary=f"Ingested content from {url} ({len(sanitized)} chars)",
                data={
                    "url": url,
                    "title": title,
                    "domain": parsed.netloc,
                    "content": sanitized,
                    "sources": [source.as_dict()],
                },
            )
    except Exception as exc:
        completed = time.perf_counter() * 1000
        _logger.warning("url_ingest.failed", url=url, error=str(exc))
        return ToolResult(
            tool="url_ingest",
            status="error",
            started_ms=started,
            completed_ms=completed,
            duration_ms=round(completed - started, 2),
            summary=f"Error accessing {url}: {exc}",
            data={"url": url, "error": str(exc)},
        )


async def _handle_github_url(
    url: str,
    parsed: Any,
    started: float,
    timeout_seconds: float,
) -> ToolResult:
    """Extracts metadata, description, and README from GitHub repository links."""
    path_parts = [p for p in parsed.path.split("/") if p]
    if len(path_parts) >= 2:
        owner, repo = path_parts[0], path_parts[1]
        raw_readme_url = f"https://raw.githubusercontent.com/{owner}/{repo}/main/README.md"
        api_repo_url = f"https://api.github.com/repos/{owner}/{repo}"

        async with httpx.AsyncClient(
            headers={"User-Agent": USER_AGENT, "Accept": "application/vnd.github.v3+json"},
            follow_redirects=True,
            timeout=timeout_seconds,
        ) as client:
            repo_data: dict[str, Any] = {}
            readme_text = ""

            try:
                repo_resp = await client.get(api_repo_url)
                if repo_resp.status_code == 200:
                    repo_data = repo_resp.json()
            except Exception as exc:
                _logger.debug("url_ingest.github_api_failed", error=str(exc))

            try:
                readme_resp = await client.get(raw_readme_url)
                if readme_resp.status_code == 200:
                    readme_text = readme_resp.text
                elif readme_resp.status_code == 404:
                    alt_readme = await client.get(
                        f"https://raw.githubusercontent.com/{owner}/{repo}/master/README.md"
                    )
                    if alt_readme.status_code == 200:
                        readme_text = alt_readme.text
            except Exception as exc:
                _logger.debug("url_ingest.github_readme_failed", error=str(exc))

            completed = time.perf_counter() * 1000
            desc = repo_data.get("description") or f"GitHub repository for {owner}/{repo}"
            stars = repo_data.get("stargazers_count", 0)
            lang = repo_data.get("language") or "Code"

            sanitized_readme = sanitize_untrusted_content(readme_text, max_chars=10000)
            summary_content = (
                f"GitHub Repo: {owner}/{repo} (⭐️ {stars} | {lang})\n"
                f"Description: {desc}\n\nREADME Summary:\n{sanitized_readme}"
            )

            source = Source(
                id=generate_id("src"),
                title=f"GitHub: {owner}/{repo} ({lang})",
                url=url,
                domain="github.com",
                source_type=SourceType.DOCUMENTATION,
                snippet=desc,
                authority_score=0.92,
            )

            return ToolResult(
                tool="url_ingest",
                status="ok",
                started_ms=started,
                completed_ms=completed,
                duration_ms=round(completed - started, 2),
                summary=f"Ingested GitHub repository {owner}/{repo}",
                data={
                    "url": url,
                    "title": f"{owner}/{repo}",
                    "stars": stars,
                    "language": lang,
                    "content": summary_content,
                    "sources": [source.as_dict()],
                },
            )

    return await _handle_general_fallback(url, parsed, started, timeout_seconds)

async def _handle_pdf_url(
    url: str,
    parsed: Any,
    started: float,
    timeout_seconds: float,
) -> ToolResult:
    """Downloads and extracts text from a PDF file."""
    try:
        import fitz
        import asyncio
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=timeout_seconds, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            
            def _extract_pdf(data: bytes) -> str:
                doc = fitz.open(stream=data, filetype="pdf")
                text = ""
                for page in doc:
                    text += page.get_text() + "\n"
                return text
                
            pdf_text = await asyncio.to_thread(_extract_pdf, resp.content)
            sanitized = sanitize_untrusted_content(pdf_text, max_chars=15000)
            
            title = url.split("/")[-1] or "PDF Document"
            completed = time.perf_counter() * 1000
            
            source = Source(
                id=generate_id("src"),
                title=title,
                url=url,
                domain=parsed.netloc,
                source_type=SourceType.DOCUMENTATION,
                snippet=sanitized[:400],
                authority_score=0.90,
            )
            
            return ToolResult(
                tool="url_ingest",
                status="ok",
                started_ms=started,
                completed_ms=completed,
                duration_ms=round(completed - started, 2),
                summary=f"Ingested PDF {title} ({len(sanitized)} chars)",
                data={
                    "url": url,
                    "title": title,
                    "domain": parsed.netloc,
                    "content": sanitized,
                    "sources": [source.as_dict()],
                },
            )
    except Exception as exc:
        _logger.warning("url_ingest.pdf_failed", url=url, error=str(exc))
        return await _handle_general_fallback(url, parsed, started, timeout_seconds)

async def _handle_youtube_url(
    url: str,
    parsed: Any,
    started: float,
    timeout_seconds: float,
) -> ToolResult:
    """Fetches video metadata and full transcript for YouTube videos."""
    video_id = ""
    if "youtu.be" in parsed.netloc:
        video_id = parsed.path.strip("/")
    elif "watch" in parsed.path:
        from urllib.parse import parse_qsl
        q = parsed.query
        params = dict(parse_qsl(q))
        video_id = params.get("v", "")
    elif "shorts" in parsed.path:
        parts = [p for p in parsed.path.split("/") if p]
        if len(parts) >= 2:
            video_id = parts[1]

    if not video_id:
        return await _handle_general_fallback(url, parsed, started, timeout_seconds)

    # Fetch oEmbed public metadata
    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    title, author = f"YouTube Video ({video_id})", "YouTube Creator"
    
    try:
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=timeout_seconds) as client:
            resp = await client.get(oembed_url)
            if resp.status_code == 200:
                data = resp.json()
                title = data.get("title", title)
                author = data.get("author_name", author)
    except Exception:
        pass

    # Extract Transcript
    transcript_text = ""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        import asyncio
        
        def _get_transcript():
            ts = YouTubeTranscriptApi.get_transcript(video_id)
            return " ".join([item['text'] for item in ts])
            
        transcript_text = await asyncio.to_thread(_get_transcript)
        transcript_text = sanitize_untrusted_content(transcript_text, max_chars=15000)
    except Exception as exc:
        _logger.debug("url_ingest.youtube_transcript_failed", error=str(exc))
        transcript_text = "Transcript unavailable."

    completed = time.perf_counter() * 1000
    content = f"YouTube Video: '{title}' by {author}\nLink: {url}\nVideo ID: {video_id}\n\nTranscript:\n{transcript_text}"
    source = Source(
        id=generate_id("src"),
        title=f"YouTube: {title} ({author})",
        url=url,
        domain="youtube.com",
        source_type=SourceType.WEB,
        snippet=f"Author: {author} | Title: {title}",
        authority_score=0.85,
    )

    return ToolResult(
        tool="url_ingest",
        status="ok",
        started_ms=started,
        completed_ms=completed,
        duration_ms=round(completed - started, 2),
        summary=f"Ingested YouTube Video: {title}",
        data={
            "url": url,
            "title": title,
            "author": author,
            "content": content,
            "sources": [source.as_dict()],
        },
    )


async def _handle_general_fallback(
    url: str,
    parsed: Any,
    started: float,
    timeout_seconds: float,
) -> ToolResult:
    completed = time.perf_counter() * 1000
    return ToolResult(
        tool="url_ingest",
        status="ok",
        started_ms=started,
        completed_ms=completed,
        duration_ms=round(completed - started, 2),
        summary=f"Referenced link {url}",
        data={"url": url, "domain": parsed.netloc},
    )
