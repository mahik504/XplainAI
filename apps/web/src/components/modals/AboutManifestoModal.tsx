import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ShieldCheck,
  Binary,
  Layers,
  ExternalLink,
  BookOpen,
  Award,
  Zap,
  Atom,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { hudAudio } from "@/features/audio/audio-sfx";
import { cn } from "@/lib/utils";

export interface AboutManifestoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutManifestoModal: React.FC<AboutManifestoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"manifesto" | "math" | "architecture" | "orchestra">("manifesto");

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col h-[90dvh] max-h-[820px] w-full max-w-4xl rounded-2xl border border-cyan-500/30 bg-[#070b16]/95 shadow-[0_0_60px_rgba(0,240,255,0.15)] overflow-hidden"
        >
          {/* Header */}
          <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-4 bg-gradient-to-r from-cyan-950/40 via-transparent to-indigo-950/40">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-400/30 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                <Atom className="size-5 text-cyan-400 animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold tracking-wider text-white">XPLAIN_AI // SYMBIONT</h2>
                  <span className="rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300">
                    v3.5.0 SOVEREIGN
                  </span>
                </div>
                <p className="text-xs text-slate-400">Autonomous Epistemic Operating System & Grounding Engine</p>
              </div>
            </div>

            <button
              onClick={() => {
                hudAudio.playClick(900);
                onClose();
              }}
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 border-b border-white/10 bg-black/40 px-5 py-2 overflow-x-auto scrollbar-none">
            {[
              { id: "manifesto", label: "Epistemic Manifesto", icon: BookOpen },
              { id: "math", label: "EGI 2.0 Mathematics", icon: Binary },
              { id: "architecture", label: "System Topology", icon: Layers },
              { id: "orchestra", label: "Orchestra 3.3.6 Engine", icon: Award },
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    hudAudio.playClick(1300);
                    setActiveTab(t.id as any);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-mono font-medium transition-all",
                    active
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-[0_0_12px_rgba(0,240,255,0.2)]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  )}
                >
                  <Icon className="size-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-slim space-y-6 text-sm text-slate-300">
            {activeTab === "manifesto" && (
              <div className="space-y-6 animate-fadeIn">
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/15 p-4">
                  <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2 mb-1.5">
                    <Zap className="size-4 text-cyan-400" />
                    The Crisis of Generative Fluency
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-300">
                    Conventional LLMs (ChatGPT, Gemini, Claude) generate fluid, convincing prose regardless of whether the
                    underlying statements are empirically true. In academic, medical, and scientific domains, this creates
                    dangerous pseudo-veracity. Standard AI produces hallucinated facts, superficial detached citations,
                    and suppresses peer-reviewed scientific contradictions.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400">Traditional Black-Box LLM</h4>
                    <ul className="text-xs space-y-1.5 text-slate-400">
                      <li>• Unfalsifiable &quot;trust-me&quot; chat responses</li>
                      <li>• Hallucinated URLs and unlinked bibliographies</li>
                      <li>• Smooths over dialectic disputes arbitrarily</li>
                      <li>• Zero provenance or chunk-level token audit trails</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">XplainAI Epistemic OS</h4>
                    <ul className="text-xs space-y-1.5 text-slate-300">
                      <li>• Atomic proposition extraction with chunk bounding boxes</li>
                      <li>• Deterministic EGI 2.0 harmonic grounding scores</li>
                      <li>• Automated cross-source contradiction matrix</li>
                      <li>• Interactive 3D WebGL knowledge constellation</li>
                    </ul>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                  <h4 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">The Sovereign Loop</h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-mono">
                    Query → Polite SSRF-Protected Web Crawler → Vector Chunking & Embedding → Multi-Agent Synthesis → Claim Extraction → Dialectic Contradiction Verification → Harmonic EGI 2.0 Calculation → 3D Topology Stream
                  </p>
                </div>
              </div>
            )}

            {activeTab === "math" && (
              <div className="space-y-6 animate-fadeIn">
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-5 space-y-3 font-mono">
                  <span className="text-xs uppercase font-bold text-indigo-400 tracking-wider">Core Grounding Equation</span>
                  <div className="rounded-lg bg-black/60 p-4 text-center border border-indigo-500/20 text-cyan-300 text-sm sm:text-base overflow-x-auto">
                    S_grounding(c_i, E) = max_{"{"}e_j in E{"}"} [ α·cos(v_c_i, v_e_j) + β·Lex(c_i, e_j) + γ·R_domain(e_j) ] - δ·C(c_i)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Evaluates the mathematical validity of proposition c_i against empirical passage set E.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-1">
                    <span className="text-cyan-300 font-bold">α = 0.50 (Cosine Embedding)</span>
                    <p className="text-slate-400">Dense vector similarity via text-embedding-3-small or FastEmbed.</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-1">
                    <span className="text-emerald-300 font-bold">β = 0.25 (Lexical Overlap)</span>
                    <p className="text-slate-400">Normalized BM25 / ROUGE-L token intersection score.</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-1">
                    <span className="text-indigo-300 font-bold">γ = 0.25 (Domain Reputation)</span>
                    <p className="text-slate-400">Pre-calibrated academic ratings (ArXiv: 1.0, Nature: 1.0, Web: 0.40).</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-1">
                    <span className="text-rose-300 font-bold">δ = 0.35 (Contradiction Penalty)</span>
                    <p className="text-slate-400">Subtractive penalty applied when conflicting evidence is detected.</p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-2 font-mono">
                  <span className="text-xs text-amber-400 font-bold">Harmonic Mean Guarantee</span>
                  <div className="rounded bg-black/70 p-3 text-center text-amber-300 text-sm">
                    EGI_overall = N / ∑ [ 1 / (S_grounding(c_i, E) + ε) ]
                  </div>
                  <p className="text-xs text-slate-400">
                    Why harmonic mean? If an LLM writes 9 factual sentences but slips in 1 completely fabricated claim,
                    an arithmetic average would hide the flaw at 90%. The harmonic mean immediately penalizes the total score down to &lt;50%, preventing deceptive trust.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "architecture" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs space-y-3">
                  <span className="text-cyan-400 font-bold uppercase tracking-wider">Monorepo Clean Architecture</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg border border-cyan-500/20 bg-cyan-950/20">
                      <div className="font-bold text-cyan-300">apps/web</div>
                      <div className="text-[11px] text-slate-400 mt-1">React 19, Vite 6, Tailwind 4, Three.js 3D Constellation, 2D ReactFlow DAG.</div>
                    </div>
                    <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-950/20">
                      <div className="font-bold text-indigo-300">apps/api</div>
                      <div className="text-[11px] text-slate-400 mt-1">FastAPI 0.115+, LangGraph Multi-Agent, EGI 2.0 Engine, Model Context Protocol (MCP).</div>
                    </div>
                    <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-950/20">
                      <div className="font-bold text-emerald-300">infrastructure</div>
                      <div className="text-[11px] text-slate-400 mt-1">PostgreSQL 16 + pgvector, Redis 7 Sliding Window Limiter, Prometheus &amp; OpenTelemetry.</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2 text-xs">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-400" />
                    Distributed Cost Circuit Breaker (Zero-Risk Public Testing)
                  </h4>
                  <p className="text-slate-300 leading-relaxed">
                    XplainAI protects users and sponsors from denial-of-wallet exploits via server-side Redis Lua sliding windows:
                    <br />
                    • <span className="text-cyan-400 font-mono">$10.00 / day</span> global spending ceiling
                    <br />
                    • <span className="text-cyan-400 font-mono">$2.00 / hour</span> surge ceiling
                    <br />
                    • <span className="text-cyan-400 font-mono">$0.50 / IP / day</span> per-user fair play threshold
                  </p>
                </div>
              </div>
            )}

            {activeTab === "orchestra" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-2">
                  <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                    <Award className="size-4 text-cyan-400" />
                    Orchestra 3.3.6 Governance
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    This version was audited, refined, and engineered under <strong>Orchestra 3.3.6</strong> standards.
                    Orchestra is a sovereign control plane that enforces:
                  </p>
                  <ul className="text-xs text-slate-400 space-y-1.5 pl-4 list-disc">
                    <li><strong className="text-white">Visual Evidence Gate:</strong> No frontend changes or UI features are accepted without observed headless Playwright screenshots.</li>
                    <li><strong className="text-white">Two-Lock Design Lab:</strong> Enforces calibrated semantic tokens, non-generic typography, and hardware-accelerated micro-motion.</li>
                    <li><strong className="text-white">Zero Prototype Bloat:</strong> Elimination of redundant libraries and competing procedural code in favor of one authoritative LangGraph state machine.</li>
                    <li><strong className="text-white">Sovereign Backup &amp; Rollback:</strong> Automated zero-risk zip snapshots before structural mutations.</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/40 p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">GitHub Open Source Release</div>
                    <div className="text-[11px] text-slate-400">Available under the permissive MIT License</div>
                  </div>
                  <a
                    href="https://github.com/mahik504/XplainAI"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-mono text-cyan-300 hover:bg-cyan-500/20 transition"
                  >
                    Repository <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/10 bg-[#05070D] px-5 py-3">
            <span className="text-[11px] font-mono text-slate-500">
              XplainAI // Indian Institute of Information Technology (IIIT) Research Initiative
            </span>
            <Button
              size="sm"
              onClick={() => {
                hudAudio.playClick(800);
                onClose();
              }}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs px-4"
            >
              Close
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
