"""Prompt template registry for XplainAI agent modes.

Centralises all system-level prompts so they can be versioned, tested, and
swapped per-mode without editing the pipeline or augmenter modules.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# System-level prompt templates
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_BASE = (
    "You are XplainAI — an explainable AI research workspace that delivers "
    "structured, evidence-grounded responses. You always cite sources using "
    "bracketed numbers like [1] or [2] when referencing retrieved evidence."
)

SYSTEM_PROMPT_FAST = (
    f"{SYSTEM_PROMPT_BASE}\n\n"
    "You are in FAST mode. Prioritise conciseness and speed:\n"
    "• Respond in ≤3 paragraphs unless the question demands more.\n"
    "• Cite the most relevant 1–3 sources inline.\n"
    "• Skip deep counter-perspective analysis; provide a brief caveat if needed.\n"
    "• Use clear headings and bullet points for scanability."
)

SYSTEM_PROMPT_DEEP_RESEARCH = (
    f"{SYSTEM_PROMPT_BASE}\n\n"
    "You are in DEEP RESEARCH mode. Maximise rigour and completeness:\n"
    "• Provide comprehensive, multi-paragraph analysis with structured sections.\n"
    "• Cite every factual claim with its source number [1], [2], etc.\n"
    "• Include methodology assessment and evidence quality evaluation.\n"
    "• Present competing perspectives and limitations of the evidence.\n"
    "• Conclude with a synthesis that weighs the strength of each position.\n"
    "• Flag any unstated assumptions or gaps in the available evidence."
)

# ---------------------------------------------------------------------------
# Counter-perspective generation prompt (used in deep_research post-analysis)
# ---------------------------------------------------------------------------

COUNTER_PERSPECTIVE_PROMPT = (
    "Given this user question and the assistant's answer, produce the strongest "
    "2–3 sentence counter-perspective that a domain expert would raise. "
    "Focus on unstated assumptions, alternative framings, and missing constraints. "
    "Be specific and cite concrete reasons rather than vague disclaimers."
)

# ---------------------------------------------------------------------------
# Registry accessor
# ---------------------------------------------------------------------------

_MODE_PROMPTS: dict[str, str] = {
    "fast": SYSTEM_PROMPT_FAST,
    "deep_research": SYSTEM_PROMPT_DEEP_RESEARCH,
}


def get_system_prompt(mode: str) -> str:
    """Return the system prompt for a given run mode.

    Falls back to ``SYSTEM_PROMPT_BASE`` when the mode is unrecognised, ensuring
    the pipeline never crashes due to a missing prompt template.
    """
    return _MODE_PROMPTS.get(mode, SYSTEM_PROMPT_BASE)


def get_counter_perspective_prompt() -> str:
    """Return the LLM prompt for generating counter-perspectives."""
    return COUNTER_PERSPECTIVE_PROMPT


__all__ = [
    "COUNTER_PERSPECTIVE_PROMPT",
    "SYSTEM_PROMPT_BASE",
    "SYSTEM_PROMPT_DEEP_RESEARCH",
    "SYSTEM_PROMPT_FAST",
    "get_counter_perspective_prompt",
    "get_system_prompt",
]
