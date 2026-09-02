"""Explainable Grounding Index (EGI 2.0) deterministic mathematical engine.

Computes a deterministic, multi-factor verification score evaluating:
- Factual grounding coverage weighted by claim importance
- Source quality and domain authority weighting
- Evidence confidence and relevance density
- Citation fidelity
- Temporal freshness decay
- Granular contradiction severity penalties
- Epistemic assumption risks
"""

from __future__ import annotations

import math
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from neural_navigator.domain.models.research import ClaimStatus, SourceType

if TYPE_CHECKING:
    from collections.abc import Sequence

    from neural_navigator.domain.models.research import (
        Assumption,
        Citation,
        Claim,
        Contradiction,
        Evidence,
        Source,
    )

# Weight parameters summing to 1.00
_WEIGHT_COVERAGE = 0.35
_WEIGHT_SOURCE_QUALITY = 0.25
_WEIGHT_EVIDENCE_CONFIDENCE = 0.20
_WEIGHT_CITATION_FIDELITY = 0.20

# Claim importance multipliers
_IMPORTANCE_WEIGHTS: dict[str, float] = {
    "core": 3.0,
    "high": 2.0,
    "medium": 1.5,
    "low": 1.0,
}

# Source type authority multipliers
_SOURCE_TYPE_MULTIPLIERS: dict[str, float] = {
    SourceType.PAPER.value: 1.0,
    SourceType.DOCUMENT.value: 0.95,
    SourceType.DOCUMENTATION.value: 0.95,
    SourceType.TOOL.value: 0.85,
    SourceType.WEB.value: 0.80,
    SourceType.SYSTEM.value: 0.75,
}

# Contradiction severity penalties
_CONTRADICTION_PENALTIES: dict[str, float] = {
    "critical": 0.25,
    "moderate": 0.12,
    "low": 0.05,
}


def _calculate_freshness_decay(
    sources: Sequence[Source] | None,
    domain: str = "general",
) -> float:
    """Calculate temporal freshness decay factor in [0.8, 1.0]."""
    if not sources:
        return 1.0

    lambda_decay = 0.15 if domain in ("technology", "computer_science", "ai") else 0.05
    now_year = datetime.now(UTC).year
    decay_factors: list[float] = []

    for s in sources:
        if not s.published_date:
            continue
        try:
            year_match = s.published_date[:4]
            if year_match.isdigit():
                delta_years = max(0.0, float(now_year - int(year_match)))
                decay = math.exp(-lambda_decay * delta_years)
                decay_factors.append(max(0.5, min(1.0, decay)))
        except Exception:
            continue

    if not decay_factors:
        return 1.0
    return sum(decay_factors) / len(decay_factors)


def compute_egi_score(
    claims: Sequence[Claim],
    evidence: Sequence[Evidence],
    citations: Sequence[Citation],
    contradictions: Sequence[Contradiction] | None = None,
    assumptions: Sequence[Assumption] | None = None,
    sources: Sequence[Source] | None = None,
    domain: str = "general",
) -> tuple[float, dict[str, Any]]:
    """Compute the deterministic EGI 2.0 verification score and detailed trust metrics breakdown.

    Returns:
        tuple[float, dict[str, Any]]: (egi_score in [0.0, 1.0], trust_metrics_dict)
    """
    contradictions = contradictions or []
    assumptions = assumptions or []

    # 1. Coverage Score (C_ground): Importance-weighted supported claims
    total_claims = len(claims)
    supported_claims = 0
    unverified_claims = 0
    weakly_supported_claims = 0

    if total_claims > 0:
        total_importance_weight = sum(
            _IMPORTANCE_WEIGHTS.get(c.importance, 1.5) for c in claims
        )
        supported_importance_sum = 0.0

        for c in claims:
            w = _IMPORTANCE_WEIGHTS.get(c.importance, 1.5)
            if c.status == ClaimStatus.SUPPORTED:
                supported_claims += 1
                supported_importance_sum += w * min(1.0, max(0.6, c.confidence))
            elif c.status == ClaimStatus.WEAKLY_SUPPORTED:
                weakly_supported_claims += 1
                supported_importance_sum += 0.5 * w * c.confidence
            else:
                unverified_claims += 1

        coverage_score = (
            supported_importance_sum / total_importance_weight
            if total_importance_weight > 0
            else 0.5
        )
        grounding_ratio = (
            (supported_claims + 0.5 * weakly_supported_claims) / total_claims
            if total_claims > 0
            else 0.5
        )
    else:
        coverage_score = 0.85
        grounding_ratio = 1.0

    # 2. Source Quality Score (Q_src)
    if sources and len(sources) > 0:
        q_src_sum = 0.0
        for s in sources:
            st_val = s.source_type.value if hasattr(s.source_type, "value") else str(s.source_type)
            type_mult = _SOURCE_TYPE_MULTIPLIERS.get(st_val, 0.80)
            auth = getattr(s, "authority_score", 0.8)
            q_src_sum += type_mult * auth
        source_quality_score = q_src_sum / len(sources)
    else:
        source_quality_score = 0.85

    # 3. Evidence Confidence and Relevance (E_conf)
    total_evidence = len(evidence)
    if total_evidence > 0:
        e_conf_sum = sum(
            math.sqrt(max(0.01, e.confidence) * max(0.01, getattr(e, "relevance_score", 0.85)))
            for e in evidence
        )
        evidence_confidence_score = e_conf_sum / total_evidence

        active_evidence_ids = {eid for c in claims for eid in c.evidence_ids if eid}
        active_evidence = [e for e in evidence if e.id in active_evidence_ids] if active_evidence_ids else list(evidence)
        mean_evidence_confidence = sum(e.confidence for e in active_evidence) / max(1, len(active_evidence))
    else:
        evidence_confidence_score = 0.5
        mean_evidence_confidence = 0.5

    # 4. Citation Fidelity (F_cit)
    total_citations = len(citations)
    if total_citations > 0:
        valid_citations = sum(1 for c in citations if c.evidence_id and c.claim_id)
        citation_fidelity = valid_citations / total_citations
    else:
        citation_fidelity = 0.8 if supported_claims > 0 else 0.5

    # 5. Temporal Freshness Factor (Phi_time)
    freshness_factor = _calculate_freshness_decay(sources, domain=domain)

    # 6. Contradiction Penalty (P_contra)
    contradiction_count = len(contradictions)
    raw_contra_penalty = sum(
        _CONTRADICTION_PENALTIES.get(con.severity, 0.12) for con in contradictions
    )
    contradiction_penalty = min(0.40, raw_contra_penalty)

    # 7. Assumption Risk (R_asm)
    if assumptions:
        unsupported_sum = sum(
            max(0.0, 1.0 - a.grounded_score) for a in assumptions
        )
        assumption_risk = min(0.20, 0.05 * unsupported_sum)
    else:
        assumption_risk = 0.0

    # 8. Deterministic Mathematical EGI 2.0 Calculation
    base_grounding = (
        (_WEIGHT_COVERAGE * coverage_score)
        + (_WEIGHT_SOURCE_QUALITY * source_quality_score)
        + (_WEIGHT_EVIDENCE_CONFIDENCE * evidence_confidence_score)
        + (_WEIGHT_CITATION_FIDELITY * citation_fidelity)
    )

    decayed_score = base_grounding * freshness_factor
    raw_score = decayed_score - contradiction_penalty - assumption_risk

    # Deterministic clamp in [0.0, 1.0]
    egi_score = round(max(0.0, min(1.0, raw_score)), 3)

    trust_metrics: dict[str, Any] = {
        "egi_score": egi_score,
        "grounding_ratio": round(grounding_ratio, 3),
        "coverage_score": round(coverage_score, 3),
        "source_quality_score": round(source_quality_score, 3),
        "evidence_confidence_score": round(evidence_confidence_score, 3),
        "mean_evidence_confidence": round(mean_evidence_confidence, 3),
        "citation_fidelity": round(citation_fidelity, 3),
        "freshness_factor": round(freshness_factor, 3),
        "contradiction_penalty": round(contradiction_penalty, 3),
        "assumption_risk": round(assumption_risk, 3),
        "total_claims": total_claims,
        "supported_claims": supported_claims,
        "unverified_claims": unverified_claims,
        "weakly_supported_claims": weakly_supported_claims,
        "total_evidence": total_evidence,
        "total_citations": total_citations,
        "contradictions_found": contradiction_count,
        "assumptions_evaluated": len(assumptions),
    }

    return egi_score, trust_metrics
