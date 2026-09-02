import { Check, CircleDashed, Loader2, Minus } from "lucide-react";

import { buildStageGraph, type StageEvent } from "@/lib/stage-graph";
import { cn } from "@/lib/utils";

interface StageRailProps {
  events: StageEvent[];
  isStreaming: boolean;
  mode?: string | null;
  className?: string;
}

function asText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function StageRail({ events, isStreaming, mode = null, className }: StageRailProps) {
  const { nodes } = buildStageGraph(events, { isStreaming, mode });
  if (nodes.length === 0 && !isStreaming) {
    return (
      <p className={cn("px-1 py-2 text-xs text-muted-foreground", className)}>
        Stages appear while a response is generated.
      </p>
    );
  }

  return (
    <ol className={cn("space-y-1", className)}>
      {nodes.map((node, index) => {
        const tone = asText(node.data.tone, "pending");
        const label = asText(node.data.label, "Stage");
        const subtitle = typeof node.data.subtitle === "string" ? node.data.subtitle : null;
        return (
          <li key={node.id} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex flex-col items-center">
              <StatusIcon tone={tone} />
              {index < nodes.length - 1 ? (
                <span
                  className={cn(
                    "mt-1 h-3 w-px",
                    tone === "complete" ? "bg-neon-emerald/40" : "bg-border/70",
                  )}
                />
              ) : null}
            </span>
            <span className="min-w-0 pb-2">
              <span
                className={cn(
                  "block text-xs font-medium",
                  tone === "skipped" ? "text-muted-foreground line-through" : "text-foreground",
                )}
              >
                {label}
              </span>
              {subtitle ? (
                <span className="block text-[11px] text-muted-foreground">{subtitle}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StatusIcon({ tone }: { tone: string }) {
  if (tone === "active") {
    return <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />;
  }
  if (tone === "complete") {
    return <Check className="size-3.5 text-neon-emerald" aria-hidden />;
  }
  if (tone === "failed") {
    return <CircleDashed className="size-3.5 text-destructive" aria-hidden />;
  }
  if (tone === "skipped") {
    return <Minus className="size-3.5 text-muted-foreground/70" aria-hidden />;
  }
  return <CircleDashed className="size-3.5 text-muted-foreground/50" aria-hidden />;
}
