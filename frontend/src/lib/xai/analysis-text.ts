/**
 * Project raw assistant text into an analysis-safe plain string.
 * Display continues to use the original markdown; analysis never tokenizes
 * fenced code as claims.
 */

export function toAnalysisText(raw: string): string {
  if (!raw) return "";

  // Preserve code fences as opaque placeholders (single neutral unit).
  let text = raw.replace(/```[\s\S]*?```/g, () => `\n[code block]\n`);

  // Strip common markdown markers without destroying sentence boundaries.
  text = text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  return text.replace(/\n{3,}/g, "\n\n").trim();
}
