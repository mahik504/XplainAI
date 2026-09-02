"""Structured claim extraction and epistemic mapping agent."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

from neural_navigator.domain.models.research import Claim, ClaimStatus, Evidence, generate_id

if TYPE_CHECKING:
    from collections.abc import Sequence

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")
_STOPWORDS = frozenset(
    {
        "the", "a", "an", "is", "are", "was", "were", "and", "or", "in", "on", "at",
        "to", "for", "of", "with", "by", "from", "as", "that", "this", "these", "those",
        "it", "its", "they", "their", "we", "our", "you", "your", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "can", "could", "will", "would", "should",
    }
)


def _tokenize_text(text: str) -> set[str]:
    words = re.findall(r"\b[a-z0-9_-]{3,}\b", text.lower())
    return {w for w in words if w not in _STOPWORDS}


class ClaimExtractor:
    """Decomposes synthesized text into atomic factual propositions mapped to evidence."""

    @classmethod
    def extract_claims(
        cls,
        text: str,
        evidence: Sequence[Evidence],
    ) -> list[Claim]:
        """Extract atomic factual claims and evaluate grounding against evidence."""
        cleaned_text = text.strip()
        if not cleaned_text:
            return []

        sentences = [s.strip() for s in _SENTENCE_SPLIT_RE.split(cleaned_text) if len(s.strip()) > 8]
        if not sentences and cleaned_text:
            sentences = [cleaned_text]

        claims: list[Claim] = []

        for idx, sentence in enumerate(sentences):
            clean_sentence = re.sub(r"\[(?:source:\s*)?\d+\]", "", sentence).strip()
            if len(clean_sentence) < 5:
                continue

            sentence_tokens = _tokenize_text(clean_sentence)

            importance = "medium"
            if idx == 0 or any(w in clean_sentence.lower() for w in ("conclude", "primary", "fundamentally", "key finding", "demonstrates")):
                importance = "core"
            elif any(char.isdigit() for char in clean_sentence) or any(w in clean_sentence.lower() for w in ("percent", "million", "billion", "increase", "decrease", "benchmark")):
                importance = "high"
            elif len(clean_sentence) < 30:
                importance = "low"

            matched_evidence_ids: list[str] = []
            best_confidence = 0.5

            for ev in evidence:
                ev_tokens = _tokenize_text(ev.text)
                if not ev_tokens or not sentence_tokens:
                    continue

                overlap = len(sentence_tokens & ev_tokens)
                if overlap >= 2:
                    matched_evidence_ids.append(ev.id)
                    overlap_ratio = overlap / max(1, len(sentence_tokens))
                    ev_conf = ev.confidence * min(1.0, 0.5 + overlap_ratio)
                    if ev_conf > best_confidence:
                        best_confidence = ev_conf

            if matched_evidence_ids:
                status = ClaimStatus.SUPPORTED if best_confidence >= 0.65 else ClaimStatus.WEAKLY_SUPPORTED
            else:
                status = ClaimStatus.UNVERIFIED
                best_confidence = 0.45

            claims.append(
                Claim(
                    id=generate_id("clm"),
                    text=clean_sentence,
                    status=status,
                    evidence_ids=matched_evidence_ids,
                    confidence=round(best_confidence, 2),
                    importance=importance,
                    sentence_index=idx,
                )
            )

        return claims
