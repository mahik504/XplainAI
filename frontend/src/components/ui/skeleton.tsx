import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "shimmer" | "glow" | "pulse";
}

export function Skeleton({ className, variant = "shimmer", ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-white/[0.06]",
        variant === "shimmer" && "shimmer-skeleton",
        variant === "pulse" && "animate-pulse bg-white/[0.08]",
        variant === "glow" &&
          "animate-pulse border border-cyan-500/20 bg-cyan-500/[0.05] shadow-[0_0_15px_rgba(0,240,255,0.1)]",
        className,
      )}
      {...props}
    />
  );
}
