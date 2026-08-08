"""Structured retrieved-source model (distinct from response evidence markers)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from neural_navigator.orchestration.tools import ToolResult


@dataclass(slots=True)
class RetrievedSource:
    source_id: str
    title: str
    source_type: str
    tool: str
    url: str | None = None
    snippet: str | None = None
    retrieved_at: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "source_id": self.source_id,
            "title": self.title,
            "source_type": self.source_type,
            "tool": self.tool,
            "url": self.url,
            "snippet": self.snippet,
            "retrieved_at": self.retrieved_at,
        }


def _now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def sources_from_tool_results(results: list[ToolResult]) -> list[RetrievedSource]:
    sources: list[RetrievedSource] = []
    for result in results:
        if result.status != "ok":
            continue
        tool = result.tool
        data = result.data
        rows = data.get("results")
        if isinstance(rows, list):
            for row in rows:
                if not isinstance(row, dict):
                    continue
                title = str(row.get("title") or "Source").strip() or "Source"
                sources.append(
                    RetrievedSource(
                        source_id=f"src_{uuid4().hex[:10]}",
                        title=title[:160],
                        url=str(row.get("url") or "") or None,
                        source_type="news" if tool == "news" else "web",
                        tool=tool,
                        snippet=str(row.get("snippet") or "")[:400] or None,
                        retrieved_at=_now(),
                    )
                )
            continue
        if tool == "weather":
            sources.append(
                RetrievedSource(
                    source_id=f"src_{uuid4().hex[:10]}",
                    title=result.summary[:160],
                    source_type="weather",
                    tool=tool,
                    snippet=result.summary,
                    retrieved_at=_now(),
                )
            )
        elif tool == "calculator":
            sources.append(
                RetrievedSource(
                    source_id=f"src_{uuid4().hex[:10]}",
                    title=result.summary[:160],
                    source_type="calculator",
                    tool=tool,
                    snippet=result.summary,
                    retrieved_at=_now(),
                )
            )
    return sources
