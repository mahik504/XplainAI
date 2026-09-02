"""Mapping retrieved DocumentChunk and SearchResult items to domain Evidence and Source entities."""

from __future__ import annotations

from urllib.parse import urlparse

from neural_navigator.domain.models.research import (
    Evidence,
    Source,
    SourceType,
    generate_id,
)
from neural_navigator.infrastructure.vectorstore.base import SearchResult


def search_results_to_evidence_and_sources(
    results: list[SearchResult],
) -> tuple[list[Source], list[Evidence]]:
    """Convert a ranked list of SearchResult items into domain Source and Evidence collections."""
    sources_map: dict[str, Source] = {}
    evidence_list: list[Evidence] = []

    for res in results:
        chunk = res.chunk
        source_url = chunk.source_url or "urn:doc:" + chunk.document_id
        parsed_url = urlparse(source_url)
        domain = parsed_url.netloc or "document"

        src_id = chunk.source_id or f"src_{hash(source_url) & 0xFFFFFFFF:08x}"
        if src_id not in sources_map:
            st = SourceType.PAPER if source_url.endswith(".pdf") else SourceType.WEB
            sources_map[src_id] = Source(
                id=src_id,
                title=chunk.title,
                url=source_url,
                domain=domain,
                snippet=chunk.content[:200],
                source_type=st,
                authority_score=0.85,
            )

        evi_id = (
            f"evi_{chunk.id.removeprefix('chk_')}"
            if chunk.id.startswith("chk_")
            else generate_id("evi")
        )
        evidence_item = Evidence(
            id=evi_id,
            source_id=src_id,
            source_title=chunk.title,
            source_url=source_url,
            text=chunk.content,
            confidence=max(0.1, min(1.0, float(res.score))),
            relevance_score=max(0.1, min(1.0, float(res.score))),
            char_start=chunk.char_start,
            char_end=chunk.char_end,
        )
        evidence_list.append(evidence_item)

    return list(sources_map.values()), evidence_list
