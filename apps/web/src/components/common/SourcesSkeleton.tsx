import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SourcesSkeletonProps {
  className?: string | undefined;
  count?: number | undefined;
}

export function SourcesSkeleton({ className, count = 3 }: SourcesSkeletonProps) {
  return (
    <div
      data-testid="sources-skeleton"
      className={cn("flex flex-col gap-3 w-full p-3", className)}
    >
      {/* Header bar skeleton */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 rounded-md bg-cyan-500/20" />
          <Skeleton className="h-3.5 w-28 rounded" />
        </div>
        <Skeleton className="h-4 w-16 rounded-full bg-emerald-500/20" />
      </div>

      {/* Sources cards skeleton */}
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-white/[0.08] bg-[#0c1322]/80 p-3.5 space-y-2.5 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Skeleton className="size-4 rounded shrink-0 bg-cyan-500/20" />
              <Skeleton className="h-3.5 w-3/4 rounded" />
            </div>
            <Skeleton className="h-3 w-12 rounded-full shrink-0" />
          </div>

          <div className="space-y-1.5 pt-1">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-[88%] rounded" />
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
            <Skeleton className="h-2.5 w-20 rounded" />
            <Skeleton className="h-2.5 w-16 rounded ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}
