import { motion } from "framer-motion";
import { History, Pause, Play } from "lucide-react";
import { useEffect, useRef } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { PanelShell, type PanelProps } from "@/components/common/PanelShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RunPhase } from "@/lib/run-graph";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

export type TimelineStatus = "pending" | "active" | "complete" | "failed";

export interface TimelineEvent {
  id: string;
  label: string;
  detail?: string;
  status: TimelineStatus;
  timestamp?: string;
}

interface TimelinePanelProps extends PanelProps {
  events?: TimelineEvent[];
  canReplay?: boolean;
  endPhase?: RunPhase;
  onSelect?: (event: TimelineEvent) => void;
}

const statusDot: Record<TimelineStatus, string> = {
  pending: "bg-muted-foreground/50",
  active: "bg-neon-cyan shadow-[0_0_12px_var(--neon-cyan)]",
  complete: "bg-neon-emerald shadow-[0_0_8px_oklch(0.8_0.16_165_/_50%)]",
  failed: "bg-destructive shadow-[0_0_8px_oklch(0.635_0.208_25_/_45%)]",
};

function phaseForEvent(event: TimelineEvent, endPhase: RunPhase): RunPhase {
  const label = event.label.toLowerCase();
  if (label.includes("started") || label.includes("user message")) return "started";
  if (label.includes("streaming") || label.includes("token")) return "streaming";
  if (label.includes("cancelled")) return "cancelled";
  if (label.includes("error") || label.includes("failed") || label.includes("connection lost")) {
    return "failed";
  }
  if (label.includes("finished") || label.includes("stop") || label.includes("run ")) {
    return endPhase === "idle" ? "finished" : endPhase;
  }
  return "streaming";
}

export function TimelinePanel({
  events = [],
  canReplay = false,
  endPhase = "finished",
  onSelect,
  active,
  className,
}: TimelinePanelProps) {
  const isReplaying = useUIStore((state) => state.isReplaying);
  const replayEventId = useUIStore((state) => state.replayEventId);
  const setReplay = useUIStore((state) => state.setReplay);
  const stopReplay = useUIStore((state) => state.stopReplay);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current) {
        window.clearTimeout(timer);
      }
      timersRef.current = [];
    };
  }, []);

  const clearTimers = () => {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer);
    }
    timersRef.current = [];
  };

  const startReplay = () => {
    if (events.length === 0 || isReplaying) return;
    clearTimers();

    const steps = events.filter((event) => !event.label.toLowerCase().includes("user message"));
    const sequence = steps.length > 0 ? steps : events;
    const first = sequence[0];
    if (!first) return;

    setReplay({
      phase: phaseForEvent(first, endPhase),
      eventId: first.id,
      isReplaying: true,
    });

    sequence.forEach((event, index) => {
      if (index === 0) return;
      const timer = window.setTimeout(() => {
        setReplay({
          phase: phaseForEvent(event, endPhase),
          eventId: event.id,
          isReplaying: true,
        });
      }, index * 720);
      timersRef.current.push(timer);
    });

    const finishTimer = window.setTimeout(() => {
      stopReplay();
    }, sequence.length * 720 + 180);
    timersRef.current.push(finishTimer);
  };

  const handleReplayToggle = () => {
    if (isReplaying) {
      clearTimers();
      stopReplay();
      return;
    }
    startReplay();
  };

  return (
    <PanelShell
      icon={History}
      title="Timeline"
      description="Execution trace"
      active={active}
      className={className}
      actions={
        <div className="flex items-center gap-1.5">
          {events.length > 0 ? <Badge>{String(events.length)} steps</Badge> : null}
          {canReplay && events.length > 0 ? (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={handleReplayToggle}
              className="transition-transform duration-300 hover:scale-105"
            >
              {isReplaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              <span className="sr-only">{isReplaying ? "Stop replay" : "Replay run"}</span>
            </Button>
          ) : null}
        </div>
      }
    >
      {events.length === 0 ? (
        <EmptyState
          icon={History}
          title="No steps recorded"
          description="Each run transition appends here for replayable execution history."
        />
      ) : (
        <ScrollArea className="h-full">
          <ol className="relative flex flex-col gap-3 px-4 py-4">
            <motion.span
              aria-hidden
              className="absolute top-6 bottom-6 left-[1.4rem] w-px origin-top bg-gradient-to-b from-neon-cyan/55 via-neon-violet/25 to-transparent"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
            {events.map((event, index) => {
              const highlighted = replayEventId === event.id;
              const isActive = highlighted || (!isReplaying && event.status === "active");

              return (
                <motion.li
                  key={event.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: highlighted ? 1.02 : 1,
                  }}
                  transition={{
                    duration: 0.32,
                    delay: Math.min(index * 0.04, 0.28),
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="relative flex gap-3"
                >
                  <span className="relative z-10 mt-1.5 flex size-3 shrink-0 items-center justify-center">
                    {isActive ? (
                      <span className="timeline-pulse absolute size-4 rounded-full bg-neon-cyan/25" />
                    ) : null}
                    <span
                      className={cn(
                        "size-2 rounded-full transition-shadow duration-300",
                        highlighted ? statusDot.active : statusDot[event.status],
                        isActive && "animate-pulse",
                      )}
                    />
                  </span>
                  <button
                    type="button"
                    disabled={!onSelect && !canReplay}
                    onClick={() => {
                      if (onSelect) {
                        onSelect(event);
                        return;
                      }
                      if (!canReplay) return;
                      clearTimers();
                      setReplay({
                        phase: phaseForEvent(event, endPhase),
                        eventId: event.id,
                        isReplaying: false,
                      });
                      const reset = window.setTimeout(() => {
                        stopReplay();
                      }, 1400);
                      timersRef.current.push(reset);
                    }}
                    className={cn(
                      "nn-hover-lift min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-left outline-none transition duration-200",
                      isActive
                        ? "border-neon-cyan/25 bg-neon-cyan/8 shadow-[0_0_24px_-16px_var(--neon-cyan)]"
                        : "border-transparent",
                      "enabled:hover:border-border enabled:hover:bg-white/[0.04] disabled:cursor-default",
                      "enabled:focus-visible:ring-[3px] enabled:focus-visible:ring-ring",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm text-foreground">{event.label}</span>
                      {event.timestamp ? (
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {event.timestamp}
                        </span>
                      ) : null}
                    </div>
                    {event.detail ? (
                      <p className="truncate text-xs text-muted-foreground">{event.detail}</p>
                    ) : null}
                  </button>
                </motion.li>
              );
            })}
          </ol>
        </ScrollArea>
      )}
    </PanelShell>
  );
}
