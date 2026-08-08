/**
 * Public surface for shared API contracts.
 * HTTP types come from OpenAPI codegen; WS frames are hand-maintained stubs
 * until AsyncAPI → TypeScript generation is wired.
 */
export type * from "./generated/http.js";
export type * from "./generated/ws.js";
