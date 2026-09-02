import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PanelProps {
  active?: boolean | undefined;
  className?: string | undefined;
}

interface PanelShellProps extends PanelProps {
  title: string;
  description?: string | undefined;
  icon: LucideIcon;
  actions?: ReactNode;
  footer?: ReactNode;
  contentClassName?: string | undefined;
  children: ReactNode;
}

export function PanelShell({
  title,
  description,
  icon: Icon,
  actions,
  footer,
  active = false,
  className,
  contentClassName,
  children,
}: PanelShellProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "glass-panel flex min-h-0 min-w-0 flex-col overflow-hidden transition-[border-color,box-shadow,transform] duration-300 hover:border-white/15",
        active && "panel-active",
        className,
      )}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-white/[0.04] text-muted-foreground transition-colors",
              active && "border-neon-cyan/40 bg-neon-cyan/12 text-neon-cyan",
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </header>

      <div className={cn("min-h-0 flex-1 overflow-hidden", contentClassName)}>{children}</div>

      {footer ? (
        <footer className="shrink-0 border-t border-border/70 px-4 py-3">{footer}</footer>
      ) : null}
    </motion.section>
  );
}
