import { motion } from "framer-motion";

import type { ResponseStructureAnalysis } from "@/lib/xai";
import { cn } from "@/lib/utils";

const SEGMENTS = [
  { key: "claimCount", label: "Claims", bar: "bg-blue-500", text: "text-blue-400" },
  { key: "evidenceCount", label: "Evidence", bar: "bg-emerald-400", text: "text-emerald-400" },
  { key: "reasoningCount", label: "Reasoning", bar: "bg-violet-400", text: "text-violet-400" },
  { key: "hedgeCount", label: "Hedge", bar: "bg-amber-300", text: "text-amber-300" },
  { key: "exampleCount", label: "Example", bar: "bg-orange-400", text: "text-orange-400" },
] as const;

interface ReasoningAnatomyBarProps {
  analysis: ResponseStructureAnalysis;
  className?: string;
}

export function ReasoningAnatomyBar({ analysis, className }: ReasoningAnatomyBarProps) {
  const { score } = analysis;
  const total = Math.max(
    1,
    score.claimCount +
      score.evidenceCount +
      score.reasoningCount +
      score.hedgeCount +
      score.exampleCount,
  );

  return (
    <div
      className={cn("mt-1.5 w-full max-w-[85%] space-y-1.5 px-0.5", className)}
      aria-label="Response structure anatomy"
    >
      <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
        Response structure
      </p>
      <ul className="flex flex-col gap-1">
        {SEGMENTS.map((segment, index) => {
          const count = score[segment.key];
          const width = Math.round((count / total) * 100);
          return (
            <li key={segment.key} className="flex items-center gap-2">
              <span className={cn("w-16 shrink-0 text-[10px] tabular-nums", segment.text)}>
                {segment.label}
              </span>
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  className={cn("h-full rounded-full", segment.bar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${String(width)}%` }}
                  transition={{
                    duration: 0.45,
                    delay: index * 0.04,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </div>
              <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                {count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
