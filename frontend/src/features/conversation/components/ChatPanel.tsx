import { motion } from "framer-motion";
import { ArrowUp, Copy, MessagesSquare, RotateCcw, Square } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { MessageMarkdown } from "@/components/common/MessageMarkdown";
import { PanelShell, type PanelProps } from "@/components/common/PanelShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getRunModeMeta, type RunMode } from "@/lib/run-mode";
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

function modeLiveStatus(mode: RunMode, stageEvents: StageEvent[], sourcesLinked: number): string | null {
  if (stageEvents.length === 0) return null;
  const meta = getRunModeMeta(mode);
  const research = stageEvents.find(
    (event) => event.stage === "research_started" && event.status === "started",
  );
  const taskCount =
    research?.detail && typeof research.detail.task_count === "number"
      ? research.detail.task_count
      : null;
  const toolsActive = stageEvents.some(
    (event) => event.stage === "tool_started" && event.status === "started",
  );
  const parts = [meta.label.toUpperCase()];
  if (taskCount !== null) parts.push(`Researching ${String(taskCount)} sub-questions`);
  if (sourcesLinked > 0) parts.push(`${String(sourcesLinked)} sources found`);
  if (toolsActive) parts.push("1+ tool active");
  return parts.join(" · ");
}

export type ConversationRole = "user" | "assistant" | "system";

export interface ConversationMessage {
  id: string;
  role: ConversationRole;
  content: string;
  timestamp?: string;
}

interface ChatPanelProps extends PanelProps {
  messages?: ConversationMessage[];
  isStreaming?: boolean;
  disabled?: boolean;
  error?: string | null;
  placeholder?: string;
  floating?: boolean;
  /** Latest finished-response structure analysis from the session store. */
  responseAnalysis?: ResponseStructureAnalysis | null;
  runMode?: RunMode;
  onRunModeChange?: (mode: RunMode) => void;
  sourcesLinked?: number;
  stageEvents?: StageEvent[];
  onSend?: (value: string) => void;
  onStop?: () => void;
  onRetry?: () => void;
}

export function ChatPanel({
  messages = [],
  isStreaming = false,
  disabled = false,
  error = null,
  placeholder = "Ask anything",
  floating = false,
  responseAnalysis = null,
  runMode = "balanced",
  onRunModeChange,
  sourcesLinked = 0,
  stageEvents = [],
  onSend,
  onStop,
  onRetry,
  active,
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
    composer.style.height = `${String(Math.min(composer.scrollHeight, 128))}px`;
  }, [draft]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  // Conversation switches / New Chat must drop local draft (store prefill alone is not enough).
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

    // Double rAF: wait for draft paint + panel visibility before focus.
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

  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const lastAssistantId =
    isStreaming && lastAssistant ? lastAssistant.id : undefined;
  const liveStatus = isStreaming ? modeLiveStatus(runMode, stageEvents, sourcesLinked) : null;

  return (
    <PanelShell
      icon={MessagesSquare}
      title="Conversation"
      description="Ask a question. Understand the answer."
      active={active}
      className={cn(floating && "panel-float", className)}
      actions={
        isStreaming ? (
          <Badge variant="cyan">
            <span className="size-1.5 animate-pulse rounded-full bg-neon-cyan" />
            Streaming
          </Badge>
        ) : null
      }
      footer={
        <div className="space-y-2.5">
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 font-mono text-[11px] text-destructive"
            >
              {error}
            </p>
          ) : null}
          {liveStatus ? (
            <p className="px-1 text-[11px] tracking-wide text-primary/90">{liveStatus}</p>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className={cn(
              "rounded-[1.35rem] border bg-black/30 p-3 shadow-[inset_0_1px_0_0_oklch(1_0_0_/_5%)] backdrop-blur-xl transition",
              "focus-within:border-primary/40 focus-within:shadow-[0_0_0_1px_color-mix(in_oklab,var(--neon-cyan)_28%,transparent)]",
              evidenceDemandHighlight
                ? "border-neon-amber/45 shadow-[0_0_0_1px_color-mix(in_oklab,var(--neon-amber)_35%,transparent)]"
                : "border-border/55",
            )}
          >
            <textarea
              ref={composerRef}
              aria-label="Message composer"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={disabled}
              placeholder={placeholder || "Ask anything..."}
              className="scrollbar-slim max-h-36 min-h-[3.25rem] w-full resize-none overflow-y-auto rounded-xl border-0 bg-transparent px-2.5 py-2 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/65 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            />
            <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
              {onRunModeChange ? (
                <ModeSelector
                  value={runMode}
                  onChange={onRunModeChange}
                  disabled={disabled || isStreaming}
                />
              ) : (
                <span />
              )}
              {isStreaming && onStop ? (
                <Button type="button" size="icon" variant="outline" onClick={onStop}>
                  <Square className="size-3.5" />
                  <span className="sr-only">Stop generating</span>
                </Button>
              ) : (
                <Button type="submit" size="icon" variant="glow" disabled={!canSend}>
                  <ArrowUp />
                  <span className="sr-only">Send message</span>
                </Button>
              )}
            </div>
          </form>
        </div>
      }
    >
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
          <EmptyState
            icon={MessagesSquare}
            title="XplainAI"
            description="Ask a question. Understand the answer."
          />
          <ul className="mt-6 flex max-w-lg flex-wrap justify-center gap-2">
            {[
              "Explain quantum computing",
              "Compare React vs Vue",
              "What causes inflation?",
            ].map((example) => (
              <li key={example}>
                <button
                  type="button"
                  disabled={disabled || !onSend}
                  onClick={() => {
                    onSend?.(example);
                  }}
                  className="rounded-full border border-border/50 bg-white/[0.03] px-3 py-1.5 text-[11px] text-muted-foreground transition hover:border-primary/30 hover:text-foreground disabled:opacity-40"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ScrollArea className="h-full">
          <ol className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-5">
            {messages.map((message) => {
              const showCaret = message.id === lastAssistantId;
              const isLatestFinishedAssistant =
                !isStreaming &&
                message.role === "assistant" &&
                message.id === lastAssistant?.id &&
                message.content.trim().length > 0;

              const useAnnotation =
                message.role === "assistant" &&
                !showCaret &&
                message.content.trim().length > 0;

              return (
                <motion.li
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
                        "max-w-[min(42rem,92%)] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                        message.role === "user"
                          ? "border border-border/40 bg-white/[0.05] text-foreground/90"
                          : "border border-border/50 bg-white/[0.03] text-foreground",
                        message.role === "system" && "border-dashed text-muted-foreground italic",
                        showCaret && "border-primary/30",
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
                    <div className="flex items-center gap-1 px-1">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
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
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
                          onClick={onRetry}
                        >
                          <RotateCcw className="size-3" />
                          Retry
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {message.timestamp ? (
                    <span className="px-1 text-[10px] text-muted-foreground">
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
    </PanelShell>
  );
}
