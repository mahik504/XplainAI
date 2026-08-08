import type { Edge, Node } from "@xyflow/react";
import { create } from "zustand";

import type { ConnectionState } from "@/app/layouts/TopNav";
import type { ConversationMessage } from "@/features/conversation";
import type { TimelineEvent, TimelineStatus } from "@/features/timeline";
import type { TrustPoint, TrustSignal } from "@/features/trust";
import type { RunMode } from "@/lib/run-mode";
import { buildRunGraph, type RunPhase } from "@/lib/run-graph";
import type {
  ChatWireMessage,
  FinishReason,
  ServerFrame,
  Usage,
} from "@/lib/protocol";
import type { ChatModelInfo } from "@/lib/api";
import { sourcesFromOrchestration, type RetrievedSource } from "@/lib/sources";
import { buildStageGraph, type StageEvent } from "@/lib/stage-graph";
import type { WsClient } from "@/lib/ws-client";
import {
  analyzeResponse,
  type ResponseStructureAnalysis,
} from "@/lib/xai";
import { useUIStore } from "@/stores/ui-store";

export interface MissingContextItem {
  item: string;
  importance: string;
  why_it_matters: string;
}

function nowStamp(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toWireMessages(messages: ConversationMessage[]): ChatWireMessage[] {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function finishQuality(reason: FinishReason): number {
  switch (reason) {
    case "stop":
      return 1;
    case "tool_calls":
      return 0.85;
    case "length":
      return 0.65;
    case "cancelled":
      return 0.35;
    case "error":
      return 0.1;
    default:
      return 0.2;
  }
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pushHistory(history: TrustPoint[], value: number): TrustPoint[] {
  const next = [...history, { label: String(history.length + 1), value }];
  return next.length > 24 ? next.slice(next.length - 24) : next;
}

/** Explainability-only assessment — never mixes in infrastructure latency. */
function buildTrustProjection(input: {
  connection: ConnectionState;
  finishReason: FinishReason | null;
  analysis: ResponseStructureAnalysis | null;
}): { score: number | null; signals: TrustSignal[] } {
  const hasStructure = input.analysis !== null && input.analysis.score.sentenceCount > 0;
  const hasRunMetrics = input.finishReason !== null || hasStructure;

  if (!hasRunMetrics) {
    return { score: null, signals: [] };
  }

  const signals: TrustSignal[] = [
    {
      id: "connection",
      label: "Connection",
      value:
        input.connection === "live" ? 1 : input.connection === "connecting" ? 0.45 : 0.1,
    },
  ];

  if (hasStructure && input.analysis) {
    signals.push({
      id: "evidence",
      label: "Evidence",
      value: input.analysis.score.evidenceScore,
    });
    signals.push({
      id: "reasoning",
      label: "Reasoning",
      value: input.analysis.score.reasoningScore,
    });
    signals.push({
      id: "confidence",
      label: "Structure match",
      value: input.analysis.score.confidence,
    });
  } else if (input.finishReason !== null) {
    // Fallback when the response has no classifiable sentences.
    const quality = finishQuality(input.finishReason);
    signals.push({ id: "confidence", label: "Finish quality", value: quality });
  }

  // Score only explainability signals (not connection / latency).
  const scored = signals.filter((signal) =>
    ["evidence", "reasoning", "confidence"].includes(signal.id),
  );

  return {
    score: average(scored.map((signal) => signal.value)),
    signals,
  };
}

interface SessionState {
  connection: ConnectionState;
  providerName: string | null;
  defaultModel: string | null;
  availableModels: ChatModelInfo[];
  messages: ConversationMessage[];
  isStreaming: boolean;
  activeRunId: string | null;
  activeModel: string | null;
  streamedChars: number;
  phase: RunPhase;
  runStartedAtMs: number | null;
  firstTokenLatencyMs: number | null;
  totalLatencyMs: number | null;
  tokenUsage: Usage | null;
  finishReason: FinishReason | null;
  selectedNodeId: string | null;
  graphNodes: Node[];
  graphEdges: Edge[];
  timeline: TimelineEvent[];
  trustScore: number | null;
  trustSignals: TrustSignal[];
  trustHistory: TrustPoint[];
  /** Structural analysis of the latest finished assistant response (not CoT). */
  responseAnalysis: ResponseStructureAnalysis | null;
  runMode: RunMode;
  stageEvents: StageEvent[];
  orchestration: Record<string, unknown> | null;
  sourcesRetrieved: number;
  retrievedSources: RetrievedSource[];
  missingContext: MissingContextItem[];
  counterPerspective: string | null;
  stageTimings: { stage: string; duration_ms: number }[];
  ignoredRunIds: string[];
  lastError: string | null;
  lastErrorCode: string | null;
  bindClient: (client: WsClient | null) => void;
  setConnection: (connection: ConnectionState) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setModelCatalog: (input: {
    provider: string;
    defaultModel: string;
    models?: ChatModelInfo[];
  }) => void;
  setActiveModel: (modelId: string) => void;
  setRunMode: (mode: RunMode) => void;
  applyFrame: (frame: ServerFrame) => void;
  sendMessage: (text: string, options?: { conversationId?: string | null }) => boolean;
  retryLast: (options?: { conversationId?: string | null }) => boolean;
  resetConversation: () => void;
  loadConversationMessages: (messages: ConversationMessage[]) => void;
  stop: () => void;
}

let clientRef: WsClient | null = null;

function appendTimeline(
  events: TimelineEvent[],
  entry: {
    id?: string;
    label: string;
    detail?: string;
    status: TimelineStatus;
    timestamp?: string;
  },
): TimelineEvent[] {
  const next: TimelineEvent = {
    id: entry.id ?? createId("evt"),
    label: entry.label,
    status: entry.status,
    timestamp: entry.timestamp ?? nowStamp(),
  };
  if (entry.detail !== undefined) {
    next.detail = entry.detail;
  }
  return [...events, next];
}

function markTimeline(
  events: TimelineEvent[],
  matcher: (event: TimelineEvent) => boolean,
  status: TimelineStatus,
): TimelineEvent[] {
  return events.map((event) => (matcher(event) ? { ...event, status } : event));
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  connection: "offline",
  providerName: null,
  defaultModel: null,
  availableModels: [],
  messages: [],
  isStreaming: false,
  activeRunId: null,
  activeModel: null,
  streamedChars: 0,
  phase: "idle",
  runStartedAtMs: null,
  firstTokenLatencyMs: null,
  totalLatencyMs: null,
  tokenUsage: null,
  finishReason: null,
  selectedNodeId: null,
  graphNodes: [],
  graphEdges: [],
  timeline: [],
  trustScore: null,
  trustSignals: [],
  trustHistory: [],
  responseAnalysis: null,
  runMode: "balanced",
  stageEvents: [],
  orchestration: null,
  sourcesRetrieved: 0,
  retrievedSources: [],
  missingContext: [],
  counterPerspective: null,
  stageTimings: [],
  ignoredRunIds: [],
  lastError: null,
  lastErrorCode: null,

  bindClient: (client) => {
    clientRef = client;
  },

  setRunMode: (mode) => {
    set({ runMode: mode });
  },

  resetConversation: () => {
    set({
      messages: [],
      isStreaming: false,
      activeRunId: null,
      streamedChars: 0,
      phase: "idle",
      runStartedAtMs: null,
      firstTokenLatencyMs: null,
      totalLatencyMs: null,
      tokenUsage: null,
      finishReason: null,
      selectedNodeId: null,
      graphNodes: [],
      graphEdges: [],
      timeline: [],
      responseAnalysis: null,
      stageEvents: [],
      orchestration: null,
      sourcesRetrieved: 0,
      retrievedSources: [],
      missingContext: [],
      counterPerspective: null,
      stageTimings: [],
      ignoredRunIds: [],
      lastError: null,
      lastErrorCode: null,
    });
  },

  loadConversationMessages: (messages) => {
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    const responseAnalysis =
      lastAssistant && lastAssistant.content.trim()
        ? analyzeResponse(lastAssistant.content)
        : null;
    set({
      messages,
      isStreaming: false,
      activeRunId: null,
      streamedChars: 0,
      phase: lastAssistant ? "finished" : "idle",
      runStartedAtMs: null,
      firstTokenLatencyMs: null,
      totalLatencyMs: null,
      tokenUsage: null,
      finishReason: null,
      responseAnalysis,
      stageEvents: [],
      orchestration: null,
      sourcesRetrieved: 0,
      retrievedSources: [],
      missingContext: [],
      counterPerspective: null,
      stageTimings: [],
      selectedNodeId: null,
      graphNodes: [],
      graphEdges: [],
      timeline: [],
      trustScore: null,
      trustSignals: [],
      ignoredRunIds: [],
      lastError: null,
      lastErrorCode: null,
    });
  },

  setConnection: (connection) => {
    set((state) => {
      // A dropped socket mid-stream must not leave the composer stuck on "Stop"
      // forever once the client reconnects â€” no run.finished will ever arrive for it.
      if (state.connection === "live" && connection !== "live" && state.isStreaming) {
        return {
          connection,
          isStreaming: false,
          activeRunId: null,
          phase: "failed",
          lastError: "Connection lost during run",
          lastErrorCode: "connection_lost",
          timeline: appendTimeline(state.timeline, {
            label: "Connection lost",
            detail: "Run interrupted",
            status: "failed",
          }),
        };
      }
      return { connection };
    });
  },

  setSelectedNodeId: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  setModelCatalog: ({ provider, defaultModel, models = [] }) => {
    const current = get().activeModel;
    const allowed = new Set(models.map((model) => model.id));
    const nextActive =
      current && (allowed.size === 0 || allowed.has(current))
        ? current
        : defaultModel;
    set({
      providerName: provider,
      defaultModel,
      availableModels: models,
      activeModel: nextActive,
    });
  },

  setActiveModel: (modelId) => {
    const allowed = get().availableModels;
    if (allowed.length > 0 && !allowed.some((model) => model.id === modelId)) {
      return;
    }
    set({ activeModel: modelId });
  },

  applyFrame: (frame) => {
    const runId =
      "run_id" in frame && typeof frame.run_id === "string" ? frame.run_id : null;
    if (
      runId &&
      frame.type !== "run.started" &&
      (get().ignoredRunIds.includes(runId) ||
        (get().activeRunId !== null &&
          runId !== get().activeRunId &&
          (frame.type === "run.token" ||
            frame.type === "stage.started" ||
            frame.type === "stage.complete" ||
            frame.type === "run.finished")))
    ) {
      return;
    }

    switch (frame.type) {
      case "connection.ready": {
        const trust = buildTrustProjection({ connection: "live", finishReason: null,
          analysis: null,
        });
        set({
          connection: "live",
          lastError: null,
          lastErrorCode: null,
          trustScore: trust.score,
          trustSignals: trust.signals,
        });
        return;
      }

      case "heartbeat":
      case "pong": {
        // Avoid store churn on every beat when already live.
        if (get().connection !== "live") {
          set({ connection: "live" });
        }
        return;
      }

      case "run.started": {
        const graph = buildRunGraph("started", frame.model);
        const startedAt = performance.now();
        const trust = buildTrustProjection({ connection: get().connection, finishReason: null,
          analysis: null,
        });
        set((state) => ({
          isStreaming: true,
          activeRunId: frame.run_id,
          activeModel: frame.model,
          streamedChars: 0,
          phase: "started",
          runStartedAtMs: startedAt,
          firstTokenLatencyMs: null,
          totalLatencyMs: null,
          tokenUsage: null,
          finishReason: null,
          responseAnalysis: null,
          stageEvents: [],
          orchestration: null,
          sourcesRetrieved: 0,
          retrievedSources: [],
          missingContext: [],
          counterPerspective: null,
          stageTimings: [],
          selectedNodeId: "model",
          lastError: null,
          lastErrorCode: null,
          graphNodes: graph.nodes,
          graphEdges: graph.edges,
          messages: [
            ...state.messages,
            {
              id: createId("asst"),
              role: "assistant",
              content: "",
              timestamp: nowStamp(),
            },
          ],
          timeline: appendTimeline(state.timeline, {
            id: `run_${frame.run_id}_started`,
            label: "Run started",
            detail: frame.model,
            status: "active",
          }),
          trustScore: trust.score,
          trustSignals: trust.signals,
        }));
        return;
      }

      case "run.token": {
        const state = get();
        if (state.activeRunId !== null && frame.run_id !== state.activeRunId) {
          return;
        }

        const messages = [...state.messages];
        const last = messages.at(-1);
        if (!last || last.role !== "assistant") {
          messages.push({
            id: createId("asst"),
            role: "assistant",
            content: frame.delta,
            timestamp: nowStamp(),
          });
        } else {
          messages[messages.length - 1] = {
            ...last,
            content: `${last.content}${frame.delta}`,
          };
        }

        const streamedChars = state.streamedChars + frame.delta.length;
        const enteringStream = state.phase !== "streaming";
        const firstTokenLatencyMs =
          state.firstTokenLatencyMs ??
          (state.runStartedAtMs !== null
            ? Math.max(0, performance.now() - state.runStartedAtMs)
            : null);

        let timeline = state.timeline;
        if (enteringStream) {
          timeline = markTimeline(
            timeline,
            (event) => event.id === `run_${frame.run_id}_started`,
            "complete",
          );
          timeline = appendTimeline(timeline, {
            id: `run_${frame.run_id}_stream`,
            label: "Streaming tokens",
            detail: "live channel",
            status: "active",
          });
        }

        // Only recompute derived projections on the streaming phase transition â€”
        // recomputing per token caused a graph/chart re-render storm during long streams.
        let derived: Partial<SessionState> = {};
        if (enteringStream) {
          const graph = buildRunGraph("streaming", state.activeModel ?? undefined);
          const trust = buildTrustProjection({ connection: state.connection, finishReason: null,
            analysis: null,
          });
          derived = {
            graphNodes: graph.nodes,
            graphEdges: graph.edges,
            trustScore: trust.score,
            trustSignals: trust.signals,
            ...(trust.score !== null
              ? { trustHistory: pushHistory(state.trustHistory, trust.score) }
              : {}),
          };
        }

        set({
          messages,
          streamedChars,
          isStreaming: true,
          phase: "streaming",
          firstTokenLatencyMs,
          selectedNodeId: state.selectedNodeId ?? "stream",
          timeline,
          ...derived,
        });
        return;
      }

      case "run.finished": {
        const state = get();
        if (state.activeRunId !== null && frame.run_id !== state.activeRunId) {
          return;
        }

        const phase: RunPhase =
          frame.finish_reason === "error"
            ? "failed"
            : frame.finish_reason === "cancelled"
              ? "cancelled"
              : "finished";
        const graph = buildRunGraph(phase, state.activeModel ?? undefined);
        const usage = frame.usage ?? null;
        const totalLatencyMs =
          state.runStartedAtMs !== null
            ? Math.max(0, performance.now() - state.runStartedAtMs)
            : null;

        let timeline = markTimeline(
          state.timeline,
          (event) =>
            event.id === `run_${frame.run_id}_started` ||
            event.id === `run_${frame.run_id}_stream`,
          frame.finish_reason === "error" || frame.finish_reason === "cancelled"
            ? "failed"
            : "complete",
        );
        timeline = appendTimeline(timeline, {
          id: `run_${frame.run_id}_finished`,
          label: `Run ${frame.finish_reason}`,
          detail: usage ? `${String(usage.total_tokens)} tokens` : frame.run_id,
          status:
            frame.finish_reason === "error" || frame.finish_reason === "cancelled"
              ? "failed"
              : "complete",
        });

        const messages = [...state.messages];
        const last = messages.at(-1);
        if (last?.role === "assistant" && last.content.trim().length === 0) {
          messages[messages.length - 1] = {
            ...last,
            content:
              frame.finish_reason === "cancelled"
                ? "Run cancelled."
                : frame.finish_reason === "error"
                  ? "Run failed."
                  : last.content,
          };
        }

        // Structural XAI analysis runs only after the final assistant text is complete.
        const assistantText =
          messages.at(-1)?.role === "assistant" ? (messages.at(-1)?.content ?? "") : "";
        const responseAnalysis =
          frame.finish_reason === "error" || frame.finish_reason === "cancelled"
            ? null
            : analyzeResponse(assistantText);

        const trust = buildTrustProjection({ connection: state.connection, finishReason: frame.finish_reason,
          analysis: responseAnalysis,
        });

        const orchestration =
          frame.orchestration && typeof frame.orchestration === "object"
            ? frame.orchestration
            : null;
        const retrievedSources = sourcesFromOrchestration(orchestration);
        const missingRaw = orchestration?.missing_context;
        const missingContext: MissingContextItem[] = Array.isArray(missingRaw)
          ? missingRaw.filter(
              (item): item is MissingContextItem =>
                typeof item === "object" &&
                item !== null &&
                typeof (item as MissingContextItem).item === "string" &&
                typeof (item as MissingContextItem).why_it_matters === "string",
            )
          : [];
        const counter =
          typeof orchestration?.counter_perspective === "string"
            ? orchestration.counter_perspective
            : null;
        const timingsRaw = orchestration?.stage_timings;
        const stageTimings = Array.isArray(timingsRaw)
          ? timingsRaw
              .map((row) => {
                if (typeof row !== "object" || row === null) return null;
                const stage = (row as { stage?: unknown }).stage;
                const duration = (row as { duration_ms?: unknown }).duration_ms;
                if (typeof stage !== "string" || typeof duration !== "number") return null;
                return { stage, duration_ms: duration };
              })
              .filter((row): row is { stage: string; duration_ms: number } => row !== null)
          : [];

        set({
          messages,
          isStreaming: false,
          activeRunId: null,
          phase,
          totalLatencyMs,
          tokenUsage: usage,
          finishReason: frame.finish_reason,
          responseAnalysis,
          orchestration,
          retrievedSources,
          sourcesRetrieved: retrievedSources.length,
          missingContext,
          counterPerspective: counter,
          stageTimings,
          selectedNodeId: phase === "failed" || phase === "cancelled" ? "stream" : "output",
          graphNodes: graph.nodes,
          graphEdges: graph.edges,
          timeline,
          trustScore: trust.score,
          trustSignals: trust.signals,
          trustHistory:
            trust.score !== null
              ? pushHistory(state.trustHistory, trust.score)
              : state.trustHistory,
          ignoredRunIds:
            frame.finish_reason === "cancelled"
              ? [...state.ignoredRunIds, frame.run_id].slice(-12)
              : state.ignoredRunIds,
        });
        return;
      }

      case "error": {
        const state = get();
        const isRunError = Boolean(frame.run_id);
        const graph = isRunError
          ? buildRunGraph("failed", state.activeModel ?? undefined)
          : { nodes: state.graphNodes, edges: state.graphEdges };
        const trust = buildTrustProjection({ connection: state.connection, finishReason: isRunError ? "error" : state.finishReason,
          analysis: isRunError ? null : state.responseAnalysis,
        });

        set({
          lastError: frame.message,
          lastErrorCode: frame.code,
          isStreaming: isRunError ? false : state.isStreaming,
          activeRunId: isRunError ? null : state.activeRunId,
          phase: isRunError ? "failed" : state.phase,
          graphNodes: graph.nodes,
          graphEdges: graph.edges,
          selectedNodeId: isRunError ? "stream" : state.selectedNodeId,
          timeline: appendTimeline(state.timeline, {
            label: "Error",
            detail: `${frame.code}: ${frame.message}`,
            status: "failed",
          }),
          trustScore: trust.score,
          trustSignals: trust.signals,
          trustHistory:
            trust.score !== null
              ? pushHistory(state.trustHistory, trust.score)
              : state.trustHistory,
        });
        return;
      }

      case "stage.started": {
        const state = get();
        if (state.activeRunId !== null && frame.run_id !== state.activeRunId) return;
        const stageEvents: StageEvent[] = [
          ...state.stageEvents,
          {
            stage: frame.stage,
            status: "started",
            detail: frame.detail ?? null,
            at: performance.now(),
          },
        ];
        const stageGraph = buildStageGraph(stageEvents, {
          isStreaming: true,
          mode: state.runMode,
        });
        set({
          stageEvents,
          graphNodes: stageGraph.nodes.length > 0 ? stageGraph.nodes : state.graphNodes,
          graphEdges: stageGraph.edges.length > 0 ? stageGraph.edges : state.graphEdges,
          timeline: appendTimeline(state.timeline, {
            label: `Stage · ${frame.stage}`,
            detail: "started",
            status: "active",
          }),
        });
        return;
      }

      case "stage.complete": {
        const state = get();
        if (state.activeRunId !== null && frame.run_id !== state.activeRunId) return;
        const stageEvents: StageEvent[] = [
          ...state.stageEvents,
          {
            stage: frame.stage,
            status: "complete",
            detail: frame.result ?? null,
            at: performance.now(),
          },
        ];
        const sources =
          frame.stage === "completed" && frame.result && typeof frame.result.sources_retrieved === "number"
            ? frame.result.sources_retrieved
            : state.sourcesRetrieved;
        const stageGraph = buildStageGraph(stageEvents, {
          isStreaming: state.isStreaming,
          mode: state.runMode,
        });
        set({
          stageEvents,
          sourcesRetrieved: typeof sources === "number" ? sources : state.sourcesRetrieved,
          orchestration:
            frame.stage === "completed" && frame.result
              ? frame.result
              : state.orchestration,
          graphNodes: stageGraph.nodes.length > 0 ? stageGraph.nodes : state.graphNodes,
          graphEdges: stageGraph.edges.length > 0 ? stageGraph.edges : state.graphEdges,
          timeline: markTimeline(
            state.timeline,
            (event) => event.label === `Stage · ${frame.stage}` && event.status === "active",
            "complete",
          ),
        });
        return;
      }

      default:
        return;
    }
  },

  sendMessage: (text, options) => {
    const content = text.trim();
    if (!content) return false;

    const client = clientRef;
    if (!client) {
      set({ lastError: "WebSocket is not connected", lastErrorCode: "offline" });
      return false;
    }

    const userMessage: ConversationMessage = {
      id: createId("user"),
      role: "user",
      content,
      timestamp: nowStamp(),
    };

    const messages = [...get().messages, userMessage];
    const wire = toWireMessages(messages);
    const model = get().activeModel ?? get().defaultModel;
    const mode = get().runMode;

    const sent = client.send({
      type: "chat.send",
      messages: wire,
      mode,
      ...(model ? { model } : {}),
      ...(options?.conversationId ? { conversation_id: options.conversationId } : {}),
    });

    if (!sent) {
      set({ lastError: "Failed to send over WebSocket", lastErrorCode: "send_failed" });
      return false;
    }

    const previousRunId = get().activeRunId;
    if (previousRunId) {
      client.send({ type: "run.cancel", run_id: previousRunId });
    }
    // New run clears claim/evidence UI; WorkspacePage also exits focus on stream start.
    useUIStore.getState().exitClaimFocus();
    useUIStore.getState().setEvidenceDemandHighlight(false);
    set({
      messages,
      lastError: null,
      lastErrorCode: null,
      selectedNodeId: "input",
      stageEvents: [],
      responseAnalysis: null,
      orchestration: null,
      retrievedSources: [],
      missingContext: [],
      counterPerspective: null,
      stageTimings: [],
      sourcesRetrieved: 0,
      ignoredRunIds: previousRunId
        ? [...get().ignoredRunIds, previousRunId].slice(-12)
        : get().ignoredRunIds,
      timeline: appendTimeline(get().timeline, {
        label: "User message",
        detail: content.length > 64 ? `${content.slice(0, 64)}…` : content,
        status: "complete",
      }),
    });

    return true;
  },

  retryLast: (options) => {
    const messages = get().messages;
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUser) return false;
    // Drop trailing incomplete/failed assistant turn before retry.
    let trimmed = [...messages];
    while (trimmed.length > 0 && trimmed[trimmed.length - 1]?.role === "assistant") {
      trimmed = trimmed.slice(0, -1);
    }
    set({ messages: trimmed.slice(0, -1) });
    return get().sendMessage(lastUser.content, options);
  },

  stop: () => {
    const client = clientRef;
    const runId = get().activeRunId;
    if (!client) return;

    // Do not ignore this run_id yet — the matching run.finished (cancelled)
    // must still update UI. Stale ignore happens when a newer prompt starts.
    client.send({
      type: "run.cancel",
      run_id: runId,
    });
  },
}));

