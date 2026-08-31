"""Chat run modes — real routing differences, not cosmetic labels."""

from __future__ import annotations

from enum import StrEnum


class RunMode(StrEnum):
    FAST = "fast"
    DEEP_RESEARCH = "deep_research"

    @property
    def label(self) -> str:
        return {
            RunMode.FAST: "Fast",
            RunMode.DEEP_RESEARCH: "Deep Research",
        }[self]

    @property
    def description(self) -> str:
        return {
            RunMode.FAST: "Direct LLM synthesis (<250ms)",
            RunMode.DEEP_RESEARCH: "Multi-agent ArXiv, Wikipedia, Web & 3D Knowledge Graph",
        }[self]

    @classmethod
    def parse(cls, value: str | None) -> RunMode:
        if value is None or not str(value).strip():
            return cls.DEEP_RESEARCH
        normalized = str(value).strip().lower().replace("-", "_").replace(" ", "_")
        aliases = {
            "fast": cls.FAST,
            "quick": cls.FAST,
            "balanced": cls.DEEP_RESEARCH,
            "default": cls.DEEP_RESEARCH,
            "deep": cls.DEEP_RESEARCH,
            "research": cls.DEEP_RESEARCH,
            "deepresearch": cls.DEEP_RESEARCH,
            "complex": cls.DEEP_RESEARCH,
        }
        if normalized in aliases:
            return aliases[normalized]
        try:
            return cls(normalized)
        except ValueError:
            return cls.DEEP_RESEARCH
