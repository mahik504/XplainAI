"""Chat run modes — real routing differences, not cosmetic labels."""

from __future__ import annotations

from enum import StrEnum


class RunMode(StrEnum):
    FAST = "fast"
    BALANCED = "balanced"
    DEEP_RESEARCH = "deep_research"

    @property
    def label(self) -> str:
        return {
            RunMode.FAST: "Fast",
            RunMode.BALANCED: "Balanced",
            RunMode.DEEP_RESEARCH: "Deep Research",
        }[self]

    @property
    def description(self) -> str:
        return {
            RunMode.FAST: "Quick answer · minimal research",
            RunMode.BALANCED: "Best default · selective evidence",
            RunMode.DEEP_RESEARCH: "Multi-step research · richer evidence",
        }[self]

    @classmethod
    def parse(cls, value: str | None) -> RunMode:
        if value is None or not str(value).strip():
            return cls.BALANCED
        normalized = str(value).strip().lower().replace("-", "_").replace(" ", "_")
        aliases = {
            "moderate": cls.BALANCED,
            "default": cls.BALANCED,
            "deep": cls.DEEP_RESEARCH,
            "research": cls.DEEP_RESEARCH,
            "deepresearch": cls.DEEP_RESEARCH,
        }
        if normalized in aliases:
            return aliases[normalized]
        try:
            return cls(normalized)
        except ValueError:
            return cls.BALANCED
