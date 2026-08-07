import { motion } from "framer-motion";
import { ArrowUp, MessagesSquare, Square } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { MessageMarkdown } from "@/components/common/MessageMarkdown";
import { PanelShell, type PanelProps } from "@/components/common/PanelShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StructureLegend } from "@/features/demo";
import type { ResponseStructureAnalysis } from "@/lib/xai";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

import { AnimatedAnnotatedMessage } from "./AnimatedAnnotatedMessage";

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
  onSend?: (value: string) => void;
  onStop?: () => void;
}

export function ChatPanel({
  messages = [],
  isStreaming = false,
  disabled = false,
  error = null,
  placeholder = "Ask anything",
  floating = false,
  responseAnalysis = null,
  onSend,
  onStop,
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
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const lastAssistantId =
    isStreaming && lastAssistant ? lastAssistant.id : undefined;

  return (
    <PanelShell
      icon={MessagesSquare}
      title="Conversation"
      description="Floating stream"
      active={active}
      className={cn(floating && "panel-float shadow-[0_24px_80px_-40px_oklch(0.7_0.14_199_/_55%)]", className)}
      actions={
        isStreaming ? (
          <Badge variant="cyan">
            <span className="size-1.5 animate-pulse rounded-full bg-neon-cyan" />
            Streaming
          </Badge>
        ) : null
      }
      footer={
        <div className="space-y-2">
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 font-mono text-[11px] text-destructive"
            >
              {error}
            </p>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={composerRef}
              aria-label="Message composer"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={disabled}
              placeholder={placeholder}
              className={cn(
                "scrollbar-slim max-h-32 flex-1 resize-none overflow-y-auto rounded-lg border bg-white/[0.03] px-3 py-2 text-sm text-foreground transition duration-200 placeholder:text-muted-foreground/70 focus-visible:border-neon-cyan/40 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none disabled:opacity-45",
                evidenceDemandHighlight
                  ? "nn-composer--evidence border-neon-amber/55 shadow-[0_0_28px_-16px_var(--neon-amber)]"
                  : "border-border",
              )}
            />
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
          </form>
        </div>
      }
    >
      {messages.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="Ask something to begin"
          description="Your prompt streams here. After the model finishes, claims and evidence markers annotate the reply so you can inspect support."
        />
      ) : (
        <ScrollArea className="h-full">
          {responseAnalysis && responseAnalysis.score.sentenceCount > 0 ? (
            <div className="sticky top-0 z-10 border-b border-border/40 bg-background/70 px-3 py-2 backdrop-blur-md">
              <StructureLegend className="relative right-auto bottom-auto border-0 bg-transparent p-0 shadow-none backdrop-blur-none" />
            </div>
          ) : null}
          <ol className="flex flex-col gap-3 px-4 py-4">
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
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "flex flex-col gap-1",
                    message.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  {useAnnotation ? (
                    <AnimatedAnnotatedMessage
                      content={message.content}
                      analysis={isLatestFinishedAssistant ? responseAnalysis : null}
                    />
                  ) : (
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl border px-3 py-2 text-sm leading-relaxed transition-shadow duration-300",
                        message.role === "user"
                          ? "border-neon-cyan/25 bg-neon-cyan/10 text-foreground shadow-[0_0_24px_-16px_var(--neon-cyan)]"
                          : "border-border bg-white/[0.03] text-foreground/90",
                        message.role === "system" && "border-dashed text-muted-foreground italic",
                        showCaret && "border-neon-cyan/30 shadow-[0_0_28px_-14px_var(--neon-cyan)]",
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
                  {message.timestamp ? (
                    <span className="px-1 text-[10px] text-muted-foreground">
                      {message.timestamp}
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
