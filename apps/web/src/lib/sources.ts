/** Retrieved external sources — distinct from response-structure "evidence markers". */

export type SourceType = "web" | "news" | "weather" | "calculator" | "document" | "other";

export interface RetrievedSource {
  source_id: string;
  title: string;
  url?: string;
  source_type: SourceType;
  tool: string;
  snippet?: string;
  retrieved_at?: string;
}

export function sourcesFromOrchestration(
  orchestration: Record<string, unknown> | null | undefined,
): RetrievedSource[] {
  if (!orchestration) return [];
  const raw = orchestration.sources;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRetrievedSource);
}

function isRetrievedSource(value: unknown): value is RetrievedSource {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.source_id === "string" && typeof row.title === "string" && typeof row.tool === "string";
}
