"""Explainable Grounding Index (EGI) and trust metrics calculation engine.

Computes a deterministic, mathematically grounded verification score evaluating
factual grounding ratio, evidence confidence, citation fidelity, contradiction
penalties, and assumption risks.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from neural_navigator.domain.models.research import ClaimStatus

if TYPE_CHECKING:
    from collections.abc import Sequence

    from neural_navigator.domain.models.research import (
        Assumption,
        Citation,
        Claim,
        Contradiction,
        Evidence,
    )


def compute_egi_score(
    claims: Sequence[Claim],
    evidence: Sequence[Evidence],
    citations: Sequence[Citation],
    contradictions: Sequence[Contradiction] | None = None,
    assumptions: Sequence[Assumption] | None = None,
) -> tuple[float, dict[str, Any]]:
    """Compute the Explainable Grounding Index (EGI) score and detailed trust metrics.

    Returns:
        tuple[float, dict[str, Any]]: (egi_score in [0.0, 1.0], trust_metrics_dict)
    """
    contradictions = contradictions or []
    assumptions = assumptions or []

    # 1. Grounding Ratio: Supported Claims / Total Claims
    total_claims = len(claims)
    supported_claims = sum(1 for c in claims if c.status == ClaimStatus.SUPPORTED)
    unverified_claims = sum(1 for c in claims if c.status == ClaimStatus.UNVERIFIED)
    grounding_ratio = supported_claims / total_claims if total_claims > 0 else 0.5

    # 2. Mean Evidence Confidence
    total_evidence = len(evidence)
    if total_evidence > 0:
        mean_evidence_confidence = sum(e.confidence for e in evidence) / total_evidence
    else:
        mean_evidence_confidence = 0.5

    # 3. Citation Fidelity: Valid linked citations / total citations
    total_citations = len(citations)
    if total_citations > 0:
        valid_citations = sum(1 for c in citations if c.evidence_id and c.claim_id)
        citation_fidelity = valid_citations / total_citations
    else:
        citation_fidelity = 0.8 if supported_claims > 0 else 0.5

    # 4. Contradiction Penalty
    contradiction_count = len(contradictions)
    contradiction_penalty = min(0.3, 0.1 * contradiction_count)

    # 5. Assumption Risk
    if assumptions:
        unsupported_assumption_sum = sum(max(0.0, 1.0 - a.grounded_score) for a in assumptions)
        assumption_risk = min(0.2, 0.05 * unsupported_assumption_sum)
    else:
        assumption_risk = 0.0

    # Weighted composition: positive grounding signals sum to 1.0
    w_grounding = 0.45
    w_confidence = 0.30
    w_fidelity = 0.25

    base_score = (
        (w_grounding * grounding_ratio)
        + (w_confidence * mean_evidence_confidence)
        + (w_fidelity * citation_fidelity)
    )

    raw_score = base_score - contradiction_penalty - assumption_risk

    # Clamp to [0.0, 1.0]
    egi_score = round(max(0.0, min(1.0, raw_score)), 3)

    trust_metrics: dict[str, Any] = {
        "egi_score": egi_score,
        "grounding_ratio": round(grounding_ratio, 3),
        "mean_evidence_confidence": round(mean_evidence_confidence, 3),
        "citation_fidelity": round(citation_fidelity, 3),
        "contradiction_penalty": round(contradiction_penalty, 3),
        "assumption_risk": round(assumption_risk, 3),
        "total_claims": total_claims,
        "supported_claims": supported_claims,
        "unverified_claims": unverified_claims,
        "total_evidence": total_evidence,
        "total_citations": total_citations,
        "contradictions_found": contradiction_count,
    }

    return egi_score, trust_metrics
