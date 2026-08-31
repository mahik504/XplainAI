"""Domain source and evidence extraction engine.

Transforms disparate tool payloads and raw search results into typed, deduplicated
domain `Source` and `Evidence` entities.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from neural_navigator.domain.models.research import (
    Evidence,
    Source,
    SourceType,
    generate_id,
)

if TYPE_CHECKING:
    from collections.abc import Sequence

    from neural_navigator.orchestration.tools import ToolResult


def extract_domain_sources_and_evidence(
    tool_results: Sequence[ToolResult],
) -> tuple[list[Source], list[Evidence]]:
    """Transform raw tool results into typed, deduplicated Source and Evidence entities."""
    sources: list[Source] = []
    evidence: list[Evidence] = []
    seen_urls: set[str] = set()

    for tr in tool_results:
        if tr.status != "ok":
            continue

        # Standard tool results format (search, arxiv, wikipedia)
        rows = tr.data.get("results")
        if isinstance(rows, list):
            for row in rows:
                if not isinstance(row, dict):
                    continue
                url = str(row.get("url") or "")
                if url in seen_urls:
                    continue
                if url:
                    seen_urls.add(url)

                src_id = generate_id("src")
                title = str(row.get("title") or "Research Source")
                snippet = str(row.get("snippet") or "")
                domain = str(
                    row.get("domain") or ("wikipedia.org" if "wikipedia" in url else "web")
                )
                authority = float(row.get("authority") or 0.85)

                if "arxiv" in url:
                    source_type = SourceType.PAPER
                elif (
                    "github" in url
                    or "doc" in domain
                    or "doc" in url.lower()
                    or "doc" in title.lower()
                ):
                    source_type = SourceType.DOCUMENTATION
                else:
                    source_type = SourceType.WEB

                src = Source(
                    id=src_id,
                    title=title,
                    url=url,
                    domain=domain,
                    snippet=snippet,
                    source_type=source_type,
                    authority_score=authority,
                )
                sources.append(src)

                if snippet:
                    ev_id = generate_id("evi")
                    ev = Evidence(
                        id=ev_id,
                        source_id=src_id,
                        source_title=title,
                        text=snippet[:300],
                        source_url=url,
                        confidence=authority,
                        relevance_score=authority,
                    )
                    evidence.append(ev)

        # Direct sources from url_ingest tool
        raw_sources = tr.data.get("sources")
        if isinstance(raw_sources, list):
            for s_dict in raw_sources:
                if isinstance(s_dict, dict):
                    url = str(s_dict.get("url") or "")
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        src_id = str(s_dict.get("id") or generate_id("src"))
                        title = str(s_dict.get("title") or "Web Source")
                        snippet = str(s_dict.get("snippet") or "")
                        domain = str(s_dict.get("domain") or "web")
                        authority = float(s_dict.get("authority_score") or 0.88)

                        raw_st = s_dict.get("source_type")
                        if raw_st:
                            try:
                                source_type = SourceType(raw_st)
                            except ValueError:
                                source_type = SourceType.WEB
                        elif "arxiv" in url:
                            source_type = SourceType.PAPER
                        elif (
                            "github" in url
                            or "doc" in domain
                            or "doc" in url.lower()
                            or "doc" in title.lower()
                        ):
                            source_type = SourceType.DOCUMENTATION
                        else:
                            source_type = SourceType.WEB

                        sources.append(
                            Source(
                                id=src_id,
                                title=title,
                                url=url,
                                domain=domain,
                                snippet=snippet,
                                source_type=source_type,
                                authority_score=authority,
                            )
                        )
                        if snippet:
                            evidence.append(
                                Evidence(
                                    id=generate_id("evi"),
                                    source_id=src_id,
                                    source_title=title,
                                    text=snippet[:300],
                                    source_url=url,
                                    confidence=authority,
                                    relevance_score=authority,
                                )
                            )

    return sources, evidence


# Alias for backwards compatibility
_extract_domain_sources_and_evidence = extract_domain_sources_and_evidence
