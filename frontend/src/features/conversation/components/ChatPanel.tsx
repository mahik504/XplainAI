import { motion } from "framer-motion";
import {
  ArrowUp,
  Copy,
  MessagesSquare,
  RotateCcw,
  Square,
  Sparkles,
  BookOpen,
  Cpu,
  Flame,
  ShieldCheck,
  Compass,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { MessageMarkdown } from "@/components/common/MessageMarkdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RunMode } from "@/lib/run-mode";
import type { StageEvent } from "@/lib/stage-graph";
import type { ResponseStructureAnalysis } from "@/lib/xai";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/stores/conversation-store";
import { useUIStore } from "@/stores/ui-store";

import { AnimatedAnnotatedMessage } from "./AnimatedAnnotatedMessage";
import { ModeSelector } from "./ModeSelector";

function formatMessageTimestamp(value: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

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

const HERO_RESEARCH_PROMPTS = [
  {
    id: "quantum",
    tag: "Quantum Physics",
    icon: Cpu,
    title: "Quantum Decoherence & Thermal Noise",
    prompt:
      "How do superconducting transmon qubits maintain quantum coherence against thermal photon noise, and what are the leading error mitigation protocols?",
  },
  {
    id: "biotech",
    tag: "Longevity & Genetics",
    icon: Flame,
    title: "Cellular Senescence & Reprogramming",
    prompt:
      "What are the precise molecular pathways by which Yamanaka factors (OSKM) induce partial epigenetic rejuvenation without teratoma formation?",
  },
  {
    id: "consensus",
    tag: "Distributed Systems",
    icon: Compass,
    title: "Raft vs Multi-Paxos Invariants",
    prompt:
      "Compare Raft vs Multi-Paxos consensus leader election dynamics during asymmetric network partitions, focusing on formal safety invariants.",
  },
  {
    id: "economics",
    tag: "Macroeconomics",
    icon: ShieldCheck,
    title: "Central Bank Quantitative Tightening",
    prompt:
      "Analyze the empirical impact of central bank balance sheet reduction (QT) on repo market liquidity, treasury term premia, and bank reserves.",
  },
];

export function ChatPanel({
  messages = [],
  isStreaming = false,
  disabled = false,
  error = null,
  placeholder = "Ask a research question...",
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
    composer.style.height = `${String(Math.min(composer.scrollHeight, 140))}px`;
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
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950/70 shadow-2xl backdrop-blur-2xl",
        className,
      )}
    >
      {/* Studio Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800/60 px-4 bg-zinc-900/30">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
            <MessagesSquare className="size-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-tight text-zinc-100">
                Research Studio
              </span>
              <span className="inline-block size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            </div>
            <p className="text-[10px] text-zinc-500">Observable Synthesis ? Multi-Source Grounding</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isStreaming ? (
            <Badge variant="cyan" className="animate-pulse text-[11px] gap-1 px-2 py-0.5">
              <span className="size-1.5 rounded-full bg-cyan-400" />
              Synthesizing...
            </Badge>
          ) : sourcesLinked > 0 ? (
            <Badge variant="emerald" className="text-[11px] gap-1 px-2 py-0.5">
              <BookOpen className="size-3" />
              {sourcesLinked} Sources Grounded
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Main Conversation Stream / Editorial Hero */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-between overflow-y-auto px-6 py-8">
            <div className="mx-auto max-w-2xl space-y-6 pt-4">
              <div className="space-y-2.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium tracking-wide text-cyan-300">
                  <Sparkles className="size-3" />
                  XPLAINAI RESEARCH ENGINE 2.0
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
                  Observable reasoning. <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400">
                    Empirical evidence.
                  </span>
                </h1>
                <p className="text-sm leading-relaxed text-zinc-400 max-w-xl">
                  Ask deep scientific, engineering, or conceptual questions. XplainAI retrieves verified
                  academic papers & web evidence, identifies testable assertions, and maps the complete
                  knowledge topology in 3D.
                </p>
              </div>

              {/* Curated Research Prompt Bento */}
              <div className="space-y-2.5 pt-2">
                <div className="text-[11px] font-mono tracking-widest text-zinc-500 uppercase">
                  Select a research vector
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {HERO_RESEARCH_PROMPTS.map((p) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          onSend?.(p.prompt);
                        }}
                        className="group flex flex-col items-start rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-500/40 hover:bg-zinc-900/80 hover:shadow-lg active:scale-[0.98]"
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700/60 bg-zinc-800/50 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                            <Icon className="size-3 text-cyan-400" />
                            {p.tag}
                          </span>
                          <ArrowUp className="size-3.5 text-zinc-600 transition-colors group-hover:text-cyan-400 group-hover:rotate-45" />
                        </div>
                        <h4 className="mt-2 text-xs font-semibold text-zinc-200 group-hover:text-cyan-300">
                          {p.title}
                        </h4>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
                          {p.prompt}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Active Research Pipeline Tools Pill */}
            <div className="mx-auto flex flex-wrap items-center justify-center gap-3 pt-6 text-[11px] text-zinc-500">
              <span className="font-mono text-[10px] uppercase tracking-widest">Active Tool Mesh:</span>
              <span className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-zinc-400 font-mono text-[10px]">
                ArXiv Preprints
              </span>
              <span className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-zinc-400 font-mono text-[10px]">
                Wikipedia API
              </span>
              <span className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-zinc-400 font-mono text-[10px]">
                DuckDuckGo Search
              </span>
              <span className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-zinc-400 font-mono text-[10px]">
                AST Calculator
              </span>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <ol className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
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
                  <motion.li
                    key={message.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      "flex flex-col gap-1.5",
                      message.role === "user" ? "items-end" : "items-start",
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
                          "max-w-[min(44rem,94%)] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                          message.role === "user"
                            ? "border border-zinc-700/60 bg-zinc-900/90 text-zinc-100 shadow-md font-medium"
                            : "border border-zinc-800/80 bg-zinc-900/40 text-zinc-200",
                          message.role === "system" && "border-dashed text-zinc-400 italic text-xs",
                          showCaret && "border-cyan-500/40",
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
                      <div className="flex items-center gap-1.5 px-1">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 active:scale-95"
                          onClick={() => {
                            void navigator.clipboard.writeText(message.content);
                          }}
                        >
                          <Copy className="size-3" />
                          Copy
                        </button>
                        {isLatestFinishedAssistant && onRetry ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 active:scale-95"
                            onClick={onRetry}
                          >
                            <RotateCcw className="size-3" />
                            Retry
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {message.timestamp ? (
                      <span className="px-1 text-[10px] font-mono text-zinc-500">
                        {formatMessageTimestamp(message.timestamp)}
                      </span>
                    ) : null}
                  </motion.li>
                );
              })}
              <div ref={endRef} />
            </ol>
          </ScrollArea>
        )}
      </div>

      {/* Tactile Composer Bar */}
      <div className="shrink-0 border-t border-zinc-800/80 bg-zinc-900/50 p-3 backdrop-blur-xl">
        {error ? (
          <p
            role="alert"
            className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 font-mono text-[11px] text-red-400"
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
            "relative rounded-xl border bg-zinc-950/80 p-2.5 shadow-inner transition-all duration-200",
            "focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/30",
            evidenceDemandHighlight
              ? "border-amber-500/60 ring-1 ring-amber-500/30"
              : "border-zinc-800/90",
          )}
        >
          <textarea
            ref={composerRef}
            aria-label="Research prompt composer"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={disabled}
            placeholder={placeholder}
            className="scrollbar-slim max-h-36 min-h-[3rem] w-full resize-none overflow-y-auto rounded-lg border-0 bg-transparent px-2 py-1 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-40"
          />

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-zinc-800/40 pt-2 px-1">
            <div className="flex items-center gap-2">
              {onRunModeChange ? (
                <ModeSelector
                  value={runMode}
                  onChange={onRunModeChange}
                  disabled={disabled || isStreaming}
                />
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block font-mono text-[10px] text-zinc-500">
                ? Send ? Shift+? Newline
              </span>
              {isStreaming && onStop ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10 active:scale-95"
                  onClick={onStop}
                >
                  <Square className="size-3" />
                  Stop
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  variant="glow"
                  disabled={!canSend}
                  className="h-8 gap-1.5 px-3 text-xs active:scale-95"
                >
                  <span>Synthesize</span>
                  <ArrowUp className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
