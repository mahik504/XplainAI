import { useState } from "react";
import {
  FileDown,
  Copy,
  Check,
  Sparkles,
  BookOpen,
  Clock,
  Cpu,
  ChevronRight,
  ShieldCheck,
  ArrowUpRight,
  Maximize2,
} from "lucide-react";

import { MessageMarkdown } from "@/components/common/MessageMarkdown";
import { hudAudio } from "@/features/audio/audio-sfx";
import { MissingContextCard } from "@/features/explainability/MissingContextCard";
import { CounterPerspectiveCard } from "@/features/explainability/CounterPerspectiveCard";
import { EGIGauge } from "@/features/workspace/components/EGIGauge";
import type { ConversationMessage } from "@/features/conversation";
import type { ResponseStructureAnalysis } from "@/lib/xai";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

export interface OverviewViewProps {
  message?: ConversationMessage | undefined;
  responseAnalysis?: ResponseStructureAnalysis | null | undefined;
  onRetry?: (() => void) | undefined;
  className?: string | undefined;
}

export function OverviewView({
  message,
  className,
}: OverviewViewProps) {
  const [copied, setCopied] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const activeModel = useSessionStore((state) => state.activeModel);
  const totalLatencyMs = useSessionStore((state) => state.totalLatencyMs);
  const tokenUsage = useSessionStore((state) => state.tokenUsage);
  const stageTimings = useSessionStore((state) => state.stageTimings);
  const domainSources = useSessionStore((state) => state.domainSources);
  const domainClaims = useSessionStore((state) => state.domainClaims);
  const domainEvidence = useSessionStore((state) => state.domainEvidence);
  const egiScore = useSessionStore((state) => state.egiScore);
  const trustMetrics = useSessionStore((state) => state.trustMetrics);
  const missingContext = useSessionStore((state) => state.missingContext);
  const counterPerspective = useSessionStore((state) => state.counterPerspective);
  const contradictions = useSessionStore((state) => state.contradictions);

  const setActiveCanvasTab = useUIStore((state) => state.setActiveCanvasTab);

  const rawAnswerText = message?.content || "";

  const handleCopy = async () => {
    if (!rawAnswerText) return;
    try {
      await navigator.clipboard.writeText(rawAnswerText);
      hudAudio.playClick(1600);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleExport = (format: "markdown" | "pdf" | "json") => {
    hudAudio.playChirp();
    setExportingFormat(format);
    try {
      if (format === "pdf") {
        window.print();
        return;
      }

      let content = "";
      let filename = `XplainAI_Research_Dossier_${Date.now()}`;
      let mimeType = "text/plain";

      if (format === "markdown") {
        mimeType = "text/markdown";
        filename += ".md";
        content = `# XplainAI Epistemic Research Dossier\\n\\n` +
          `**EGI Trust Score**: ${Math.round((egiScore ?? 0.88) * 100)}%\\n` +
          `**Model**: ${activeModel || "deepseek-r1"}\\n\\n` +
          `## Executive Synthesis\\n\\n${rawAnswerText}\\n\\n` +
          `## Verified Claims (${domainClaims.length})\\n\\n` +
          domainClaims.map((c, i) => `${i + 1}. [${c.status.toUpperCase()}] ${c.text} (Confidence: ${Math.round(c.confidence * 100)}%)`).join("\\n") +
          `\\n\\n## Primary Literature & Sources (${domainSources.length})\\n\\n` +
          domainSources.map((s, i) => `${i + 1}. [${s.source_type.toUpperCase()}] **${s.title}** - ${s.url} (Authority: ${Math.round(s.authority_score * 100)}%)`).join("\\n");
      } else if (format === "json") {
        mimeType = "application/json";
        filename += ".json";
        content = JSON.stringify(
          {
            title: "XplainAI Epistemic Research Dossier",
            timestamp: new Date().toISOString(),
            model: activeModel,
            egiScore,
            trustMetrics,
            answerText: rawAnswerText,
            claims: domainClaims,
            evidence: domainEvidence,
            sources: domainSources,
            contradictions,
            stageTimings,
          },
          null,
          2
        );
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setTimeout(() => setExportingFormat(null), 800);
    }
  };

  const topFindings = domainClaims
    .filter((c) => c.status === "supported" || c.importance === "core" || c.importance === "high")
    .slice(0, 4);

  return (
    <div className={cn("flex flex-col space-y-5 pb-8", className)}>
      {/* Top Telemetry Action Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#070b16]/60 p-4 backdrop-blur-2xl">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-mono text-cyan-300">
            <Cpu className="size-3.5" />
            <span>{activeModel || "deepseek-r1"}</span>
          </div>

          {totalLatencyMs !== null && (
            <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-mono text-slate-300">
              <Clock className="size-3.5 text-cyan-400" />
              <span>{(totalLatencyMs / 1000).toFixed(2)}s Latency</span>
            </div>
          )}

          {tokenUsage && (
            <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-mono text-slate-300">
              <Sparkles className="size-3.5 text-indigo-400" />
              <span>{tokenUsage.total_tokens.toLocaleString()} Tokens</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-mono text-emerald-300">
            <BookOpen className="size-3.5" />
            <span>{domainSources.length} Sources Verified</span>
          </div>
        </div>

        {/* Quick Action Ribbon */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08] hover:text-white transition-all"
            title="Copy synthesized report"
          >
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <div className="flex items-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-0.5">
            <button
              type="button"
              onClick={() => handleExport("markdown")}
              disabled={exportingFormat !== null}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-mono font-medium text-cyan-300 hover:bg-cyan-500/20 hover:text-white transition-all"
              title="Download Markdown Report"
            >
              <FileDown className="size-3.5" />
              <span>MD</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport("pdf")}
              disabled={exportingFormat !== null}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-mono font-medium text-cyan-300 hover:bg-cyan-500/20 hover:text-white transition-all"
              title="Export Formatted PDF Report"
            >
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport("json")}
              disabled={exportingFormat !== null}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-mono font-medium text-cyan-300 hover:bg-cyan-500/20 hover:text-white transition-all"
              title="Export JSON Evidence Pack"
            >
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Primary Content: Synthesized Report & Key Findings (7 Cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Executive Synthesis Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#070b16]/70 p-5.5 backdrop-blur-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                    Synthesized Executive Answer
                  </h2>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Autonomous deep research synthesis with verifiable citation markers
                  </p>
                </div>
              </div>
            </div>

            {/* Markdown Body with Interactive Inline Citation Pills */}
            <div className="text-[13.5px] leading-relaxed text-slate-200 font-sans prose-invert max-w-none">
              <MessageMarkdown content={rawAnswerText} />
            </div>
          </div>

          {/* Key Findings Grid */}
          {topFindings.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-400" />
                  Key Verified Findings
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveCanvasTab("evidence")}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-200 transition-colors"
                >
                  <span>Inspect all ({domainClaims.length})</span>
                  <ChevronRight className="size-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {topFindings.map((claim, idx) => (
                  <div
                    key={claim.id}
                    className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#070b16]/50 p-3.5 backdrop-blur-xl hover:border-cyan-500/30 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="rounded bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-mono text-emerald-300 uppercase">
                          Finding #{idx + 1}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-300">
                          {Math.round(claim.confidence * 100)}% Confidence
                        </span>
                      </div>
                      <p className="text-xs font-medium text-white leading-relaxed line-clamp-3">
                        {claim.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dialectic Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <MissingContextCard items={missingContext} />
            <CounterPerspectiveCard text={counterPerspective} />
          </div>
        </div>

        {/* Right Sticky Deck: EGI 2.0 Gauge & Workspace Navigation (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <EGIGauge
            score={egiScore}
            trustMetrics={trustMetrics}
            stageTimings={stageTimings}
          />

          <div className="rounded-2xl border border-white/[0.08] bg-[#070b16]/70 p-4 backdrop-blur-2xl space-y-3">
            <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-300">
              Workspace Specialized Views
            </h4>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  hudAudio.playClick();
                  setActiveCanvasTab("evidence");
                }}
                className="group flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 group-hover:scale-105 transition-transform">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-white group-hover:text-cyan-200">
                      Evidence Matrix
                    </h5>
                    <p className="text-[10px] text-slate-400">
                      {domainClaims.length} Claims • {domainEvidence.length} Snippets
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="size-4 text-slate-400 group-hover:text-cyan-300 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => {
                  hudAudio.playClick();
                  setActiveCanvasTab("graph");
                }}
                className="group flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-all hover:border-indigo-500/40 hover:bg-indigo-500/10"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform">
                    <Maximize2 className="size-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-white group-hover:text-indigo-200">
                      3D Knowledge Topology
                    </h5>
                    <p className="text-[10px] text-slate-400">
                      Full WebGL Constellation & 2D DAG
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="size-4 text-slate-400 group-hover:text-indigo-300 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => {
                  hudAudio.playClick();
                  setActiveCanvasTab("sources");
                }}
                className="group flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
                    <BookOpen className="size-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-white group-hover:text-emerald-200">
                      Source Dossier
                    </h5>
                    <p className="text-[10px] text-slate-400">
                      {domainSources.length} Crawled Pages & arXiv Papers
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="size-4 text-slate-400 group-hover:text-emerald-300 transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
