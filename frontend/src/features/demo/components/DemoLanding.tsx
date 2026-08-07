import { motion } from "framer-motion";
import { Play, Sparkles, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEMO_PROMPTS, getShowcasePrompt, type DemoPrompt } from "@/lib/demo-prompts";
import { cn } from "@/lib/utils";

interface DemoLandingProps {
  disabled?: boolean;
  onSelectPrompt: (prompt: DemoPrompt) => void;
  onRunShowcase: () => void;
  onDismiss?: () => void;
}

export function DemoLanding({
  disabled = false,
  onSelectPrompt,
  onRunShowcase,
  onDismiss,
}: DemoLandingProps) {
  const showcase = getShowcasePrompt();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 px-4 py-8 backdrop-blur-xl"
    >
      <div className="demo-landing relative w-full max-w-4xl">
        <div className="demo-landing__glow" aria-hidden />

        <div className="relative text-center">
          <Badge variant="cyan" className="mb-4">
            <Sparkles className="size-3" />
            Demo Mode
          </Badge>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            XplainAI
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            One click. Live stream. Observable response structure — never chain-of-thought.
            Built for the fastest judge walkthrough.
          </p>
        </div>

        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="glow"
            size="lg"
            disabled={disabled}
            className="gap-2 px-6"
            onClick={onRunShowcase}
          >
            <Play className="size-4" />
            Run Showcase
          </Button>
          {onDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="gap-2 px-4 text-muted-foreground"
              onClick={onDismiss}
            >
              Skip to workspace
            </Button>
          ) : null}
          <p className="w-full text-center text-[11px] text-muted-foreground sm:w-auto sm:text-left">
            Best path · {showcase.title}
          </p>
        </div>

        <ul className="relative mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_PROMPTS.map((item, index) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: Math.min(0.05 * index, 0.3),
                duration: 0.32,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelectPrompt(item);
                }}
                className={cn(
                  "group flex h-full w-full flex-col rounded-2xl border border-border/70 bg-white/[0.03] p-4 text-left outline-none transition duration-300",
                  "hover:border-neon-cyan/40 hover:bg-neon-cyan/[0.06] hover:shadow-[0_0_32px_-18px_var(--neon-cyan)]",
                  "focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-45",
                  item.showcase && "border-neon-cyan/35",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-foreground group-hover:text-neon-cyan">
                    {item.title}
                  </span>
                  {item.showcase ? (
                    <Badge variant="emerald" className="shrink-0">
                      <Wand2 className="size-3" />
                      Showcase
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                  {item.blurb}
                </p>
                <span className="mt-3 text-[10px] tracking-[0.14em] text-neon-cyan/80 uppercase">
                  Click to send
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
