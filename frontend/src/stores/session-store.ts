import type { Edge, Node } from "@xyflow/react";
import { create } from "zustand";

import type { ConnectionState } from "@/app/layouts/TopNav";
import type { ConversationMessage } from "@/features/conversation";
import type { TimelineEvent, TimelineStatus } from "@/features/timeline";
import type { TrustPoint, TrustSignal } from "@/features/trust";
import { buildRunGraph, type RunPhase } from "@/lib/run-graph";
import type {
  ChatWireMessage,
  FinishReason,
  ServerFrame,
  Usage,
} from "@/lib/protocol";
import type { WsClient } from "@/lib/ws-client";
import {
  analyzeResponse,
  type ResponseStructureAnalysis,
} from "@/lib/xai";

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
  lastError: string | null;
  lastErrorCode: string | null;
  bindClient: (client: WsClient | null) => void;
  setConnection: (connection: ConnectionState) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setModelCatalog: (input: { provider: string; defaultModel: string }) => void;
  applyFrame: (frame: ServerFrame) => void;
  sendMessage: (text: string) => boolean;
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
  lastError: null,
  lastErrorCode: null,

  bindClient: (client) => {
    clientRef = client;
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

  setModelCatalog: ({ provider, defaultModel }) => {
    set({
      providerName: provider,
      defaultModel,
      activeModel: get().activeModel ?? defaultModel,
    });
  },

  applyFrame: (frame) => {
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

        set({
          messages,
          isStreaming: false,
          activeRunId: null,
          phase,
          totalLatencyMs,
          tokenUsage: usage,
          finishReason: frame.finish_reason,
          responseAnalysis,
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

      default:
        return;
    }
  },

  sendMessage: (text) => {
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

    const sent = client.send({
      type: "chat.send",
      messages: wire,
      ...(model ? { model } : {}),
    });

    if (!sent) {
      set({ lastError: "Failed to send over WebSocket", lastErrorCode: "send_failed" });
      return false;
    }

    set({
      messages,
      lastError: null,
      lastErrorCode: null,
      selectedNodeId: "input",
      timeline: appendTimeline(get().timeline, {
        label: "User message",
        detail: content.length > 64 ? `${content.slice(0, 64)}â€¦` : content,
        status: "complete",
      }),
    });

    return true;
  },

  stop: () => {
    const client = clientRef;
    const runId = get().activeRunId;
    if (!client) return;

    client.send({
      type: "run.cancel",
      run_id: runId,
    });
  },
}));

