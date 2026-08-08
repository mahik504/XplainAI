import { motion } from "framer-motion";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DEMO_PROMPTS, getShowcasePrompt, type DemoPrompt } from "@/lib/demo-prompts";
import { cn } from "@/lib/utils";

interface DemoLandingProps {
  disabled?: boolean;
  onSelectPrompt: (prompt: DemoPrompt) => void;
  onRunShowcase: () => void;
  onDismiss?: () => void;
}

/** Lightweight first-run helper — never traps the composer underneath. */
export function DemoLanding({
  disabled = false,
  onSelectPrompt,
  onRunShowcase,
  onDismiss,
}: DemoLandingProps) {
  const showcase = getShowcasePrompt();

  return (
    <motion.aside
      role="dialog"
      aria-label="Quick start examples"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-auto absolute inset-x-4 bottom-[7.5rem] z-40 mx-auto max-w-2xl rounded-2xl border border-border/60 bg-background/90 p-4 shadow-[0_16px_48px_-28px_oklch(0_0_0_/_70%)] backdrop-blur-xl sm:inset-x-auto sm:left-1/2 sm:w-[min(36rem,calc(100%-2rem))] sm:-translate-x-1/2"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold tracking-tight text-foreground">
            XplainAI
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ask a question. Understand the answer.
          </p>
        </div>
        {onDismiss ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label="Dismiss quick start"
            onClick={onDismiss}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      <ul className="grid gap-2 sm:grid-cols-3">
        {DEMO_PROMPTS.filter((item) => !item.showcase)
          .slice(0, 3)
          .map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelectPrompt(item);
                  onDismiss?.();
                }}
                className={cn(
                  "flex h-full w-full flex-col rounded-xl border border-border/50 bg-white/[0.03] px-3 py-2.5 text-left text-xs transition",
                  "hover:border-primary/35 hover:bg-white/[0.05]",
                  "focus-visible:ring-[2px] focus-visible:ring-ring focus-visible:outline-none",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                <span className="font-medium text-foreground">{item.title}</span>
                <span className="mt-1 line-clamp-2 text-muted-foreground">{item.blurb}</span>
              </button>
            </li>
          ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            onRunShowcase();
            onDismiss?.();
          }}
        >
          Run showcase
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Or type below · {showcase.title}
        </p>
      </div>
    </motion.aside>
  );
}
