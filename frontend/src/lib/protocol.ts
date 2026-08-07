export type FinishReason = "stop" | "length" | "cancelled" | "error" | "tool_calls";

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
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
  | HeartbeatFrame
  | PongFrame
  | ErrorFrame;

export interface ChatSendClientFrame {
  type: "chat.send";
  messages: ChatWireMessage[];
  model?: string | null;
  temperature?: number | null;
  max_output_tokens?: number | null;
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
    type === "heartbeat" ||
    type === "pong" ||
    type === "error"
  );
}
