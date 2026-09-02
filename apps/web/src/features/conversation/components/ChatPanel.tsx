import { motion } from "framer-motion";
import {
  ArrowUp,
  Camera,
  Copy,
  FileText,
  Image as ImageIcon,
  Mic,
  MicOff,
  Paperclip,
  RotateCcw,
  Square,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { ChatSkeleton } from "@/components/common/ChatSkeleton";
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

export interface FileAttachment {
  id: string;
  file: File;
  name: string;
  size: string;
  type: string;
  previewUrl?: string | undefined;
  textContent?: string | undefined;
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
  isLoading?: boolean;
}

const DEMO_PROMPTS = [
  {
    topic: "QUANTUM PHYSICS",
    title: "Quantum error correction protocols",
    prompt:
      "Explain the leading quantum error correction codes for superconducting qubits and compare surface codes against color codes.",
  },
  {
    topic: "GRAPHICS ARCHITECTURE",
    title: "WebGPU compute shaders vs WebGL",
    prompt:
      "Analyze the performance differences between WebGPU compute shaders and WebGL 2.0 rasterization for large-scale force-directed topology simulation.",
  },
  {
    topic: "CELLULAR BIOLOGY",
    title: "Epigenetic cellular rejuvenation",
    prompt:
      "What are the molecular mechanisms of partial cellular reprogramming using Yamanaka factors, and how do they avoid oncogenic transformation?",
  },
  {
    topic: "DISTRIBUTED SYSTEMS",
    title: "Raft consensus safety invariants",
    prompt:
      "Compare Raft vs Multi-Paxos leader election during asymmetric network partitions, focusing on formal safety invariants.",
  },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatPanel({
  messages = [],
  isStreaming = false,
  disabled = false,
  error = null,
  placeholder = "Ask a research question or provide links/files…",
  responseAnalysis = null,
  runMode = "deep_research",
  onRunModeChange,
  sourcesLinked = 0,
  onSend,
  onStop,
  onRetry,
  className,
  isLoading = false,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

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

  // Handle native Web Speech API
  const toggleSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      hudAudio.playClick(800);
      useUIStore.getState().setVoiceModalOpen(true);
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      hudAudio.playClick(1200);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsRecording(true);
        hudAudio.playClick(1800);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setDraft((prev) => (prev ? `${prev} ${finalTranscript.trim()}` : finalTranscript.trim()));
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsRecording(false);
      useUIStore.getState().setVoiceModalOpen(true);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    hudAudio.playClick(1500);
    const newAttachments: FileAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      let previewUrl: string | undefined = undefined;
      let textContent: string | undefined = undefined;

      if (file.type.startsWith("image/")) {
        previewUrl = URL.createObjectURL(file);
      } else if (
        file.type === "text/plain" ||
        file.type === "application/json" ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".py") ||
        file.name.endsWith(".ts") ||
        file.name.endsWith(".tsx") ||
        file.name.endsWith(".js")
      ) {
        try {
          textContent = await file.text();
        } catch {
          // Ignore read error
        }
      }

      newAttachments.push({
        id,
        file,
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type || "file",
        previewUrl,
        textContent,
      });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    event.target.value = "";
  };

  const removeAttachment = (id: string) => {
    hudAudio.playClick(1100);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const canSend = !disabled && !isStreaming && (draft.trim().length > 0 || attachments.length > 0);

  const submit = () => {
    if (!canSend) return;
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }

    let finalPrompt = draft.trim();

    if (attachments.length > 0) {
      const attachmentSummaries = attachments.map((att) => {
        if (att.textContent) {
          return `\n[Attached File: ${att.name} (${att.size})]\n\`\`\`\n${att.textContent.slice(0, 3000)}\n\`\`\``;
        }
        return `\n[Attached File: ${att.name} (${att.size})]`;
      });
      finalPrompt = `${finalPrompt}\n\n${attachmentSummaries.join("\n")}`.trim();
    }

    setDraft("");
    setAttachments([]);
    setEvidenceDemandHighlight(false);
    hudAudio.playClick(1700);
    onSend?.(finalPrompt);
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
    <div className={cn("relative flex h-full flex-col overflow-hidden bg-transparent", className)}>
      {/* Scrollable Conversation Canvas */}
      <div className="relative min-h-0 flex-1 overflow-y-auto scrollbar-slim">
        {isLoading ? (
          <ChatSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center px-4 py-8 sm:py-12">
            <div className="w-full max-w-3xl space-y-6 text-center">
              {/* Clean Professional Hero Header */}
              <div className="space-y-3">
                <h1 className="font-mono text-4xl sm:text-5xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-br from-white via-cyan-100 to-indigo-400 drop-shadow-[0_0_12px_rgba(0,240,255,0.2)]">
                  XPLAIN_AI
                </h1>

                <p className="text-sm sm:text-base font-medium text-slate-200 tracking-tight font-sans">
                  Autonomous Explainable AI & Epistemic Research Workspace
                </p>

                <p className="mx-auto max-w-xl text-xs leading-relaxed text-slate-400 font-sans">
                  Synthesizes verifiable evidence, decomposes assertions into grounded claims, and visualizes multi-dimensional knowledge topology in real time.
                </p>
              </div>

              {/* Research Inquiries Prompt Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-left pt-2">
                {DEMO_PROMPTS.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                      hudAudio.playClick();
                      onSend?.(item.prompt);
                    }}
                    className="group flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#070b16]/30 p-4 transition-all duration-200 hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] backdrop-blur-xl"
                  >
                    <div>
                      <span className="inline-block rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-mono tracking-wider text-cyan-300 uppercase">
                        {item.topic}
                      </span>
                      <h3 className="mt-2 text-xs font-semibold text-white group-hover:text-cyan-200 font-display">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-400 font-sans line-clamp-2">
                        {item.prompt}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
            {messages.map((message) => {
              const showCaret = isStreaming && message.id === lastAssistantId;
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
                    <div className="w-full rounded-2xl border border-white/[0.08] bg-black/20 p-4.5 shadow-2xl backdrop-blur-2xl">
                      <AnimatedAnnotatedMessage
                        content={message.content}
                        analysis={isLatestFinishedAssistant ? responseAnalysis : null}
                        sourcesLinked={isLatestFinishedAssistant ? sourcesLinked : 0}
                      />
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "rounded-2xl px-4.5 py-3 text-[14px] leading-relaxed backdrop-blur-2xl",
                        message.role === "user"
                          ? "max-w-[85%] bg-cyan-950/40 text-white border border-cyan-500/40 shadow-[0_0_20px_rgba(0,240,255,0.1)]"
                          : "w-full rounded-2xl border border-white/[0.08] bg-black/20 p-4.5 text-foreground/90 leading-7 shadow-2xl",
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
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                        onClick={() => void navigator.clipboard.writeText(message.content)}
                        title="Copy text"
                      >
                        <Copy className="size-3" />
                        <span>Copy</span>
                      </button>
                      {isLatestFinishedAssistant && onRetry ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
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

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="image/*,.pdf,.txt,.md,.json,.py,.ts,.tsx,.js,.zip"
            className="hidden"
          />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-black/20 p-2.5 shadow-2xl backdrop-blur-2xl transition-all",
              "focus-within:border-cyan-400/60 focus-within:ring-1 focus-within:ring-cyan-400/40 focus-within:shadow-[0_0_30px_rgba(6,182,212,0.2)]",
              evidenceDemandHighlight
                ? "border-amber-500/70 ring-1 ring-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                : "border-white/10",
            )}
          >
            {/* Attachment preview pills */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pb-2 px-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-2 py-1 text-[11px] font-mono text-cyan-200"
                  >
                    {att.type.startsWith("image/") ? (
                      <ImageIcon className="size-3 text-cyan-400" />
                    ) : (
                      <FileText className="size-3 text-cyan-400" />
                    )}
                    <span className="truncate max-w-[140px]">{att.name}</span>
                    <span className="text-[9px] text-slate-500">({att.size})</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      className="ml-0.5 text-slate-400 hover:text-red-400"
                      title="Remove attachment"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={composerRef}
              aria-label="Research prompt input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={disabled}
              placeholder={
                isRecording ? "Listening to your voice… speak clearly" : placeholder
              }
              className={cn(
                "scrollbar-slim max-h-44 min-h-[2.5rem] w-full resize-none overflow-y-auto rounded-lg bg-transparent px-2 py-1 text-sm leading-relaxed text-foreground focus:outline-none disabled:opacity-40 font-sans",
                isRecording ? "placeholder:text-cyan-400 placeholder:animate-pulse" : "placeholder:text-slate-500",
              )}
            />

            <div className="flex items-center justify-between gap-2 pt-2 px-1 border-t border-white/[0.06] mt-1">
              <div className="flex items-center gap-1.5">
                {onRunModeChange ? (
                  <ModeSelector
                    value={runMode}
                    onChange={onRunModeChange}
                    disabled={disabled || isStreaming}
                  />
                ) : null}

                {/* File Attachment Trigger */}
                <button
                  type="button"
                  disabled={disabled || isStreaming}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cyan-500/10 hover:text-cyan-300 disabled:opacity-40"
                  title="Upload photo, PDF, code, or ZIP file"
                  aria-label="Upload photo, PDF, code, or ZIP file"
                >
                  <Paperclip className="size-3.5" />
                </button>

                {/* Voice Mic Input Trigger */}
                <button
                  type="button"
                  disabled={disabled || isStreaming}
                  onClick={toggleSpeechRecognition}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg transition disabled:opacity-40",
                    isRecording
                      ? "bg-red-500/20 text-red-400 animate-pulse border border-red-500/40"
                      : "text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-300",
                  )}
                  title={isRecording ? "Stop voice recording" : "Voice input with direct speech-to-text"}
                  aria-label={isRecording ? "Stop voice recording" : "Voice input with direct speech-to-text"}
                >
                  {isRecording ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                </button>

                {/* Optical Vision Scanner Trigger */}
                <button
                  type="button"
                  disabled={disabled || isStreaming}
                  onClick={() => {
                    hudAudio.playClick(1400);
                    useUIStore.getState().setVisionModalOpen(true);
                  }}
                  className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cyan-500/10 hover:text-cyan-300 disabled:opacity-40"
                  title="Optical vision camera scanner"
                  aria-label="Optical vision camera scanner"
                >
                  <Camera className="size-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {isStreaming && onStop ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="size-8 rounded-full border-cyan-500/40 bg-cyan-950/30 p-0 text-cyan-300 hover:bg-cyan-950/60"
                    onClick={onStop}
                    title="Stop generation"
                  >
                    <Square className="size-3 fill-current text-cyan-400" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!canSend}
                    className={cn(
                      "size-8 rounded-full p-0 transition-all",
                      canSend
                        ? "bg-gradient-to-br from-cyan-500 to-indigo-600 text-white hover:from-cyan-400 hover:to-indigo-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                        : "bg-white/[0.04] text-zinc-600 cursor-not-allowed border border-white/[0.06]",
                    )}
                    title="Send message (Enter)"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </form>
          <p className="mt-1.5 text-center text-[10px] font-mono text-slate-500">
            XplainAI grounds responses in observable sources. Verify critical claims.
          </p>
        </div>
      </div>
    </div>
  );
}
