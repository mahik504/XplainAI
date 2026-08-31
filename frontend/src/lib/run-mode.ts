export type RunMode = "fast" | "deep_research";

export interface RunModeMeta {
  id: RunMode;
  label: string;
  short: string;
  description: string;
  icon: "zap" | "search";
}

export const FAST_MODE_META: RunModeMeta = {
  id: "fast",
  label: "Fast Mode",
  short: "⚡ Fast",
  description: "Direct single-pass LLM answer (<250ms)",
  icon: "zap",
};

export const DEEP_RESEARCH_MODE_META: RunModeMeta = {
  id: "deep_research",
  label: "Deep Research",
  short: "🔬 Deep Research",
  description: "Multi-Agent ArXiv, Wikipedia, Web & 3D Knowledge Graph",
  icon: "search",
};

export const RUN_MODES: RunModeMeta[] = [FAST_MODE_META, DEEP_RESEARCH_MODE_META];

export function getRunModeMeta(mode: RunMode): RunModeMeta {
  if (mode === "fast") return FAST_MODE_META;
  return DEEP_RESEARCH_MODE_META;
}
