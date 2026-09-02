import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ShieldCheck,
  Maximize2,
  BookOpen,
  ArrowUp,
  Square,
} from "lucide-react";

import { StageRail } from "@/features/explainability/StageRail";
import { hudAudio } from "@/features/audio/audio-sfx";
import { OverviewView } from "@/features/workspace/views/OverviewView";
import { EvidenceView } from "@/features/workspace/views/EvidenceView";
import { GraphView } from "@/features/workspace/views/GraphView";
import { SourcesView } from "@/features/workspace/views/SourcesView";
import { ModeSelector } from "@/features/conversation/components/ModeSelector";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore, type CanvasTab } from "@/stores/ui-store";

export interface ResearchCanvasProps {
  onSend?: (query: string) => void;
  onStop?: () => void;
  onRetry?: () => void;
  className?: string;
}

const RESEARCH_PROMPT_TEMPLATES = [
  {
    topic: "QUANTUM COMPUTING",
    title: "Quantum Error Correction Thresholds",
    prompt: "Compare surface code fault-tolerance thresholds against bosonic cat codes for scalable superconducting quantum computing.",
  },
  {
    topic: "DEEP LEARNING",
    title: "Speculative Decoding & KV-Cache",
    prompt: "Analyze the memory bandwidth and latency trade-offs of speculative decoding vs chunked prefill in modern autoregressive LLM inference engines.",
  },
  {
    topic: "DISTRIBUTED SYSTEMS",
    title: "Distributed Raft Invariants",
    prompt: "Explain leader election safety invariants and log matching guarantees in Raft during asymmetric network partition scenarios.",
  },
  {
    topic: "BIOTECHNOLOGY",
    title: "Epigenetic Reprogramming Mechanisms",
    prompt: "What are the molecular mechanisms of transient OSKM factor expression in partial cellular rejuvenation without oncogenic mutation?",
  },
];

export function ResearchCanvas({
  onSend,
  onStop,
  onRetry,
  className,
}: ResearchCanvasProps) {
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const activeCanvasTab = useUIStore((state) => state.activeCanvasTab);
  const setActiveCanvasTab = useUIStore((state) => state.setActiveCanvasTab);
  const composerPrefill = useUIStore((state) => state.composerPrefill);
  const clearComposerPrefill = useUIStore((state) => state.clearComposerPrefill);

  const messages = useSessionStore((state) => state.messages);
  const isStreaming = useSessionStore((state) => state.isStreaming);
  const runMode = useSessionStore((state) => state.runMode);
  const setRunMode = useSessionStore((state) => state.setRunMode);
  const stageEvents = useSessionStore((state) => state.stageEvents);
  const egiScore = useSessionStore((state) => state.egiScore);
  const domainClaims = useSessionStore((state) => state.domainClaims);
  const domainSources = useSessionStore((state) => state.domainSources);
  const responseAnalysis = useSessionStore((state) => state.responseAnalysis);

  useEffect(() => {
    if (!composerPrefill) return;
    setDraft(composerPrefill);
    clearComposerPrefill();
    requestAnimationFrame(() => {
      composerRef.current?.focus();
    });
  }, [composerPrefill, clearComposerPrefill]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const hasFinishedRun = Boolean(lastAssistant && lastAssistant.content.trim().length > 0 && !isStreaming);

  const handleTabChange = (tab: CanvasTab) => {
    hudAudio.playClick(1100);
    setActiveCanvasTab(tab);
  };

  const handleSend = () => {
    if (isStreaming || draft.trim().length === 0) return;
    hudAudio.playClick(1700);
    const text = draft.trim();
    setDraft("");
    onSend?.(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape" && isStreaming && onStop) {
      e.preventDefault();
      onStop();
    }
  };

  return (
    <div className={cn("relative flex h-full w-full flex-col overflow-hidden bg-transparent", className)}>
      {/* Top Navigation Tab Ribbon */}
      <div className="z-20 shrink-0 border-b border-white/[0.08] bg-[#070b16]/70 px-4 py-2 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          {/* Main 4 Canvas Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {/* 1. Overview */}
            <button
              type="button"
              onClick={() => handleTabChange("overview")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-mono font-semibold transition-all duration-200",
                activeCanvasTab === "overview"
                  ? "bg-cyan-500/20 border border-cyan-500/40 text-white shadow-[0_0_15px_rgba(0,240,255,0.25)]"
                  : "border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
              )}
            >
              <Sparkles className="size-3.5 text-cyan-400" />
              <span>Overview</span>
              {egiScore !== null && (
                <span className="rounded bg-cyan-950/80 border border-cyan-500/30 px-1.5 py-0.2 text-[9px] text-cyan-300">
                  {Math.round(egiScore * 100)}% EGI
                </span>
              )}
            </button>

            {/* 2. Evidence */}
            <button
              type="button"
              onClick={() => handleTabChange("evidence")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-mono font-semibold transition-all duration-200",
                activeCanvasTab === "evidence"
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                  : "border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
              )}
            >
              <ShieldCheck className="size-3.5 text-emerald-400" />
              <span>Evidence</span>
              {domainClaims.length > 0 && (
                <span className="rounded bg-emerald-950/80 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] text-emerald-300">
                  {domainClaims.length}
                </span>
              )}
            </button>

            {/* 3. Graph */}
            <button
              type="button"
              onClick={() => handleTabChange("graph")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-mono font-semibold transition-all duration-200",
                activeCanvasTab === "graph"
                  ? "bg-indigo-500/20 border border-indigo-500/40 text-white shadow-[0_0_15px_rgba(99,102,241,0.25)]"
                  : "border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
              )}
            >
              <Maximize2 className="size-3.5 text-indigo-400" />
              <span>Graph</span>
              <span className="rounded bg-indigo-950/80 border border-indigo-500/30 px-1.5 py-0.2 text-[9px] text-indigo-300">
                3D/2D
              </span>
            </button>

            {/* 4. Sources */}
            <button
              type="button"
              onClick={() => handleTabChange("sources")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-mono font-semibold transition-all duration-200",
                activeCanvasTab === "sources"
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                  : "border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
              )}
            >
              <BookOpen className="size-3.5 text-emerald-400" />
              <span>Sources</span>
              {domainSources.length > 0 && (
                <span className="rounded bg-emerald-950/80 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] text-emerald-300">
                  {domainSources.length}
                </span>
              )}
            </button>
          </div>

          {/* Right Mode Selector */}
          <div className="flex items-center gap-2">
            <ModeSelector value={runMode} onChange={setRunMode} />
          </div>
        </div>
      </div>

      {/* Main Workspace Body Content */}
      <div className="relative flex-1 min-h-0 w-full overflow-y-auto px-4 py-4 sm:px-6 scrollbar-slim">
        <div className="mx-auto max-w-7xl h-full flex flex-col">
          {/* Live Progress Stage Rail when streaming */}
          {isStreaming && (
            <div className="mb-4 rounded-2xl border border-cyan-500/30 bg-[#070b16]/90 p-4 backdrop-blur-2xl shadow-[0_0_25px_rgba(0,240,255,0.15)] animate-in fade-in">
              <StageRail events={stageEvents} isStreaming={isStreaming} />
            </div>
          )}

          {/* Empty / Hero State when no research run has happened */}
          {!hasFinishedRun && !isStreaming ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center py-8">
              <div className="max-w-2xl space-y-6">
                <div className="space-y-2.5">
                  <h1 className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-br from-white via-cyan-100 to-indigo-400">
                    RESEARCH WORKSPACE
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 font-sans">
                    Autonomous deep evidence synthesis, deterministic EGI 2.0 verification, and multi-dimensional knowledge topology.
                  </p>
                </div>

                {/* Quick Inquiries Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                  {RESEARCH_PROMPT_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.title}
                      type="button"
                      onClick={() => {
                        hudAudio.playClick();
                        setDraft(tmpl.prompt);
                        composerRef.current?.focus();
                      }}
                      className="group flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#070b16]/60 p-4 transition-all duration-200 hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:shadow-[0_0_20px_rgba(0,240,255,0.15)] backdrop-blur-xl"
                    >
                      <div>
                        <span className="inline-block rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300 uppercase">
                          {tmpl.topic}
                        </span>
                        <h3 className="mt-2 text-xs font-semibold text-white group-hover:text-cyan-200 font-display">
                          {tmpl.title}
                        </h3>
                        <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 leading-relaxed font-sans">
                          {tmpl.prompt}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Active Tab Content */
            <div className="flex-1 min-h-0">
              <AnimatePresence mode="wait">
                {activeCanvasTab === "overview" && (
                  <motion.div
                    key="tab-overview"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    <OverviewView
                      message={lastAssistant}
                      responseAnalysis={responseAnalysis}
                      onRetry={onRetry}
                    />
                  </motion.div>
                )}

                {activeCanvasTab === "evidence" && (
                  <motion.div
                    key="tab-evidence"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    <EvidenceView />
                  </motion.div>
                )}

                {activeCanvasTab === "graph" && (
                  <motion.div
                    key="tab-graph"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="h-[calc(100vh-210px)]"
                  >
                    <GraphView className="h-full" />
                  </motion.div>
                )}

                {activeCanvasTab === "sources" && (
                  <motion.div
                    key="tab-sources"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    <SourcesView />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Docked Prompt Composer at Bottom */}
      <div className="shrink-0 border-t border-white/[0.08] bg-[#070b16]/80 p-3 sm:px-6 backdrop-blur-2xl">
        <div className="mx-auto max-w-4xl">
          <div className="relative rounded-2xl border border-white/[0.1] bg-black/40 p-2 shadow-2xl backdrop-blur-2xl focus-within:border-cyan-400 focus-within:shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-all">
            <textarea
              ref={composerRef}
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a deep research question or request evidence verification..."
              className="w-full resize-none bg-transparent px-3 py-1.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none scrollbar-none font-sans"
            />

            <div className="flex items-center justify-between border-t border-white/[0.06] pt-2 px-1">
              <div className="flex items-center gap-1 text-slate-400 text-xs font-mono">
                <span>Shift+Enter for newline</span>
              </div>

              <div className="flex items-center gap-2">
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={onStop}
                    className="flex size-8 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-all shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                    title="Stop research run"
                  >
                    <Square className="size-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={draft.trim().length === 0}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-xl transition-all",
                      draft.trim().length > 0
                        ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,240,255,0.4)] hover:bg-cyan-400 hover:scale-105"
                        : "bg-white/[0.06] text-slate-500 cursor-not-allowed"
                    )}
                    title="Send research query (Enter)"
                  >
                    <ArrowUp className="size-4 stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
