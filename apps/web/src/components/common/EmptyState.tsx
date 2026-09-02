import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="relative grid size-12 place-items-center rounded-2xl border border-border bg-white/[0.03]">
        <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-neon-cyan/12 to-neon-violet/12 blur-md" />
        <Icon className="relative size-5 text-muted-foreground" />
      </span>
      <div className="max-w-[34ch] space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
