"""DOM content extraction with boilerplate removal and link discovery."""

from __future__ import annotations

import re
import urllib.parse
from typing import Any

from bs4 import BeautifulSoup


class ContentExtractor:
    """Extracts semantic body text, metadata, and outgoing links from HTML documents."""

    _UNWANTED_TAGS: frozenset[str] = frozenset(
        {
            "script",
            "style",
            "nav",
            "footer",
            "header",
            "noscript",
            "aside",
            "form",
            "iframe",
            "svg",
            "button",
            "select",
            "option",
        }
    )

    @classmethod
    def extract(cls, html: str, base_url: str = "") -> dict[str, Any]:
        """Parse raw HTML and extract title, clean text, metadata, and links."""
        if not html or not html.strip():
            return {
                "title": "",
                "extracted_text": "",
                "meta_description": "",
                "author": None,
                "published_date": None,
                "links": [],
            }

        soup = BeautifulSoup(html, "html.parser")

        # 1. Extract metadata
        title = ""
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
        elif soup.find("h1"):
            h1 = soup.find("h1")
            title = h1.get_text().strip() if h1 else ""

        og_title = soup.find("meta", property="og:title")
        if not title and og_title and og_title.get("content"):
            title = str(og_title["content"]).strip()

        meta_desc = ""
        desc_tag = soup.find("meta", attrs={"name": "description"}) or soup.find(
            "meta", property="og:description"
        )
        if desc_tag and desc_tag.get("content"):
            meta_desc = str(desc_tag["content"]).strip()

        author = None
        author_tag = soup.find("meta", attrs={"name": "author"}) or soup.find(
            "meta", property="article:author"
        )
        if author_tag and author_tag.get("content"):
            author = str(author_tag["content"]).strip()

        published_date = None
        pub_tag = (
            soup.find("meta", property="article:published_time")
            or soup.find("meta", attrs={"name": "pubdate"})
            or soup.find("meta", attrs={"name": "date"})
        )
        if pub_tag and pub_tag.get("content"):
            published_date = str(pub_tag["content"]).strip()

        # 2. Extract outgoing links before modifying tree
        links: list[str] = []
        seen_links: set[str] = set()
        for a_tag in soup.find_all("a", href=True):
            raw_href = str(a_tag["href"]).strip()
            if not raw_href or raw_href.startswith(("#", "javascript:", "mailto:", "tel:")):
                continue
            if base_url:
                full_url = urllib.parse.urljoin(base_url, raw_href)
            else:
                full_url = raw_href

            parsed = urllib.parse.urlparse(full_url)
            if parsed.scheme in ("http", "https") and parsed.netloc:
                clean_link = urllib.parse.urldefrag(full_url)[0]
                if clean_link not in seen_links:
                    seen_links.add(clean_link)
                    links.append(clean_link)

        # 3. Strip unwanted boilerplate tags
        for tag in soup.find_all(cls._UNWANTED_TAGS):
            tag.decompose()

        # 4. Extract structured semantic body text
        content_container = (
            soup.find("article")
            or soup.find("main")
            or soup.find("div", attrs={"role": "main"})
            or soup.find("div", class_=re.compile(r"content|post|article|body", re.I))
            or soup.body
            or soup
        )

        text_lines: list[str] = []
        for element in content_container.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "pre"]):
            tag_text = element.get_text().strip()
            if tag_text:
                text_lines.append(tag_text)

        if not text_lines:
            raw_text = content_container.get_text(separator="\n").strip()
            extracted_text = re.sub(r"\n{3,}", "\n\n", raw_text)
        else:
            extracted_text = "\n\n".join(text_lines)

        extracted_text = re.sub(r"[ \t]+", " ", extracted_text).strip()

        return {
            "title": title,
            "extracted_text": extracted_text,
            "meta_description": meta_desc,
            "author": author,
            "published_date": published_date,
            "links": links,
        }
