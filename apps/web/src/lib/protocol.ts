export type FinishReason = "stop" | "length" | "cancelled" | "error" | "tool_calls";

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export type SourceType =
  | "paper"
  | "document"
  | "documentation"
  | "tool"
  | "web"
  | "system";

export type ClaimStatus =
  | "supported"
  | "weakly_supported"
  | "contradicted"
  | "unverified";

export type GraphNodeType =
  | "source"
  | "evidence"
  | "claim"
  | "contradiction"
  | "assumption"
  | "inference"
  | "conclusion";

export type GraphEdgeType =
  | "supports"
  | "contradicts"
  | "cites"
  | "confirms"
  | "challenges"
  | "derived_from"
  | "attributes"
  | "contradiction";

export interface DomainSource {
  id: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  source_type: SourceType;
  authority_score: number;
  published_date?: string | null | undefined;
  author?: string | null | undefined;
  reliability_tier?: "high" | "medium" | "low" | string | undefined;
}

export interface DomainEvidence {
  id: string;
  source_id: string;
  source_title: string;
  source_url: string;
  text: string;
  confidence: number;
  relevance_score: number;
  chunk_id?: string | null | undefined;
  char_start?: number | null | undefined;
  char_end?: number | null | undefined;
  bbox?: [number, number, number, number] | null | undefined;
  page_number?: number | null | undefined;
}

export interface DomainClaim {
  id: string;
  text: string;
  status: ClaimStatus;
  evidence_ids: string[];
  confidence: number;
  importance: "core" | "high" | "medium" | "low" | string;
  sentence_index: number;
}

export interface DomainCitation {
  id: string;
  claim_id: string;
  source_id: string;
  evidence_id: string;
  inline_marker: string;
  citation_index: number;
}

export interface ContradictionItem {
  id: string;
  claim_id: string;
  evidence_a_id: string;
  evidence_b_id: string;
  explanation: string;
  severity: "critical" | "moderate" | "minor" | string;
  contradiction_type:
    | "direct_negation"
    | "temporal_shift"
    | "numerical_discrepancy"
    | "scope_conflict"
    | string;
}

export interface AssumptionItem {
  id: string;
  text: string;
  grounded_score: number;
  risk_level: "low" | "medium" | "high" | string;
}

export interface DomainGraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  description: string;
  metadata?: Record<string, unknown> | undefined;
  position_3d?: [number, number, number] | undefined;
  status?: string | undefined;
  cluster?: string | undefined;
}

export interface DomainGraphEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  type: GraphEdgeType;
  weight?: number | undefined;
  label?: string | null | undefined;
}

export interface DomainGraph {
  nodes: DomainGraphNode[];
  edges: DomainGraphEdge[];
  node_count?: number | undefined;
  edge_count?: number | undefined;
  density?: number | undefined;
  cluster_count?: number | undefined;
}

export interface TrustMetrics {
  source_quality: number;
  evidence_confidence: number;
  claim_grounding: number;
  citation_fidelity: number;
  contradiction_penalty: number;
  formula?: string | undefined;
}

export interface StageTiming {
  stage: string;
  duration_ms: number;
}

export interface ChatWireMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

interface WSFrameBase {
  id: string;
  seq: number;
  ts: string;
}

export interface ConnectionReadyFrame extends WSFrameBase {
  type: "connection.ready";
  connection_id: string;
  protocol_version: number;
  heartbeat_interval_seconds: number;
  max_message_bytes: number;
}

export interface RunStartedFrame extends WSFrameBase {
  type: "run.started";
  run_id: string;
  model: string;
}

export interface RunTokenFrame extends WSFrameBase {
  type: "run.token";
  run_id: string;
  delta: string;
}

export interface RunFinishedFrame extends WSFrameBase {
  type: "run.finished";
  run_id: string;
  finish_reason: FinishReason;
  usage?: Usage | null;
  mode?: string | null;
  orchestration?: Record<string, unknown> | null;
}

export interface StageStartedFrame extends WSFrameBase {
  type: "stage.started";
  run_id: string;
  stage: string;
  detail?: Record<string, unknown> | null;
}

export interface StageCompleteFrame extends WSFrameBase {
  type: "stage.complete";
  run_id: string;
  stage: string;
  result?: Record<string, unknown> | null;
}

export interface HeartbeatFrame extends WSFrameBase {
  type: "heartbeat";
}

export interface PongFrame extends WSFrameBase {
  type: "pong";
}

export interface ErrorFrame extends WSFrameBase {
  type: "error";
  code: string;
  message: string;
  run_id?: string | null;
}

export type ServerFrame =
  | ConnectionReadyFrame
  | RunStartedFrame
  | RunTokenFrame
  | RunFinishedFrame
  | StageStartedFrame
  | StageCompleteFrame
  | HeartbeatFrame
  | PongFrame
  | ErrorFrame;

export interface ChatSendClientFrame {
  type: "chat.send";
  messages: ChatWireMessage[];
  model?: string | null;
  temperature?: number | null;
  max_output_tokens?: number | null;
  mode?: string | null;
  conversation_id?: string | null;
}

export interface RunCancelClientFrame {
  type: "run.cancel";
  run_id?: string | null;
}

export interface PingClientFrame {
  type: "ping";
}

export type ClientFrame = ChatSendClientFrame | RunCancelClientFrame | PingClientFrame;

export function isServerFrame(value: unknown): value is ServerFrame {
  if (typeof value !== "object" || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return (
    type === "connection.ready" ||
    type === "run.started" ||
    type === "run.token" ||
    type === "run.finished" ||
    type === "stage.started" ||
    type === "stage.complete" ||
    type === "heartbeat" ||
    type === "pong" ||
    type === "error"
  );
}
