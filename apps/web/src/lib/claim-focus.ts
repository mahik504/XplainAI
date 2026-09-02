import type { Edge, Node } from "@xyflow/react";

import { isStructureNodeData } from "@/lib/response-graph";
import type { ClassifiedSentence, ResponseStructureAnalysis } from "@/lib/xai";

export const ASSERTION_NODE_ID = "structure-assertion";
export const EVIDENCE_NODE_ID = "structure-evidence";
export const UNCERTAINTY_NODE_ID = "structure-uncertainty";

/** Stable sentence identity derived from analyzer offsets (no duplicated text). */
export function sentenceId(sentence: ClassifiedSentence): string {
  return `s:${String(sentence.start)}:${String(sentence.end)}`;
}

export function findSentenceById(
  analysis: ResponseStructureAnalysis,
  id: string,
): ClassifiedSentence | null {
  return analysis.sentences.find((sentence) => sentenceId(sentence) === id) ?? null;
}

/**
 * Link evidence/uncertainty to an assertion by proximity in the ordered sentence list.
 * Observable structure only — not model reasoning.
 */
export function resolveClaimFocus(
  analysis: ResponseStructureAnalysis,
  assertionId: string,
): {
  assertion: ClassifiedSentence;
  evidenceIds: string[];
  evidence: ClassifiedSentence[];
  nearbyUncertainty: ClassifiedSentence[];
  supportLevel: number;
} | null {
  const assertion = findSentenceById(analysis, assertionId);
  if (!assertion || assertion.category !== "claim") return null;

  const index = analysis.sentences.findIndex((sentence) => sentenceId(sentence) === assertionId);
  if (index < 0) return null;

  const windowRadius = 2;
  const nearby = analysis.sentences.filter((_, i) => Math.abs(i - index) <= windowRadius);

  const linkedEvidence = nearby.filter((sentence) => sentence.category === "evidence");
  const nearbyUncertainty = nearby.filter((sentence) => sentence.category === "hedge");

  const evidenceIds = linkedEvidence.map(sentenceId);
  const avgEvidenceConfidence =
    linkedEvidence.length === 0
      ? 0
      : linkedEvidence.reduce((sum, sentence) => sum + sentence.confidence, 0) /
        linkedEvidence.length;

  const hedgePenalty = nearbyUncertainty.length > 0 ? 0.12 * nearbyUncertainty.length : 0;
  const supportLevel = Math.min(
    1,
    Math.max(
      0,
      linkedEvidence.length === 0
        ? 0.08
        : 0.28 + Math.min(0.55, linkedEvidence.length * 0.22) + avgEvidenceConfidence * 0.2 - hedgePenalty,
    ),
  );

  return {
    assertion,
    evidenceIds,
    evidence: linkedEvidence,
    nearbyUncertainty,
    supportLevel,
  };
}

/** Pick primary assertion when the Assertion graph node is clicked. */
export function primaryAssertionId(analysis: ResponseStructureAnalysis): string | null {
  const claim = analysis.claims[0];
  return claim ? sentenceId(claim) : null;
}

export interface ClaimFocusMetrics {
  assertionText: string;
  evidenceMarkerCount: number;
  linkedEvidence: string[];
  uncertaintyCount: number;
  supportLevel: number;
  detectionConfidence: number;
  /** External retrieved sources for the run (not response evidence markers). */
  retrievedSourcesCount: number;
  uncertaintyLabel: "None" | "Detected" | "Elevated";
}

export function buildClaimFocusMetrics(
  analysis: ResponseStructureAnalysis,
  assertionId: string,
  options?: { retrievedSourcesCount?: number },
): ClaimFocusMetrics | null {
  const resolved = resolveClaimFocus(analysis, assertionId);
  if (!resolved) return null;
  const uncertaintyCount = resolved.nearbyUncertainty.length;
  const uncertaintyLabel =
    uncertaintyCount === 0 ? "None" : uncertaintyCount === 1 ? "Detected" : "Elevated";
  return {
    assertionText: resolved.assertion.text,
    evidenceMarkerCount: resolved.evidence.length,
    linkedEvidence: resolved.evidence.map((sentence) => sentence.text),
    uncertaintyCount,
    supportLevel: resolved.supportLevel,
    detectionConfidence: resolved.assertion.confidence,
    retrievedSourcesCount: options?.retrievedSourcesCount ?? 0,
    uncertaintyLabel,
  };
}

const FOCUS_CENTER = { x: 300, y: 110 };
const FOCUS_EVIDENCE = { x: 470, y: 110 };
const FOCUS_UNCERTAINTY = { x: 300, y: 250 };
const FOCUS_OTHER_Y = 40;

/**
 * Animate existing structure nodes into claim-focus layout.
 * Does not rebuild topology — same node/edge ids.
 */
export function applyClaimFocusLayout(
  nodes: Node[],
  edges: Edge[],
  options: { hasLinkedEvidence: boolean },
): { nodes: Node[]; edges: Edge[] } {
  const focusedNodes = nodes.map((node) => {
    const kind = isStructureNodeData(node.data) ? node.data.structureKind : null;
    const isAssertion = node.id === ASSERTION_NODE_ID || kind === "assertion";
    const isEvidence = node.id === EVIDENCE_NODE_ID || kind === "evidence";
    const isUncertainty = node.id === UNCERTAINTY_NODE_ID || kind === "uncertainty";
    const related = isAssertion || isEvidence || isUncertainty;

    let position = node.position;
    if (isAssertion) position = FOCUS_CENTER;
    else if (isEvidence) position = FOCUS_EVIDENCE;
    else if (isUncertainty) position = FOCUS_UNCERTAINTY;
    else {
      const index = nodes.findIndex((entry) => entry.id === node.id);
      position = { x: 80 + index * 160, y: FOCUS_OTHER_Y };
    }

    return {
      ...node,
      position,
      style: {
        ...node.style,
        opacity: related ? 1 : 0.1,
        transition: "transform 550ms cubic-bezier(0.34, 1.35, 0.64, 1), opacity 420ms ease",
      },
      data: {
        ...node.data,
        focusRole: isAssertion ? "assertion" : isEvidence ? "evidence" : related ? "context" : "dimmed",
        emptySupport: isAssertion && !options.hasLinkedEvidence,
        focusActive: true,
      },
      className: related
        ? "nn-node-wrapper nn-node-wrapper--focus-related"
        : "nn-node-wrapper nn-node-wrapper--focus-dimmed",
    };
  });

  const focusedEdges = edges.map((edge) => {
    const touchesAssertion =
      edge.source === ASSERTION_NODE_ID || edge.target === ASSERTION_NODE_ID;
    const touchesEvidence =
      edge.source === EVIDENCE_NODE_ID || edge.target === EVIDENCE_NODE_ID;
    const related = touchesAssertion || touchesEvidence;

    return {
      ...edge,
      className: related ? "nn-edge nn-edge--active nn-edge--focus-glow" : "nn-edge nn-edge--focus-dim",
      animated: related,
      data: {
        ...(edge.data ?? {}),
        active: related,
        focusGlow: related,
      },
      style: {
        ...edge.style,
        opacity: related ? 1 : 0.1,
        strokeWidth: related ? 2.8 : 1.2,
        filter: related
          ? "drop-shadow(0 0 10px color-mix(in oklab, var(--neon-cyan) 75%, transparent))"
          : undefined,
      },
    };
  });

  return { nodes: focusedNodes, edges: focusedEdges };
}
