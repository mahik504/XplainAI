import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { memo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/common/EmptyState";
import { PanelShell, type PanelProps } from "@/components/common/PanelShell";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ClaimFocusMetrics } from "@/lib/claim-focus";
import { cn } from "@/lib/utils";

export interface TrustSignal {
  id: string;
  label: string;
  value: number;
}

export interface TrustPoint {
  label: string;
  value: number;
}

interface TrustPanelProps extends PanelProps {
  score?: number | null;
  signals?: TrustSignal[];
  history?: TrustPoint[];
  /** Claim Focus Mode metrics — replaces global response metrics while focused. */
  claimMetrics?: ClaimFocusMetrics | null;
}

function toneFor(value: number) {
  if (value >= 0.75) return { badge: "emerald" as const, bar: "bg-neon-emerald" };
  if (value >= 0.45) return { badge: "amber" as const, bar: "bg-neon-amber" };
  return { badge: "destructive" as const, bar: "bg-destructive" };
}

const ClaimTrustBody = memo(function ClaimTrustBody({ metrics }: { metrics: ClaimFocusMetrics }) {
  const supportPct = Math.round(metrics.supportLevel * 100);
  const tone = toneFor(metrics.supportLevel);

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div className="flex items-end gap-3">
        <div className="relative">
          <motion.span
            key={supportPct}
            initial={{ opacity: 0.35, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="neon-text font-mono text-4xl font-semibold tabular-nums"
          >
            {supportPct}
          </motion.span>
          <span className="trust-ring" aria-hidden />
        </div>
        <div className="pb-1">
          <p className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Claim support
          </p>
          <p className="text-xs text-muted-foreground">Focused assertion metrics</p>
        </div>
      </div>

      <p className="rounded-lg border border-neon-cyan/25 bg-neon-cyan/8 px-2.5 py-2 text-xs leading-relaxed text-foreground/90">
        {metrics.assertionText}
      </p>

      <ul className="flex flex-col gap-3">
        <li className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Evidence markers</span>
            <span className="font-mono tabular-nums text-foreground">
              {String(metrics.evidenceMarkerCount)}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div
              className={cn("h-full rounded-full", tone.bar)}
              initial={{ width: 0 }}
              animate={{
                width: `${String(Math.min(100, metrics.evidenceMarkerCount * 34))}%`,
              }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </li>
        <li className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Uncertainty</span>
            <span className="font-mono tabular-nums text-foreground">
              {String(metrics.uncertaintyCount)}
            </span>
          </div>
        </li>
        <li className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Support level</span>
            <span className="font-mono tabular-nums text-foreground">{String(supportPct)}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div
              className={cn("h-full rounded-full", tone.bar)}
              initial={{ width: 0 }}
              animate={{ width: `${String(supportPct)}%` }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </li>
      </ul>

      <div>
        <p className="mb-2 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          Linked evidence
        </p>
        {metrics.linkedEvidence.length === 0 ? (
          <p className="text-xs text-neon-amber">No supporting evidence detected</p>
        ) : (
          <ul className="space-y-2">
            {metrics.linkedEvidence.map((text, index) => (
              <li
                key={`${String(index)}-${text.slice(0, 24)}`}
                className="rounded-md border border-neon-emerald/25 bg-neon-emerald/8 px-2 py-1.5 text-xs leading-relaxed text-foreground/85"
              >
                {text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});

export function TrustPanel({
  score = null,
  signals = [],
  history = [],
  claimMetrics = null,
  active,
  className,
}: TrustPanelProps) {
  const resolvedScore = score !== null && Number.isFinite(score) ? score : null;
  const isEmpty =
    !claimMetrics && resolvedScore === null && signals.length === 0 && history.length === 0;
  const tone = claimMetrics
    ? toneFor(claimMetrics.supportLevel)
    : resolvedScore === null
      ? null
      : toneFor(resolvedScore);
  const percent = claimMetrics
    ? Math.round(claimMetrics.supportLevel * 100)
    : resolvedScore === null
      ? null
      : Math.round(resolvedScore * 100);

  return (
    <PanelShell
      icon={ShieldCheck}
      title="Signals"
      description={claimMetrics ? "Claim support" : "Response assessment"}
      active={active}
      className={className}
      actions={
        tone && percent !== null ? <Badge variant={tone.badge}>{percent}%</Badge> : null
      }
    >
      {isEmpty ? (
        <EmptyState
          icon={ShieldCheck}
          title="Waiting for a finished response"
          description="Evidence, reasoning, and structure-match scores appear after a finished reply — from observable response text, not private chain-of-thought."
        />
      ) : claimMetrics ? (
        <ScrollArea className="h-full">
          <ClaimTrustBody metrics={claimMetrics} />
        </ScrollArea>
      ) : (
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-5 px-4 py-4">
            {percent !== null ? (
              <div className="flex items-end gap-3">
                <div className="relative">
                  <motion.span
                    key={percent}
                    initial={{ opacity: 0.35, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="neon-text font-mono text-4xl font-semibold tabular-nums"
                  >
                    {percent}
                  </motion.span>
                  <span className="trust-ring" aria-hidden />
                </div>
                <div className="pb-1">
                  <p className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                    Response assessment
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Explainability signals from finished response structure
                  </p>
                </div>
              </div>
            ) : null}

            {history.length > 0 ? (
              <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="trust-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--neon-cyan)" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="var(--neon-violet)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" hide />
                    <YAxis domain={[0, 1]} hide />
                    <RechartsTooltip
                      cursor={{ stroke: "var(--border)" }}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                        fontSize: "0.75rem",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--neon-cyan)"
                      strokeWidth={2}
                      fill="url(#trust-gradient)"
                      isAnimationActive
                      animationDuration={420}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : null}

            {signals.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {signals
                  .filter((signal) =>
                    ["confidence", "evidence", "reasoning"].includes(signal.id),
                  )
                  .map((signal) => (
                    <li key={signal.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-muted-foreground">{signal.label}</span>
                        <span className="font-mono tabular-nums text-foreground">
                          {Math.round(signal.value * 100)}%
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
                        <motion.div
                          className={cn("h-full rounded-full", toneFor(signal.value).bar)}
                          initial={{ width: 0 }}
                          animate={{ width: `${String(Math.round(signal.value * 100))}%` }}
                          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        </ScrollArea>
      )}
    </PanelShell>
  );
}
