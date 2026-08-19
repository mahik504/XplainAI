import { motion } from "framer-motion";
import {
  ArrowUp,
  Copy,
  RotateCcw,
  Square,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { MessageMarkdown } from "@/components/common/MessageMarkdown";
import { Button } from "@/components/ui/button";
import type { RunMode } from "@/lib/run-mode";
import type { StageEvent } from "@/lib/stage-graph";
import type { ResponseStructureAnalysis } from "@/lib/xai";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/stores/conversation-store";
import { useUIStore } from "@/stores/ui-store";

import { AnimatedAnnotatedMessage } from "./AnimatedAnnotatedMessage";
import { ModeSelector } from "./ModeSelector";

export type ConversationRole = "user" | "assistant" | "system";

export interface ConversationMessage {
  id: string;
  role: ConversationRole;
  content: string;
  timestamp?: string;
}

interface ChatPanelProps {
  messages?: ConversationMessage[];
  isStreaming?: boolean;
  disabled?: boolean;
  error?: string | null;
  placeholder?: string;
  floating?: boolean;
  responseAnalysis?: ResponseStructureAnalysis | null;
  runMode?: RunMode;
  onRunModeChange?: (mode: RunMode) => void;
  sourcesLinked?: number;
  stageEvents?: StageEvent[];
  onSend?: (value: string) => void;
  onStop?: () => void;
  onRetry?: () => void;
  active?: boolean;
  className?: string;
}

const PROMPT_STARTERS = [
  {
    title: "Quantum error correction protocols",
    prompt:
      "Explain the leading quantum error correction codes for superconducting qubits and compare surface codes against color codes.",
  },
  {
    title: "WebGPU compute shaders vs WebGL",
    prompt:
      "Analyze the performance differences between WebGPU compute shaders and WebGL 2.0 rasterization for large-scale force-directed graph physics.",
  },
  {
    title: "Epigenetic cellular rejuvenation",
    prompt:
      "What are the molecular mechanisms of partial cellular reprogramming using Yamanaka factors, and how do they avoid teratoma risk?",
  },
  {
    title: "Raft consensus safety invariants",
    prompt:
      "Compare Raft vs Multi-Paxos leader election during asymmetric network partitions, focusing on formal safety invariants.",
  },
];

export function ChatPanel({
  messages = [],
  isStreaming = false,
  disabled = false,
  error = null,
  placeholder = "Ask a research question…",
  responseAnalysis = null,
  runMode = "balanced",
  onRunModeChange,
  sourcesLinked = 0,
  onSend,
  onStop,
  onRetry,
  className,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const composerPrefill = useUIStore((state) => state.composerPrefill);
  const clearComposerPrefill = useUIStore((state) => state.clearComposerPrefill);
  const evidenceDemandHighlight = useUIStore((state) => state.evidenceDemandHighlight);
  const setEvidenceDemandHighlight = useUIStore((state) => state.setEvidenceDemandHighlight);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const canSend = draft.trim().length > 0 && !disabled && onSend !== undefined;

  useLayoutEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "0px";
    composer.style.height = `${String(Math.min(composer.scrollHeight, 180))}px`;
  }, [draft]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  useEffect(() => {
    setDraft("");
    setEvidenceDemandHighlight(false);
  }, [activeConversationId, setEvidenceDemandHighlight]);

  useEffect(() => {
    if (!composerPrefill) return;
    const text = composerPrefill;
    setDraft(text);
    clearComposerPrefill();
    setEvidenceDemandHighlight(true);

    const focusComposer = () => {
      const composer = composerRef.current;
      if (!composer) return;
      composer.scrollIntoView({ behavior: "smooth", block: "nearest" });
      composer.focus({ preventScroll: true });
      const len = text.length;
      composer.setSelectionRange(len, len);
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(focusComposer);
    });
  }, [clearComposerPrefill, composerPrefill, setEvidenceDemandHighlight]);

  const submit = () => {
    if (!canSend) return;
    onSend(draft.trim());
    setDraft("");
    setEvidenceDemandHighlight(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape" && isStreaming && onStop) {
      event.preventDefault();
      onStop();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastAssistantId = isStreaming && lastAssistant ? lastAssistant.id : undefined;

  return (
    <div className={cn("relative flex h-full flex-col overflow-hidden bg-[#09090b]", className)}>
      {/* Scrollable Conversation Canvas */}
      <div className="relative min-h-0 flex-1 overflow-y-auto scrollbar-slim">
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
            <div className="w-full max-w-2xl space-y-8 text-center">
              <div className="space-y-3">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  What would you like to explore?
                </h1>
                <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
                  Empirical research with verified academic sources, structured reasoning breakdown,
                  and 3D knowledge mapping.
                </p>
              </div>

              {/* Prompt Starters */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-left">
                {PROMPT_STARTERS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSend?.(item.prompt)}
                    className="group flex flex-col justify-between rounded-xl border border-border/60 bg-white/[0.02] p-3.5 transition hover:border-border hover:bg-white/[0.05] active:scale-[0.99]"
                  >
                    <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </span>
                    <span className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                      {item.prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
            {messages.map((message) => {
              const showCaret = message.id === lastAssistantId;
              const isLatestFinishedAssistant =
                !isStreaming &&
                message.role === "assistant" &&
                message.id === lastAssistant?.id &&
                message.content.trim().length > 0;

              const useAnnotation =
                message.role === "assistant" && !showCaret && message.content.trim().length > 0;

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className={cn(
                    "flex flex-col gap-1.5",
                    message.role === "user" ? "items-end" : "items-start w-full",
                  )}
                >
                  {useAnnotation ? (
                    <AnimatedAnnotatedMessage
                      content={message.content}
                      analysis={isLatestFinishedAssistant ? responseAnalysis : null}
                      sourcesLinked={isLatestFinishedAssistant ? sourcesLinked : 0}
                    />
                  ) : (
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                        message.role === "user"
                          ? "max-w-[85%] bg-[#222226] text-foreground border border-white/[0.06]"
                          : "w-full text-foreground/90 leading-7",
                        message.role === "system" && "border-dashed text-muted-foreground italic text-xs",
                      )}
                    >
                      {message.role === "user" || message.role === "system" ? (
                        <span className="whitespace-pre-wrap">{message.content}</span>
                      ) : (
                        <MessageMarkdown content={message.content} />
                      )}
                      {showCaret ? <span className="typing-caret" aria-hidden /> : null}
                    </div>
                  )}

                  {message.role === "assistant" && !showCaret && message.content.trim() ? (
                    <div className="flex items-center gap-2 pt-1 text-muted-foreground">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground/70 transition hover:bg-white/[0.05] hover:text-foreground"
                        onClick={() => void navigator.clipboard.writeText(message.content)}
                        title="Copy text"
                      >
                        <Copy className="size-3" />
                        <span>Copy</span>
                      </button>
                      {isLatestFinishedAssistant && onRetry ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground/70 transition hover:bg-white/[0.05] hover:text-foreground"
                          onClick={onRetry}
                          title="Retry response"
                        >
                          <RotateCcw className="size-3" />
                          <span>Retry</span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </motion.div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Floating Centered Composer */}
      <div className="shrink-0 p-3 pb-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {error ? (
            <p
              role="alert"
              className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-[#121215] p-2.5 shadow-lg transition-all",
              "focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40",
              evidenceDemandHighlight
                ? "border-amber-500/60 ring-1 ring-amber-500/30"
                : "border-border/70",
            )}
          >
            <textarea
              ref={composerRef}
              aria-label="Research prompt input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={disabled}
              placeholder={placeholder}
              className="scrollbar-slim max-h-44 min-h-[2.5rem] w-full resize-none overflow-y-auto rounded-lg bg-transparent px-2 py-1 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-40"
            />

            <div className="flex items-center justify-between gap-2 pt-2 px-1">
              <div className="flex items-center gap-1.5">
                {onRunModeChange ? (
                  <ModeSelector
                    value={runMode}
                    onChange={onRunModeChange}
                    disabled={disabled || isStreaming}
                  />
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {isStreaming && onStop ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="size-8 rounded-full border-border/80 p-0 text-foreground hover:bg-white/[0.08]"
                    onClick={onStop}
                    title="Stop generation"
                  >
                    <Square className="size-3 fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!canSend}
                    className={cn(
                      "size-8 rounded-full p-0 transition-all",
                      canSend
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        : "bg-white/[0.06] text-muted-foreground/40 cursor-not-allowed",
                    )}
                    title="Send message (Enter)"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </form>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground/60">
            XplainAI grounds responses in observable sources. Verify critical claims.
          </p>
        </div>
      </div>
    </div>
  );
}

