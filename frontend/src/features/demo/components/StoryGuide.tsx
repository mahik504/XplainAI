import { AnimatePresence, motion } from "framer-motion";
import { Compass, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STORY_STEPS, storyStepIndex, type StoryStepId } from "@/lib/story-mode";
import { cn } from "@/lib/utils";

interface StoryGuideProps {
  activeStep: StoryStepId | null;
  judgeMode?: boolean;
  onDismiss?: () => void;
}

export function StoryGuide({
  activeStep,
  judgeMode = false,
  onDismiss,
}: StoryGuideProps) {
  const activeIndex = storyStepIndex(activeStep);
  const current = activeIndex >= 0 ? STORY_STEPS[activeIndex] : null;

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-40 w-[min(100%,20rem)]">
      <motion.div
        layout
        className="pointer-events-auto glass-panel overflow-hidden shadow-[0_20px_50px_-28px_oklch(0_0_0_/_70%)]"
      >
        <header className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md border border-neon-cyan/30 bg-neon-cyan/10">
              <Compass className="size-3 text-neon-cyan" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-foreground">
                {judgeMode ? "Judge Mode" : "Story Mode"}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                Guided explainability walkthrough
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {judgeMode ? <Badge variant="violet">Showcase</Badge> : null}
            {onDismiss ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={onDismiss}
              >
                <X className="size-3.5" />
                <span className="sr-only">Dismiss story guide</span>
              </Button>
            ) : null}
          </div>
        </header>

        <ol className="max-h-48 space-y-0.5 overflow-y-auto px-2 py-2 scrollbar-slim">
          {STORY_STEPS.map((step, index) => {
            const state =
              activeIndex < 0
                ? "pending"
                : index < activeIndex
                  ? "done"
                  : index === activeIndex
                    ? "active"
                    : "pending";

            return (
              <li key={step.id}>
                <div
                  className={cn(
                    "rounded-lg px-2 py-1.5 transition-colors duration-300",
                    state === "active" && "bg-neon-cyan/10",
                    state === "done" && "opacity-55",
                    state === "pending" && "opacity-35",
                  )}
                >
                  <p
                    className={cn(
                      "text-[11px] font-medium",
                      state === "active" ? "text-neon-cyan" : "text-foreground/85",
                    )}
                  >
                    {step.title}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        <AnimatePresence mode="wait">
          {current ? (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="border-t border-border/50 px-3 py-2.5"
            >
              <p className="text-xs leading-relaxed text-foreground/90">{current.detail}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
