import type { Edge, Node } from "@xyflow/react";

export type RunPhase = "idle" | "started" | "streaming" | "finished" | "failed" | "cancelled";

export type RunNodeTone = "pending" | "active" | "complete" | "failed" | "skipped";

function toneFor(phase: RunPhase, id: "input" | "model" | "stream" | "output"): RunNodeTone {
  if (phase === "idle") return "pending";

  if (phase === "failed") {
    if (id === "input" || id === "model") return "complete";
    return "failed";
  }

  if (phase === "cancelled") {
    if (id === "input" || id === "model") return "complete";
    return "failed";
  }

  if (phase === "started") {
    if (id === "input") return "complete";
    if (id === "model") return "active";
    return "pending";
  }

  if (phase === "streaming") {
    if (id === "input" || id === "model") return "complete";
    if (id === "stream") return "active";
    return "pending";
  }

  return "complete";
}

function edgeStroke(phase: RunPhase, active: boolean): string {
  if (phase === "failed" || phase === "cancelled") {
    return "oklch(0.635 0.208 25 / 75%)";
  }
  if (phase === "finished") {
    return "oklch(0.8 0.16 165 / 75%)";
  }
  if (active) {
    return "oklch(0.82 0.135 199 / 90%)";
  }
  return "oklch(0.72 0.05 280 / 40%)";
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  phase: RunPhase,
  active: boolean,
): Edge {
  return {
    id,
    source,
    target,
    type: "particle",
    className: active ? "nn-edge nn-edge--active" : "nn-edge",
    animated: active,
    data: { active },
    style: {
      stroke: edgeStroke(phase, active),
      strokeWidth: active ? 2.35 : phase === "finished" ? 2 : 1.55,
    },
  };
}

export function resolveActiveNodeId(
  nodes: { id: string; data?: { tone?: RunNodeTone } }[],
): string | null {
  const active = nodes.find((node) => node.data?.tone === "active");
  return active?.id ?? null;
}

export function buildRunGraph(phase: RunPhase, model?: string): { nodes: Node[]; edges: Edge[] } {
  if (phase === "idle") {
    return { nodes: [], edges: [] };
  }

  const labels = {
    input: "Input",
    model: model ? `Model · ${model}` : "Model",
    stream: "Stream",
    output: "Output",
  } as const;

  const nodes: Node[] = (
    [
      ["input", 0, 88],
      ["model", 190, 88],
      ["stream", 380, 88],
      ["output", 570, 88],
    ] as const
  ).map(([id, x, y]) => ({
    id,
    type: "runNode",
    position: { x, y },
    data: {
      label: labels[id],
      tone: toneFor(phase, id),
    },
    className: "nn-node-wrapper",
  }));

  const edges: Edge[] = [
    makeEdge(
      "e-input-model",
      "input",
      "model",
      phase,
      phase === "started" || phase === "streaming",
    ),
    makeEdge("e-model-stream", "model", "stream", phase, phase === "streaming"),
    makeEdge(
      "e-stream-output",
      "stream",
      "output",
      phase,
      phase === "streaming" || phase === "finished",
    ),
  ];

  return { nodes, edges };
}
