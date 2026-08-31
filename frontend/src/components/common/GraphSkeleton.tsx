import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface GraphSkeletonProps {
  className?: string | undefined;
}

export function GraphSkeleton({ className }: GraphSkeletonProps) {
  return (
    <div
      data-testid="graph-skeleton"
      className={cn(
        "relative flex size-full items-center justify-center overflow-hidden bg-[#050811]/90 backdrop-blur-2xl p-6",
        className,
      )}
    >
      {/* Background grid shimmer */}
      <div className="absolute inset-0 bg-[radial-gradient(#00f0ff_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />

      {/* Pulsing DAG Nodes and Edges Skeleton Layout */}
      <div className="relative flex flex-col items-center gap-8 w-full max-w-lg">
        {/* Root Node */}
        <div className="rounded-xl border border-cyan-500/30 bg-[#0a0f1d]/90 p-3 w-48 shadow-[0_0_20px_rgba(0,240,255,0.15)] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Skeleton className="size-3 rounded-full bg-cyan-400/50 animate-ping" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
          <Skeleton className="mt-2 h-2 w-36 rounded" />
        </div>

        {/* Connecting SVG laser edge lines */}
        <svg className="h-10 w-full overflow-visible">
          <line
            x1="50%"
            y1="0"
            x2="25%"
            y2="100%"
            stroke="rgba(0, 240, 255, 0.4)"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="animate-pulse"
          />
          <line
            x1="50%"
            y1="0"
            x2="75%"
            y2="100%"
            stroke="rgba(16, 185, 129, 0.4)"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="animate-pulse"
          />
        </svg>

        {/* Branch Nodes */}
        <div className="flex w-full justify-between gap-6">
          <div className="flex-1 rounded-xl border border-cyan-500/20 bg-[#0a0f1d]/85 p-3 backdrop-blur-xl">
            <Skeleton className="h-3 w-20 rounded bg-cyan-500/20" />
            <Skeleton className="mt-2 h-2 w-28 rounded" />
          </div>

          <div className="flex-1 rounded-xl border border-emerald-500/20 bg-[#0a0f1d]/85 p-3 backdrop-blur-xl">
            <Skeleton className="h-3 w-24 rounded bg-emerald-500/20" />
            <Skeleton className="mt-2 h-2 w-28 rounded" />
          </div>
        </div>

        {/* Connecting SVG lower laser edges */}
        <svg className="h-10 w-full overflow-visible">
          <line
            x1="25%"
            y1="0"
            x2="50%"
            y2="100%"
            stroke="rgba(129, 140, 248, 0.4)"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="animate-pulse"
          />
          <line
            x1="75%"
            y1="0"
            x2="50%"
            y2="100%"
            stroke="rgba(129, 140, 248, 0.4)"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="animate-pulse"
          />
        </svg>

        {/* Synthesis Node */}
        <div className="rounded-xl border border-indigo-500/30 bg-[#0a0f1d]/90 p-3 w-52 shadow-[0_0_20px_rgba(99,102,241,0.15)] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Skeleton className="size-3 rounded-full bg-indigo-400/50 animate-ping" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
          <Skeleton className="mt-2 h-2 w-40 rounded" />
        </div>
      </div>

      {/* Top Controls Overlay Placeholder */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/40 p-1">
        <Skeleton className="size-6 rounded" />
        <Skeleton className="size-6 rounded" />
        <Skeleton className="size-6 rounded" />
      </div>
    </div>
  );
}
