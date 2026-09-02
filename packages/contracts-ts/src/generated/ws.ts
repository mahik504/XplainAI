/**
 * WebSocket frame stubs — runtime validation lives in the frontend WS client.
 * Kept so `@neural-navigator/contracts/ws` resolves during package builds.
 */
export type WsClientFrame =
  | { type: "chat.send"; messages: unknown[]; mode?: string; model?: string; conversation_id?: string }
  | { type: "run.cancel"; run_id: string | null };

export type WsServerFrame = {
  type: string;
  run_id?: string;
  [key: string]: unknown;
};
