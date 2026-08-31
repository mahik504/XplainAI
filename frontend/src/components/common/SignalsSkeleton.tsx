import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SignalsSkeletonProps {
  className?: string | undefined;
}

export function SignalsSkeleton({ className }: SignalsSkeletonProps) {
  return (
    <div
      data-testid="signals-skeleton"
      className={cn("flex flex-col gap-4 w-full p-3", className)}
    >
      {/* Overview gauge skeleton */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c1322]/90 p-4 space-y-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-32 rounded" />
          <Skeleton className="h-4 w-12 rounded-full bg-cyan-500/20" />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="flex flex-col gap-1.5 rounded-xl border border-white/[0.06] bg-black/30 p-3">
            <Skeleton className="h-2.5 w-20 rounded" />
            <Skeleton className="h-6 w-16 rounded bg-cyan-500/15" />
          </div>
          <div className="flex flex-col gap-1.5 rounded-xl border border-white/[0.06] bg-black/30 p-3">
            <Skeleton className="h-2.5 w-20 rounded" />
            <Skeleton className="h-6 w-16 rounded bg-emerald-500/15" />
          </div>
        </div>
      </div>

      {/* Metric Breakdown Bars */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0a0f1d]/85 p-4 space-y-3.5 backdrop-blur-xl">
        <Skeleton className="h-3.5 w-28 rounded" />

        {[
          { label: "Assertion Density", color: "bg-cyan-500/20" },
          { label: "Evidence Grounding", color: "bg-emerald-500/20" },
          { label: "Hedge Uncertainty", color: "bg-amber-500/20" },
          { label: "Dialectic Contradiction", color: "bg-rose-500/20" },
        ].map((item, idx) => (
          <div key={idx} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <Skeleton className="h-2.5 w-24 rounded" />
              <Skeleton className="h-2.5 w-8 rounded" />
            </div>
            <Skeleton className={cn("h-2 w-full rounded-full", item.color)} />
          </div>
        ))}
      </div>
    </div>
  );
}
