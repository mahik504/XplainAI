import type { Edge, Node } from "@xyflow/react";

export type OrchestrationStageId =
  | "query_analyzed"
  | "mode_selected"
  | "context_check"
  | "research_started"
  | "tool_started"
  | "tool_completed"
  | "generation_started"
  | "generation_completed"
  | "analysis_started"
  | "analysis_completed"
  | "structure_ready"
  | "completed";

export interface StageEvent {
  stage: string;
  status: "started" | "complete";
  detail?: Record<string, unknown> | null;
  at: number;
}

export type StageTone = "pending" | "active" | "complete" | "failed" | "skipped";

const VISUAL_STAGES: { id: string; label: string; subtitle: string }[] = [
  { id: "query_analyzed", label: "Query", subtitle: "Intent · domain" },
  { id: "mode_selected", label: "Mode", subtitle: "Routing" },
  { id: "context_check", label: "Context", subtitle: "History check" },
  { id: "research_started", label: "Research", subtitle: "Plan · sources" },
  { id: "tool_started", label: "Tools", subtitle: "Observable calls" },
  { id: "generation_started", label: "Generation", subtitle: "Streaming answer" },
  { id: "analysis_started", label: "Analysis", subtitle: "Structure · gaps" },
];

function relatedEvents(stageId: string, events: StageEvent[]): StageEvent[] {
  return events.filter((event) => {
    if (stageId === "tool_started") {
      return event.stage === "tool_started" || event.stage === "tool_completed";
    }
    if (stageId === "analysis_started") {
      return (
        event.stage === "analysis_started" ||
        event.stage === "analysis_completed" ||
        event.stage === "structure_ready"
      );
    }
    if (stageId === "generation_started") {
      return event.stage === "generation_started" || event.stage === "generation_completed";
    }
    return event.stage === stageId;
  });
}

function isSkipped(stageId: string, events: StageEvent[], mode?: string | null): boolean {
  const related = relatedEvents(stageId, events);
  if (related.some((event) => event.detail?.skipped === true)) return true;
  // Fast mode never runs tools — mark Tools skipped once research has started.
  if (
    stageId === "tool_started" &&
    mode === "fast" &&
    events.some((event) => event.stage === "research_started")
  ) {
    return !related.some((event) => event.stage === "tool_started");
  }
  return false;
}

function durationLabel(stageId: string, events: StageEvent[]): string | null {
  const completed = [...events]
    .reverse()
    .find((event) => {
      if (event.status !== "complete") return false;
      if (stageId === "generation_started") return event.stage === "generation_completed";
      if (stageId === "analysis_started") return event.stage === "analysis_completed";
      if (stageId === "tool_started") return event.stage === "tool_completed";
      return event.stage === stageId;
    });
  const ms = completed?.detail?.duration_ms;
  if (typeof ms !== "number" || ms <= 0) return null;
  return ms >= 1000
    ? `${(ms / 1000).toFixed(1)}s`
    : `${String(Math.round(ms))}ms`;
}

function toneFor(
  stageId: string,
  events: StageEvent[],
  isStreaming: boolean,
  mode?: string | null,
): StageTone {
  if (isSkipped(stageId, events, mode)) return "skipped";
  const related = relatedEvents(stageId, events);
  if (related.some((event) => event.status === "complete")) return "complete";
  if (related.some((event) => event.status === "started")) return "active";
  if (stageId === "generation_started" && isStreaming) return "active";
  return "pending";
}

export function buildStageGraph(
  events: StageEvent[],
  options: { isStreaming: boolean; mode?: string | null },
): { nodes: Node[]; edges: Edge[] } {
  const { isStreaming, mode = null } = options;
  if (events.length === 0 && !isStreaming) {
    return { nodes: [], edges: [] };
  }

  const nodes: Node[] = VISUAL_STAGES.map((stage, index) => {
    const tone = toneFor(stage.id, events, isStreaming, mode);
    const duration = durationLabel(stage.id, events);
    let subtitle = stage.subtitle;
    if (stage.id === "mode_selected" && mode) {
      const pretty = mode.replaceAll("_", " ");
      subtitle = pretty.charAt(0).toUpperCase() + pretty.slice(1);
    } else if (tone === "skipped") {
      subtitle = "Skipped";
    } else if (duration) {
      subtitle = duration;
    } else if (stage.id === "research_started") {
      const research = events.find((event) => event.stage === "research_started");
      const tasks = research?.detail?.task_count;
      if (typeof tasks === "number" && tasks > 0) {
        subtitle = `${String(tasks)} research tasks`;
      }
    }

    return {
      id: `stage-${stage.id}`,
      type: "runNode",
      position: { x: index * 168, y: 72 },
      data: {
        label: stage.label,
        subtitle,
        tone,
      },
    };
  });

  const edges: Edge[] = [];
  for (let index = 0; index < VISUAL_STAGES.length - 1; index += 1) {
    const stage = VISUAL_STAGES[index];
    const next = VISUAL_STAGES[index + 1];
    if (!stage || !next) continue;
    const source = `stage-${stage.id}`;
    const target = `stage-${next.id}`;
    const targetTone = toneFor(next.id, events, isStreaming, mode);
    const active = targetTone === "active";
    edges.push({
      id: `e-${source}-${target}`,
      source,
      target,
      type: "smoothstep",
      animated: active,
      className: active ? "nn-edge nn-edge--active" : "nn-edge",
      data: { active },
      style: {
        stroke:
          targetTone === "skipped"
            ? "oklch(0.45 0.01 250 / 35%)"
            : active
              ? "oklch(0.72 0.15 220 / 80%)"
              : targetTone === "complete"
                ? "oklch(0.72 0.17 165 / 65%)"
                : "oklch(0.50 0.015 250 / 40%)",
        strokeWidth: active ? 2 : 1.35,
        strokeDasharray: targetTone === "skipped" ? "4 4" : undefined,
      },
    });
  }

  return { nodes, edges };
}
