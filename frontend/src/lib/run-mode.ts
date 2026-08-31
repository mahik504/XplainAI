export type RunMode = "fast" | "balanced" | "deep_research" | "complex";

export interface RunModeMeta {
  id: RunMode;
  label: string;
  short: string;
  description: string;
  icon: "zap" | "scale" | "search" | "rocket";
}

export const FAST_MODE_META: RunModeMeta = {
  id: "fast",
  label: "Fast Mode",
  short: "⚡ Fast",
  description: "Direct single-pass LLM answer (<250ms)",
  icon: "zap",
};

export const BALANCED_MODE_META: RunModeMeta = {
  id: "balanced",
  label: "Balanced",
  short: "⚖️ Balanced",
  description: "Standard Agentic Search (1-2 sources)",
  icon: "scale",
};

export const DEEP_RESEARCH_MODE_META: RunModeMeta = {
  id: "deep_research",
  label: "Deep Research",
  short: "🔍 Deep Research",
  description: "Multi-Agent Web & Knowledge Graph",
  icon: "search",
};

export const COMPLEX_MODE_META: RunModeMeta = {
  id: "complex",
  label: "Complex (/goal)",
  short: "🚀 Complex",
  description: "Iterative Deep Web, PDF, YouTube Transcribing",
  icon: "rocket",
};

export const RUN_MODES: RunModeMeta[] = [
  FAST_MODE_META,
  BALANCED_MODE_META,
  DEEP_RESEARCH_MODE_META,
  COMPLEX_MODE_META,
];

export function getRunModeMeta(mode: RunMode): RunModeMeta {
  if (mode === "fast") return FAST_MODE_META;
  if (mode === "balanced") return BALANCED_MODE_META;
  if (mode === "complex") return COMPLEX_MODE_META;
  return DEEP_RESEARCH_MODE_META;
}
