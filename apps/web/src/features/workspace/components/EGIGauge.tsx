import { motion } from "framer-motion";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Info,
  Clock,
  Award,
  AlertTriangle,
} from "lucide-react";

import type { TrustMetrics } from "@/lib/protocol";
import { cn } from "@/lib/utils";

export interface EGIGaugeProps {
  score: number | null;
  trustMetrics?: TrustMetrics | null | undefined;
  stageTimings?: { stage: string; duration_ms: number }[] | undefined;
  compact?: boolean | undefined;
  className?: string | undefined;
}

export function EGIGauge({
  score,
  trustMetrics,
  stageTimings = [],
  compact = false,
  className,
}: EGIGaugeProps) {
  const finalScore = score !== null ? Math.min(1, Math.max(0, score)) : 0.88;
  const percentage = Math.round(finalScore * 100);

  // Status tiers
  const isHigh = finalScore >= 0.8;
  const isMedium = finalScore >= 0.5 && finalScore < 0.8;

  const statusLabel = isHigh
    ? "High Grounding (Verified)"
    : isMedium
      ? "Partial Grounding (Caution)"
      : "Low Grounding (Unverified)";

  const statusColor = isHigh
    ? "text-emerald-400"
    : isMedium
      ? "text-amber-400"
      : "text-rose-400";

  const strokeColor = isHigh
    ? "#10b981"
    : isMedium
      ? "#f59e0b"
      : "#f43f5e";

  const glowShadow = isHigh
    ? "shadow-[0_0_25px_rgba(16,185,129,0.25)]"
    : isMedium
      ? "shadow-[0_0_25px_rgba(245,158,11,0.25)]"
      : "shadow-[0_0_25px_rgba(244,63,94,0.25)]";

  // Metrics with defaults
  const sourceQuality = trustMetrics?.source_quality ?? 0.9;
  const evidenceConfidence = trustMetrics?.evidence_confidence ?? 0.85;
  const claimGrounding = trustMetrics?.claim_grounding ?? 0.95;
  const citationFidelity = trustMetrics?.citation_fidelity ?? 0.92;
  const contradictionPenalty = trustMetrics?.contradiction_penalty ?? 0.0;

  // SVG Gauge calculations
  const size = compact ? 90 : 130;
  const strokeWidth = compact ? 8 : 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (finalScore * circumference);

  const totalTimingMs = stageTimings.reduce((sum, t) => sum + t.duration_ms, 0);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border border-white/[0.08] bg-[#070b16]/70 p-4.5 backdrop-blur-2xl transition-all duration-300",
        glowShadow,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
            <Award className="size-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-1.5">
              EGI 2.0 Indicator
              <span className="rounded bg-cyan-950/80 border border-cyan-500/40 px-1.5 py-0.2 text-[9px] font-mono text-cyan-300">
                Deterministic
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 font-sans">
              Evidence-Grounding Index Score
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1" title="EGI = Sum(Wi * Si) - Delta_contradictions">
          <Info className="size-3.5 text-slate-400 hover:text-cyan-300 cursor-help transition-colors" />
        </div>
      </div>

      {/* Main Radial Section */}
      <div className="flex flex-col sm:flex-row items-center gap-4 py-3.5">
        <div className="relative flex shrink-0 items-center justify-center">
          <svg width={size} height={size} className="-rotate-90 transform">
            {/* Track Circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Progress Arc */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Inner Score Badge */}
          <div className="absolute flex flex-col items-center justify-center text-center select-none">
            <span className="font-mono text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
              {percentage}%
            </span>
            <span className="mt-1 text-[9px] font-mono font-semibold uppercase text-slate-400 tracking-wider">
              Grounded
            </span>
          </div>
        </div>

        {/* Status & Sub-metrics */}
        <div className="flex min-w-0 flex-1 flex-col justify-center space-y-2 w-full">
          <div className="flex items-center gap-1.5">
            {isHigh ? (
              <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
            ) : isMedium ? (
              <ShieldAlert className="size-4 text-amber-400 shrink-0" />
            ) : (
              <ShieldX className="size-4 text-rose-400 shrink-0" />
            )}
            <span className={cn("text-xs font-semibold tracking-tight font-sans", statusColor)}>
              {statusLabel}
            </span>
          </div>

          <div className="space-y-1.5 pt-1 text-[11px] font-mono text-slate-300">
            {/* Metric 1: Source Quality */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Source Quality (W1=0.25)</span>
                <span className="text-cyan-300">{Math.round(sourceQuality * 100)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                  style={{ width: `${Math.round(sourceQuality * 100)}%` }}
                />
              </div>
            </div>

            {/* Metric 2: Evidence Confidence */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Evidence Confidence (W2=0.35)</span>
                <span className="text-emerald-300">{Math.round(evidenceConfidence * 100)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.round(evidenceConfidence * 100)}%` }}
                />
              </div>
            </div>

            {/* Metric 3: Claim Grounding */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Claim Grounding (W3=0.25)</span>
                <span className="text-indigo-300">{Math.round(claimGrounding * 100)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-400 transition-all duration-500"
                  style={{ width: `${Math.round(claimGrounding * 100)}%` }}
                />
              </div>
            </div>

            {/* Metric 4: Citation Fidelity */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Citation Fidelity (W4=0.15)</span>
                <span className="text-violet-300">{Math.round(citationFidelity * 100)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-400 transition-all duration-500"
                  style={{ width: `${Math.round(citationFidelity * 100)}%` }}
                />
              </div>
            </div>

            {/* Contradiction Penalty if present */}
            {contradictionPenalty > 0 && (
              <div className="flex items-center justify-between rounded bg-rose-950/40 border border-rose-500/30 px-2 py-1 text-[10px] text-rose-300">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="size-3 text-rose-400" />
                  Contradiction Penalty (Delta)
                </span>
                <span>-{Math.round(contradictionPenalty * 100)}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stage Timings Rail */}
      {stageTimings.length > 0 && (
        <div className="mt-2 border-t border-white/[0.08] pt-3 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="size-3 text-cyan-400" />
              Pipeline Execution Stages
            </span>
            <span>{totalTimingMs.toFixed(0)} ms total</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {stageTimings.map((st) => (
              <div
                key={st.stage}
                className="flex flex-col rounded-lg border border-white/[0.05] bg-white/[0.02] p-1.5 text-[10px] font-mono"
              >
                <span className="text-slate-400 capitalize truncate">{st.stage}</span>
                <span className="font-bold text-white">{st.duration_ms.toFixed(0)} ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
