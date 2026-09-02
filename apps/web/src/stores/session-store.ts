import type { Edge, Node } from "@xyflow/react";
import { create } from "zustand";

import type { ConnectionState } from "@/app/layouts/TopNav";
import type { ConversationMessage } from "@/features/conversation";
import type { TimelineEvent, TimelineStatus } from "@/features/timeline";
import type { TrustPoint, TrustSignal } from "@/features/trust";
import type { RunMode } from "@/lib/run-mode";
import { buildRunGraph, type RunPhase } from "@/lib/run-graph";
import type {
  AssumptionItem,
  ChatWireMessage,
  ContradictionItem,
  DomainCitation,
  DomainClaim,
  DomainEvidence,
  DomainGraph,
  DomainSource,
  FinishReason,
  ServerFrame,
  TrustMetrics,
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

function parseDomainSources(raw: unknown): DomainSource[] {
  if (!Array.isArray(raw)) return [];
  const list: DomainSource[] = [];
  for (let idx = 0; idx < raw.length; idx++) {
    const item = raw[idx];
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    list.push({
      id: typeof r.id === "string" ? r.id : `src_${idx + 1}`,
      title: typeof r.title === "string" ? r.title : "Source Document",
      url: typeof r.url === "string" ? r.url : "",
      domain: typeof r.domain === "string" ? r.domain : "",
      snippet: typeof r.snippet === "string" ? r.snippet : "",
      source_type: (typeof r.source_type === "string" ? r.source_type : "web") as any,
      authority_score: typeof r.authority_score === "number" ? r.authority_score : 0.8,
      published_date: typeof r.published_date === "string" ? r.published_date : null,
      author: typeof r.author === "string" ? r.author : null,
      reliability_tier: (typeof r.reliability_tier === "string" ? r.reliability_tier : "medium") as any,
    });
  }
  return list;
}

function parseDomainEvidence(raw: unknown): DomainEvidence[] {
  if (!Array.isArray(raw)) return [];
  const list: DomainEvidence[] = [];
  for (let idx = 0; idx < raw.length; idx++) {
    const item = raw[idx];
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    list.push({
      id: typeof r.id === "string" ? r.id : `evi_${idx + 1}`,
      source_id: typeof r.source_id === "string" ? r.source_id : "",
      source_title: typeof r.source_title === "string" ? r.source_title : "",
      source_url: typeof r.source_url === "string" ? r.source_url : "",
      text: typeof r.text === "string" ? r.text : "",
      confidence: typeof r.confidence === "number" ? r.confidence : 0.85,
      relevance_score: typeof r.relevance_score === "number" ? r.relevance_score : 0.85,
      chunk_id: typeof r.chunk_id === "string" ? r.chunk_id : null,
      char_start: typeof r.char_start === "number" ? r.char_start : null,
      char_end: typeof r.char_end === "number" ? r.char_end : null,
      bbox: Array.isArray(r.bbox) && r.bbox.length === 4 ? (r.bbox as [number, number, number, number]) : null,
      page_number: typeof r.page_number === "number" ? r.page_number : null,
    });
  }
  return list;
}

function parseDomainClaims(raw: unknown): DomainClaim[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (typeof item !== "object" || item === null) return null;
      const r = item as Record<string, unknown>;
      return {
        id: typeof r.id === "string" ? r.id : `clm_${idx + 1}`,
        text: typeof r.text === "string" ? r.text : "",
        status: (typeof r.status === "string" ? r.status : "unverified") as any,
        evidence_ids: Array.isArray(r.evidence_ids)
          ? r.evidence_ids.filter((id): id is string => typeof id === "string")
          : [],
        confidence: typeof r.confidence === "number" ? r.confidence : 0.7,
        importance: typeof r.importance === "string" ? r.importance : "medium",
        sentence_index: typeof r.sentence_index === "number" ? r.sentence_index : idx,
      };
    })
    .filter((c): c is DomainClaim => c !== null);
}

function parseDomainCitations(raw: unknown): DomainCitation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (typeof item !== "object" || item === null) return null;
      const r = item as Record<string, unknown>;
      return {
        id: typeof r.id === "string" ? r.id : `cit_${idx + 1}`,
        claim_id: typeof r.claim_id === "string" ? r.claim_id : "",
        source_id: typeof r.source_id === "string" ? r.source_id : "",
        evidence_id: typeof r.evidence_id === "string" ? r.evidence_id : "",
        inline_marker: typeof r.inline_marker === "string" ? r.inline_marker : `[${idx + 1}]`,
        citation_index: typeof r.citation_index === "number" ? r.citation_index : idx + 1,
      };
    })
    .filter((cit): cit is DomainCitation => cit !== null);
}

function parseDomainGraph(raw: unknown): DomainGraph | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const nodesRaw = Array.isArray(r.nodes) ? r.nodes : [];
  const edgesRaw = Array.isArray(r.edges) ? r.edges : [];
  const nodes = nodesRaw
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const n = item as Record<string, unknown>;
      return {
        id: typeof n.id === "string" ? n.id : "",
        type: (typeof n.type === "string" ? n.type : "evidence") as any,
        label: typeof n.label === "string" ? n.label : "",
        description: typeof n.description === "string" ? n.description : "",
        metadata: typeof n.metadata === "object" && n.metadata !== null ? (n.metadata as Record<string, unknown>) : undefined,
        position_3d: Array.isArray(n.position_3d) && n.position_3d.length === 3 ? (n.position_3d as [number, number, number]) : undefined,
        status: typeof n.status === "string" ? n.status : undefined,
        cluster: typeof n.cluster === "string" ? n.cluster : undefined,
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null && n.id.length > 0);

  const edges = edgesRaw
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const e = item as Record<string, unknown>;
      return {
        id: typeof e.id === "string" ? e.id : "",
        source_node_id: typeof e.source_node_id === "string" ? e.source_node_id : "",
        target_node_id: typeof e.target_node_id === "string" ? e.target_node_id : "",
        type: (typeof e.type === "string" ? e.type : "supports") as any,
        weight: typeof e.weight === "number" ? e.weight : 1.0,
        label: typeof e.label === "string" ? e.label : null,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null && e.id.length > 0);

  return {
    nodes,
    edges,
    node_count: typeof r.node_count === "number" ? r.node_count : nodes.length,
    edge_count: typeof r.edge_count === "number" ? r.edge_count : edges.length,
    density: typeof r.density === "number" ? r.density : 0,
    cluster_count: typeof r.cluster_count === "number" ? r.cluster_count : 1,
  };
}

function parseTrustMetrics(raw: unknown): TrustMetrics | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  return {
    source_quality: typeof r.source_quality === "number" ? r.source_quality : 0.85,
    evidence_confidence: typeof r.evidence_confidence === "number" ? r.evidence_confidence : 0.85,
    claim_grounding: typeof r.claim_grounding === "number" ? r.claim_grounding : 0.85,
    citation_fidelity: typeof r.citation_fidelity === "number" ? r.citation_fidelity : 0.9,
    contradiction_penalty: typeof r.contradiction_penalty === "number" ? r.contradiction_penalty : 0.0,
    formula: typeof r.formula === "string" ? r.formula : undefined,
  };
}

function parseContradictions(raw: unknown): ContradictionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (typeof item !== "object" || item === null) return null;
      const r = item as Record<string, unknown>;
      return {
        id: typeof r.id === "string" ? r.id : `con_${idx + 1}`,
        claim_id: typeof r.claim_id === "string" ? r.claim_id : "",
        evidence_a_id: typeof r.evidence_a_id === "string" ? r.evidence_a_id : "",
        evidence_b_id: typeof r.evidence_b_id === "string" ? r.evidence_b_id : "",
        explanation: typeof r.explanation === "string" ? r.explanation : "",
        severity: typeof r.severity === "string" ? r.severity : "moderate",
        contradiction_type: typeof r.contradiction_type === "string" ? r.contradiction_type : "direct_negation",
      };
    })
    .filter((c): c is ContradictionItem => c !== null);
}

function parseAssumptions(raw: unknown): AssumptionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (typeof item !== "object" || item === null) return null;
      const r = item as Record<string, unknown>;
      return {
        id: typeof r.id === "string" ? r.id : `asm_${idx + 1}`,
        text: typeof r.text === "string" ? r.text : "",
        grounded_score: typeof r.grounded_score === "number" ? r.grounded_score : 0.5,
        risk_level: typeof r.risk_level === "string" ? r.risk_level : "low",
      };
    })
    .filter((a): a is AssumptionItem => a !== null);
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
  domainSources: DomainSource[];
  domainEvidence: DomainEvidence[];
  domainClaims: DomainClaim[];
  domainCitations: DomainCitation[];
  domainGraph: DomainGraph | null;
  egiScore: number | null;
  trustMetrics: TrustMetrics | null;
  contradictions: ContradictionItem[];
  assumptions: AssumptionItem[];
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
  runMode: "deep_research",
  stageEvents: [],
  orchestration: null,
  sourcesRetrieved: 0,
  retrievedSources: [],
  domainSources: [],
  domainEvidence: [],
  domainClaims: [],
  domainCitations: [],
  domainGraph: null,
  egiScore: null,
  trustMetrics: null,
  contradictions: [],
  assumptions: [],
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
      domainSources: [],
      domainEvidence: [],
      domainClaims: [],
      domainCitations: [],
      domainGraph: null,
      egiScore: null,
      trustMetrics: null,
      contradictions: [],
      assumptions: [],
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
      domainSources: [],
      domainEvidence: [],
      domainClaims: [],
      domainCitations: [],
      domainGraph: null,
      egiScore: null,
      trustMetrics: null,
      contradictions: [],
      assumptions: [],
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
      // forever once the client reconnects — no run.finished will ever arrive for it.
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

        // Only recompute derived projections on the streaming phase transition —
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
        const domainSources = parseDomainSources(
          orchestration?.domain_sources ?? orchestration?.sources ?? retrievedSources,
        );
        const domainEvidence = parseDomainEvidence(orchestration?.domain_evidence);
        const domainClaims = parseDomainClaims(orchestration?.domain_claims);
        const domainCitations = parseDomainCitations(orchestration?.domain_citations);
        const domainGraph = parseDomainGraph(orchestration?.domain_graph);
        const egiScore =
          typeof orchestration?.egi_score === "number" ? orchestration.egi_score : null;
        const trustMetrics = parseTrustMetrics(orchestration?.trust_metrics);
        const contradictions = parseContradictions(orchestration?.contradictions);
        const assumptions = parseAssumptions(orchestration?.assumptions);

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
          sourcesRetrieved: retrievedSources.length || domainSources.length,
          domainSources,
          domainEvidence,
          domainClaims,
          domainCitations,
          domainGraph,
          egiScore,
          trustMetrics,
          contradictions,
          assumptions,
          missingContext,
          counterPerspective: counter,
          stageTimings,
          selectedNodeId: phase === "failed" || phase === "cancelled" ? "stream" : "output",
          graphNodes: graph.nodes,
          graphEdges: graph.edges,
          timeline,
          trustScore: egiScore ?? trust.score,
          trustSignals: trust.signals,
          trustHistory:
            (egiScore ?? trust.score) !== null
              ? pushHistory(state.trustHistory, egiScore ?? trust.score ?? 0)
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

    const customApiBase = useUIStore.getState().customApiBase;
    const customApiKey = useUIStore.getState().customApiKey;
    const hasCustomConfig =
      typeof customApiKey === "string" &&
      typeof customApiBase === "string" &&
      customApiKey.trim().length > 0 &&
      customApiBase.trim().length > 0;

    const sent = client.send({
      type: "chat.send",
      messages: wire,
      mode,
      ...(model ? { model } : {}),
      ...(options?.conversationId ? { conversation_id: options.conversationId } : {}),
      ...(hasCustomConfig
        ? {
            custom_api_base: customApiBase.trim(),
            custom_api_key: customApiKey.trim(),
          }
        : {}),
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

