import type { Edge, Node } from "@xyflow/react";

import type { RunNodeTone } from "@/lib/run-graph";
import type {
  ClassifiedSentence,
  ResponseStructureAnalysis,
  ResponseStructureCategory,
} from "@/lib/xai";

/** Observable response-structure node kinds (not model CoT). */
export type StructureNodeKind =
  | "question"
  | "response"
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
  structureCategory: ResponseStructureCategory | "meta";
  count: number;
  confidence: number;
  samples: string[];
} & Record<string, unknown>;

const KIND_STROKE: Record<StructureNodeKind, string> = {
  question: "oklch(0.78 0.04 250 / 70%)",
  response: "oklch(0.8 0.08 220 / 75%)",
  assertion: "oklch(0.82 0.135 199 / 85%)",
  evidence: "oklch(0.8 0.16 165 / 85%)",
  connector: "oklch(0.7 0.19 302 / 85%)",
  uncertainty: "oklch(0.83 0.15 78 / 85%)",
  conclusion: "oklch(0.72 0.14 250 / 85%)",
};

interface StructureSpec {
  kind: Exclude<StructureNodeKind, "question" | "response">;
  category: ResponseStructureCategory;
  title: string;
  sentences: ClassifiedSentence[];
  subtitle: (count: number) => string;
  /** Column under Response (0 = left). */
  column: number;
  /** Nest evidence under assertion when both present. */
  nestUnderAssertion?: boolean;
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
 * Deterministic hierarchy: Question → Response → categories.
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
      column: 0,
    },
    {
      kind: "evidence",
      category: "evidence",
      title: "Evidence Marker",
      sentences: analysis.evidence,
      subtitle: (count) => `${String(count)} detected`,
      column: 0,
      nestUnderAssertion: true,
    },
    {
      kind: "connector",
      category: "reasoning",
      title: "Causal Connector",
      sentences: analysis.reasoning,
      subtitle: (count) => (count === 1 ? "1 connector" : `${String(count)} connectors`),
      column: 1,
    },
    {
      kind: "uncertainty",
      category: "hedge",
      title: "Uncertainty Signal",
      sentences: analysis.hedges,
      subtitle: (count) => `${String(count)} detected`,
      column: 2,
    },
    {
      kind: "conclusion",
      category: "conclusion",
      title: "Conclusion",
      sentences: analysis.conclusions,
      subtitle: () => "Present",
      column: 3,
    },
  ];

  const present = specs.filter((spec) => spec.sentences.length > 0);
  if (present.length === 0) {
    return { nodes: [], edges: [] };
  }

  const hasAssertion = present.some((spec) => spec.kind === "assertion");
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  nodes.push({
    id: "structure-question",
    type: "runNode",
    position: { x: 280, y: 0 },
    data: {
      label: "Question",
      subtitle: "User prompt",
      tone: "complete",
      structureKind: "question",
      structureCategory: "meta",
      count: 1,
      confidence: 1,
      samples: [],
    } satisfies StructureNodeData,
    className: "nn-node-wrapper",
  });

  nodes.push({
    id: "structure-response",
    type: "runNode",
    position: { x: 280, y: 100 },
    data: {
      label: "Response",
      subtitle: `${String(analysis.score.sentenceCount)} sentences`,
      tone: "complete",
      structureKind: "response",
      structureCategory: "meta",
      count: analysis.score.sentenceCount,
      confidence: analysis.score.confidence,
      samples: [],
    } satisfies StructureNodeData,
    className: "nn-node-wrapper",
  });

  edges.push(makeStructureEdge("e-structure-q-r", "structure-question", "structure-response", "response"));

  for (const spec of present) {
    const count = spec.sentences.length;
    const confidence = averageConfidence(spec.sentences);
    const nested =
      spec.nestUnderAssertion && hasAssertion && spec.kind === "evidence";
    const x = 40 + spec.column * 180;
    const y = nested ? 320 : 220;

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

    nodes.push({
      id: `structure-${spec.kind}`,
      type: "runNode",
      position: { x, y },
      data,
      className: "nn-node-wrapper",
    });

    if (nested) {
      edges.push(
        makeStructureEdge(
          `e-structure-assertion-${spec.kind}`,
          "structure-assertion",
          `structure-${spec.kind}`,
          spec.kind,
        ),
      );
    } else {
      edges.push(
        makeStructureEdge(
          `e-structure-response-${spec.kind}`,
          "structure-response",
          `structure-${spec.kind}`,
          spec.kind,
        ),
      );
    }
  }

  return { nodes, edges };
}

export function isStructureNodeData(data: unknown): data is StructureNodeData {
  if (typeof data !== "object" || data === null) return false;
  return "structureKind" in data && "structureCategory" in data;
}
