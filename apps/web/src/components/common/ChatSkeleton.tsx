import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChatSkeletonProps {
  className?: string | undefined;
  count?: number | undefined;
}

export function ChatSkeleton({ className, count = 2 }: ChatSkeletonProps) {
  return (
    <div
      data-testid="chat-skeleton"
      className={cn("flex flex-col gap-6 p-4 max-w-3xl mx-auto w-full", className)}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="flex flex-col gap-4">
          {/* User message placeholder */}
          <div className="flex justify-end">
            <div className="flex flex-col items-end gap-2 max-w-[70%]">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-14 w-64 rounded-2xl bg-cyan-950/20 border border-cyan-500/20" />
            </div>
          </div>

          {/* Assistant message placeholder */}
          <div className="flex justify-start">
            <div className="flex flex-col gap-3 w-full max-w-[85%] rounded-2xl border border-white/[0.08] bg-[#0a0f1d]/80 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <Skeleton className="size-6 rounded-full bg-cyan-500/20" />
                <Skeleton className="h-3.5 w-32 rounded" />
                <Skeleton className="ml-auto h-3 w-16 rounded-full" />
              </div>

              <div className="space-y-2 pt-1">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-[92%] rounded" />
                <Skeleton className="h-4 w-[78%] rounded" />
              </div>

              {/* Anatomy chip shimmers */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                <Skeleton className="h-5 w-20 rounded-md bg-cyan-500/15" />
                <Skeleton className="h-5 w-24 rounded-md bg-emerald-500/15" />
                <Skeleton className="h-5 w-16 rounded-md bg-indigo-500/15" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
