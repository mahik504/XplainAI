import type { Edge, Node } from "@xyflow/react";

import type { RunNodeTone } from "@/lib/run-graph";
import type {
  ClassifiedSentence,
  ResponseStructureAnalysis,
  ResponseStructureCategory,
} from "@/lib/xai";

/** Observable response-structure node kinds (not model CoT). */
export type StructureNodeKind =
  | "assertion"
  | "evidence"
  | "connector"
  | "uncertainty"
  | "conclusion";

export type StructureNodeData = {
  label: string;
  subtitle: string;
  tone: RunNodeTone;
  structureKind: StructureNodeKind;
  /** Maps to analyzer category for hover sync */
  structureCategory: ResponseStructureCategory;
  count: number;
  confidence: number;
  samples: string[];
} & Record<string, unknown>;

const KIND_STROKE: Record<StructureNodeKind, string> = {
  assertion: "oklch(0.82 0.135 199 / 85%)",
  evidence: "oklch(0.8 0.16 165 / 85%)",
  connector: "oklch(0.7 0.19 302 / 85%)",
  uncertainty: "oklch(0.83 0.15 78 / 85%)",
  conclusion: "oklch(0.72 0.14 250 / 85%)",
};

interface StructureSpec {
  kind: StructureNodeKind;
  category: ResponseStructureCategory;
  title: string;
  sentences: ClassifiedSentence[];
  subtitle: (count: number) => string;
}

function averageConfidence(sentences: ClassifiedSentence[]): number {
  if (sentences.length === 0) return 0;
  return (
    sentences.reduce((sum, sentence) => sum + sentence.confidence, 0) / sentences.length
  );
}

function makeStructureEdge(
  id: string,
  source: string,
  target: string,
  kind: StructureNodeKind,
): Edge {
  return {
    id,
    source,
    target,
    type: "particle",
    className: "nn-edge nn-edge--active",
    animated: true,
    data: { active: true },
    style: {
      stroke: KIND_STROKE[kind],
      strokeWidth: 2,
    },
  };
}

/**
 * Build a Response Structure Graph from finished-response analysis.
 * Only emits nodes for categories that were actually detected.
 */
export function buildResponseStructureGraph(
  analysis: ResponseStructureAnalysis,
): { nodes: Node[]; edges: Edge[] } {
  const specs: StructureSpec[] = [
    {
      kind: "assertion",
      category: "claim",
      title: "Assertion",
      sentences: analysis.claims,
      subtitle: (count) => (count === 1 ? "1 assertion" : `${String(count)} assertions`),
    },
    {
      kind: "evidence",
      category: "evidence",
      title: "Evidence Marker",
      sentences: analysis.evidence,
      subtitle: (count) => `${String(count)} detected`,
    },
    {
      kind: "connector",
      category: "reasoning",
      title: "Causal Connector",
      sentences: analysis.reasoning,
      subtitle: (count) => (count === 1 ? "1 connector" : `${String(count)} connectors`),
    },
    {
      kind: "uncertainty",
      category: "hedge",
      title: "Uncertainty Signal",
      sentences: analysis.hedges,
      subtitle: (count) => `${String(count)} detected`,
    },
    {
      kind: "conclusion",
      category: "conclusion",
      title: "Conclusion",
      sentences: analysis.conclusions,
      subtitle: () => "Present",
    },
  ];

  const present = specs.filter((spec) => spec.sentences.length > 0);
  if (present.length === 0) {
    return { nodes: [], edges: [] };
  }

  const gap = 200;
  const nodes: Node[] = present.map((spec, index) => {
    const count = spec.sentences.length;
    const confidence = averageConfidence(spec.sentences);
    const data: StructureNodeData = {
      label: spec.title,
      subtitle: spec.subtitle(count),
      tone: "complete",
      structureKind: spec.kind,
      structureCategory: spec.category,
      count,
      confidence,
      samples: spec.sentences.slice(0, 3).map((sentence) => sentence.text),
    };

    return {
      id: `structure-${spec.kind}`,
      type: "runNode",
      position: { x: index * gap, y: 88 },
      data,
      className: "nn-node-wrapper",
    };
  });

  const edges: Edge[] = [];
  for (let i = 0; i < present.length - 1; i += 1) {
    const source = present[i];
    const target = present[i + 1];
    if (!source || !target) continue;
    edges.push(
      makeStructureEdge(
        `e-structure-${source.kind}-${target.kind}`,
        `structure-${source.kind}`,
        `structure-${target.kind}`,
        target.kind,
      ),
    );
  }

  return { nodes, edges };
}

export function isStructureNodeData(data: unknown): data is StructureNodeData {
  if (typeof data !== "object" || data === null) return false;
  return "structureKind" in data && "structureCategory" in data;
}
