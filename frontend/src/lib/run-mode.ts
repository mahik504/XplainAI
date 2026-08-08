export type RunMode = "fast" | "balanced" | "deep_research";

export interface RunModeMeta {
  id: RunMode;
  label: string;
  short: string;
  description: string;
  icon: "zap" | "scale" | "search";
}

export const RUN_MODES: RunModeMeta[] = [
  {
    id: "fast",
    label: "Fast",
    short: "⚡ Fast",
    description: "Quick answer",
    icon: "zap",
  },
  {
    id: "balanced",
    label: "Balanced",
    short: "◉ Balanced",
    description: "Selective research",
    icon: "scale",
  },
  {
    id: "deep_research",
    label: "Deep Research",
    short: "🔬 Deep Research",
    description: "Multi-step research",
    icon: "search",
  },
];

export function getRunModeMeta(mode: RunMode): RunModeMeta {
  const found = RUN_MODES.find((item) => item.id === mode);
  if (found) return found;
  return {
    id: "balanced",
    label: "Balanced",
    short: "Balanced",
    description: "Best default · selective evidence",
    icon: "scale",
  };
}
