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
import { hudAudio } from "@/features/audio/audio-sfx";
import type { RunMode } from "@/lib/run-mode";
import type { StageEvent } from "@/lib/stage-graph";
import type { ResponseStructureAnalysis } from "@/lib/xai";
import { cn } from "@/lib/utils";
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
    category: "Quantum Physics",
    title: "Quantum error correction protocols",
    prompt:
      "Explain the leading quantum error correction codes for superconducting qubits and compare surface codes against color codes.",
  },
  {
    category: "Graphics Architecture",
    title: "WebGPU compute shaders vs WebGL",
    prompt:
      "Analyze the performance differences between WebGPU compute shaders and WebGL 2.0 rasterization for large-scale force-directed graph physics.",
  },
  {
    category: "Cellular Biology",
    title: "Epigenetic cellular rejuvenation",
    prompt:
      "What are the molecular mechanisms of partial cellular reprogramming using Yamanaka factors, and how do they avoid teratoma risk?",
  },
  {
    category: "Distributed Systems",
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

  useEffect(() => {
    if (!composerPrefill) return;
    setDraft(composerPrefill);
    clearComposerPrefill();
    requestAnimationFrame(() => {
      composerRef.current?.focus();
    });
  }, [composerPrefill, clearComposerPrefill]);

  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth" });
  }, [messages, isStreaming]);

  const canSend = !disabled && !isStreaming && draft.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    const value = draft.trim();
    setDraft("");
    setEvidenceDemandHighlight(false);
    hudAudio.playClick(1700);
    onSend?.(value);
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
    <div className={cn("relative flex h-full flex-col overflow-hidden bg-[#060408]", className)}>
      {/* Scrollable Conversation Canvas */}
      <div className="relative min-h-0 flex-1 overflow-y-auto scrollbar-slim">
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
            <div className="w-full max-w-2xl space-y-8 text-center">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-3.5 py-1 text-xs font-mono text-rose-300 shadow-[0_0_12px_rgba(225,29,72,0.2)]">
                  <span className="size-1.5 rounded-full bg-rose-400 animate-pulse" />
                  <span>RESEARCH TELEMETRY ACTIVE</span>
                </div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  What would you like to explore?
                </h1>
                <p className="mx-auto max-w-lg text-sm leading-relaxed text-zinc-400">
                  Empirical research with verified academic sources, structured reasoning breakdown,
                  and 3D holographic knowledge mapping.
                </p>
              </div>

              {/* Prompt Starters */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-left">
                {PROMPT_STARTERS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      hudAudio.playChirp();
                      onSend?.(item.prompt);
                    }}
                    className="hud-bracket-box group flex flex-col justify-between rounded-xl border border-rose-950/70 bg-[#0e050c]/80 p-4 transition-all hover:border-rose-500/60 hover:bg-[#160814] hover:shadow-[0_4px_25px_rgba(225,29,72,0.2)] active:scale-[0.99]"
                  >
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-rose-400/80 font-bold">
                        {item.category}
                      </span>
                      <p className="mt-1 text-xs font-semibold text-foreground group-hover:text-rose-200 transition-colors">
                        {item.title}
                      </p>
                    </div>
                    <span className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
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
                          ? "max-w-[85%] bg-[#180816] text-foreground border border-rose-900/40 shadow-sm"
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
              "relative flex flex-col rounded-2xl border bg-[#0e050c]/90 p-2.5 shadow-2xl backdrop-blur-2xl transition-all",
              "focus-within:border-rose-500/70 focus-within:ring-1 focus-within:ring-rose-500/50 focus-within:shadow-[0_0_25px_rgba(225,29,72,0.2)]",
              evidenceDemandHighlight
                ? "border-amber-500/70 ring-1 ring-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                : "border-rose-950/80",
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
              className="scrollbar-slim max-h-44 min-h-[2.5rem] w-full resize-none overflow-y-auto rounded-lg bg-transparent px-2 py-1 text-sm leading-relaxed text-foreground placeholder:text-zinc-500 focus:outline-none disabled:opacity-40 font-sans"
            />

            <div className="flex items-center justify-between gap-2 pt-2 px-1 border-t border-rose-950/40 mt-1">
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
                    className="size-8 rounded-full border-rose-500/40 bg-rose-950/30 p-0 text-rose-300 hover:bg-rose-950/60"
                    onClick={onStop}
                    title="Stop generation"
                  >
                    <Square className="size-3 fill-current text-rose-400" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!canSend}
                    className={cn(
                      "size-8 rounded-full p-0 transition-all font-mono",
                      canSend
                        ? "bg-gradient-to-br from-rose-500 to-rose-600 text-white hover:from-rose-400 hover:to-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.5)]"
                        : "bg-rose-950/30 text-zinc-600 cursor-not-allowed border border-rose-950/50",
                    )}
                    title="Send message (Enter)"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </form>
          <p className="mt-1.5 text-center text-[10px] font-mono text-zinc-500">
            XplainAI grounds responses in observable sources. Verify critical claims.
          </p>
        </div>
      </div>
    </div>
  );
}

