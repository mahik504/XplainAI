"""Chat run modes — real routing differences, not cosmetic labels."""

from __future__ import annotations

from enum import StrEnum


class RunMode(StrEnum):
    FAST = "fast"
    BALANCED = "balanced"
    DEEP_RESEARCH = "deep_research"
    COMPLEX = "complex"

    @property
    def label(self) -> str:
        return {
            RunMode.FAST: "Fast",
            RunMode.BALANCED: "Balanced",
            RunMode.DEEP_RESEARCH: "Deep Research",
            RunMode.COMPLEX: "Complex",
        }[self]

    @property
    def description(self) -> str:
        return {
            RunMode.FAST: "Direct LLM synthesis (<250ms)",
            RunMode.BALANCED: "Standard Agentic Search (1-2 sources)",
            RunMode.DEEP_RESEARCH: "Multi-agent ArXiv, Wikipedia, Web & 3D Knowledge Graph",
            RunMode.COMPLEX: "Iterative Deep Web, PDF, YouTube Transcribing, and Advanced Orchestration",
        }[self]

    @classmethod
    def parse(cls, value: str | None) -> RunMode:
        if value is None or not str(value).strip():
            return cls.BALANCED
        normalized = str(value).strip().lower().replace("-", "_").replace(" ", "_")
        aliases = {
            "fast": cls.FAST,
            "quick": cls.FAST,
            "balanced": cls.BALANCED,
            "default": cls.BALANCED,
            "deep": cls.DEEP_RESEARCH,
            "research": cls.DEEP_RESEARCH,
            "deepresearch": cls.DEEP_RESEARCH,
            "complex": cls.COMPLEX,
            "goal": cls.COMPLEX,
        }
        if normalized in aliases:
            return aliases[normalized]
        try:
            return cls(normalized)
        except ValueError:
            return cls.BALANCED
