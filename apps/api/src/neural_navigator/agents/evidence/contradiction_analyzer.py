"""Dialectic cross-source contradiction analyzer."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

from neural_navigator.domain.models.research import Claim, Contradiction, Evidence, generate_id

if TYPE_CHECKING:
    from collections.abc import Sequence

_NEGATION_PAIRS: list[tuple[re.Pattern[str], re.Pattern[str]]] = [
    (re.compile(r"\b(increase[s|d]?|rise[s]?|grow[s|th]?|expand[s|ed]?)\b", re.I), re.compile(r"\b(decrease[s|d]?|fall[s]?|drop[s|ped]?|shrink[s]?|decline[s|d]?)\b", re.I)),
    (re.compile(r"\b(effective|successful|superior|better|beneficial)\b", re.I), re.compile(r"\b(ineffective|failed|inferior|worse|detrimental|harmful)\b", re.I)),
    (re.compile(r"\b(proven|verified|confirmed|demonstrated)\b", re.I), re.compile(r"\b(unproven|disproven|refuted|debunked|false)\b", re.I)),
    (re.compile(r"\b(is\s+safe|harmless|non-toxic)\b", re.I), re.compile(r"\b(is\s+unsafe|hazardous|dangerous|toxic)\b", re.I)),
    (re.compile(r"\b(outperform[s|ed]?|beat[s]?|exceed[s|ed]?)\b", re.I), re.compile(r"\b(underperform[s|ed]?|lag[s|ged]?|fall[s]?\s+behind)\b", re.I)),
]


class ContradictionAnalyzer:
    """Dialectic contradiction analyzer evaluating thesis vs antithesis across sources."""

    @classmethod
    def analyze_contradictions(
        cls,
        claims: Sequence[Claim],
        evidence: Sequence[Evidence],
        counter_perspective: str | None = None,
    ) -> list[Contradiction]:
        """Detect cross-source contradictions among evidence and between claims/counter-perspectives."""
        contradictions: list[Contradiction] = []
        seen_pairs: set[tuple[str, str]] = set()

        # 1. Pairwise Evidence vs Evidence dialectic comparison
        evidence_by_source: dict[str, list[Evidence]] = {}
        for ev in evidence:
            evidence_by_source.setdefault(ev.source_id, []).append(ev)

        source_ids = list(evidence_by_source.keys())
        for i in range(len(source_ids)):
            for j in range(i + 1, len(source_ids)):
                evs_a = evidence_by_source[source_ids[i]]
                evs_b = evidence_by_source[source_ids[j]]

                for ea in evs_a:
                    for eb in evs_b:
                        pair_key = tuple(sorted([ea.id, eb.id]))
                        if pair_key in seen_pairs:
                            continue

                        for pos_pattern, neg_pattern in _NEGATION_PAIRS:
                            a_pos = bool(pos_pattern.search(ea.text))
                            a_neg = bool(neg_pattern.search(ea.text))
                            b_pos = bool(pos_pattern.search(eb.text))
                            b_neg = bool(neg_pattern.search(eb.text))

                            if (a_pos and b_neg) or (a_neg and b_pos):
                                seen_pairs.add(pair_key)
                                matched_claim_id = ""
                                for clm in claims:
                                    if ea.id in clm.evidence_ids or eb.id in clm.evidence_ids:
                                        matched_claim_id = clm.id
                                        break
                                if not matched_claim_id and claims:
                                    matched_claim_id = claims[0].id

                                severity = "critical" if any(c.id == matched_claim_id and c.importance == "core" for c in claims) else "moderate"

                                contradictions.append(
                                    Contradiction(
                                        id=generate_id("con"),
                                        claim_id=matched_claim_id or generate_id("clm"),
                                        evidence_a_id=ea.id,
                                        evidence_b_id=eb.id,
                                        explanation=f"Conflicting findings between {ea.source_title} and {eb.source_title}: polarity divergence on key assertion.",
                                        severity=severity,
                                        contradiction_type="direct_negation",
                                    )
                                )
                                break

        # 2. Counter-Perspective integration
        if counter_perspective and counter_perspective.strip():
            first_claim_id = claims[0].id if claims else generate_id("clm")
            first_evi_id = evidence[0].id if evidence else ""
            second_evi_id = evidence[1].id if len(evidence) > 1 else ""

            if not any(c.claim_id == first_claim_id for c in contradictions):
                contradictions.append(
                    Contradiction(
                        id=generate_id("con"),
                        claim_id=first_claim_id,
                        evidence_a_id=first_evi_id,
                        evidence_b_id=second_evi_id,
                        explanation=counter_perspective[:200],
                        severity="moderate",
                        contradiction_type="direct_negation",
                    )
                )

        return contradictions
