import type { ClaimFocusMetrics } from "@/lib/claim-focus";
import type { ResponseStructureAnalysis } from "@/lib/xai";
import { cn } from "@/lib/utils";
import { Activity, ShieldCheck, HelpCircle, CheckCircle2 } from "lucide-react";

interface StructuralSignalsCardProps {
  analysis: ResponseStructureAnalysis | null;
  claimMetrics?: ClaimFocusMetrics | null;
  retrievedSourcesCount?: number;
}

export function StructuralSignalsCard({
  analysis,
  claimMetrics = null,
  retrievedSourcesCount = 0,
}: StructuralSignalsCardProps) {
  if (claimMetrics) {
    const supportPct = Math.round(claimMetrics.supportLevel * 100);
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.04] p-3.5 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-blue-400 font-semibold">
              Focused Assertion
            </span>
            <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
              {supportPct}% Grounded
            </span>
          </div>
          <p className="text-xs leading-relaxed text-foreground font-medium">
            "{claimMetrics.assertionText}"
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
            <span>Empirical Grounding</span>
            <span className="text-blue-400 font-semibold">{supportPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${supportPct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SignalMetricTile
            label="Evidence Links"
            value={claimMetrics.evidenceMarkerCount}
            tone="emerald"
            icon={CheckCircle2}
          />
          <SignalMetricTile
            label="Retrieved Sources"
            value={claimMetrics.retrievedSourcesCount}
            tone="blue"
            icon={ShieldCheck}
          />
          <SignalMetricTile
            label="Support Signal"
            value={`${supportPct}%`}
            tone="violet"
            icon={Activity}
          />
          <SignalMetricTile
            label="Epistemic State"
            value={claimMetrics.uncertaintyLabel}
            tone="amber"
            icon={HelpCircle}
          />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-xl border border-border/60 bg-white/[0.02] p-6 text-center text-xs text-muted-foreground">
        <Activity className="mx-auto size-8 text-muted-foreground/40 mb-2" />
        <p className="font-medium text-foreground">No Epistemic Signals Yet</p>
        <p className="mt-1 text-muted-foreground/80">
          Observable sentence markers, evidence ratios, and claim graphs will compute as responses stream.
        </p>
      </div>
    );
  }

  const { score } = analysis;
  const totalSentences = score.sentenceCount || 1;
  const claimPct = Math.round((score.claimCount / totalSentences) * 100);
  const evidencePct = Math.round((score.evidenceCount / totalSentences) * 100);
  const reasoningPct = Math.round((score.reasoningCount / totalSentences) * 100);

  return (
    <div className="space-y-4">
      {/* Structural Distribution Spectrum */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
          <span>Sentence Anatomy Spectrum</span>
          <span>{totalSentences} sentences</span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06] p-0.5 gap-0.5">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${claimPct}%` }}
            title={`Assertions: ${score.claimCount}`}
          />
          <div
            className="h-full rounded-full bg-emerald-400 transition-all"
            style={{ width: `${evidencePct}%` }}
            title={`Evidence: ${score.evidenceCount}`}
          />
          <div
            className="h-full rounded-full bg-violet-400 transition-all"
            style={{ width: `${reasoningPct}%` }}
            title={`Connectors: ${score.reasoningCount}`}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-0.5">
          <span className="flex items-center gap-1 text-blue-400">· {score.claimCount} Claims</span>
          <span className="flex items-center gap-1 text-emerald-400">· {score.evidenceCount} Evidence</span>
          <span className="flex items-center gap-1 text-violet-400">· {score.reasoningCount} Connectors</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SignalMetricTile
          label="Testable Claims"
          value={score.claimCount}
          tone="blue"
          icon={CheckCircle2}
        />
        <SignalMetricTile
          label="Evidence Markers"
          value={score.evidenceCount}
          tone="emerald"
          icon={ShieldCheck}
        />
        <SignalMetricTile
          label="Uncertainty Cues"
          value={score.hedgeCount}
          tone="amber"
          icon={HelpCircle}
        />
        <SignalMetricTile
          label="Reasoning Connectors"
          value={score.reasoningCount}
          tone="violet"
          icon={Activity}
        />
        <SignalMetricTile
          label="Verified Research Citations"
          value={retrievedSourcesCount}
          tone="emerald"
          icon={ShieldCheck}
          className="col-span-2"
        />
      </div>

      <p className="text-[10px] font-mono text-muted-foreground/60 leading-relaxed">
        Observable syntax breakdown. Zero simulated chain-of-thought.
      </p>
    </div>
  );
}

function SignalMetricTile({
  label,
  value,
  tone,
  icon: Icon,
  className,
}: {
  label: string;
  value: number | string;
  tone: "blue" | "emerald" | "amber" | "violet";
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const toneMap = {
    blue: "border-blue-500/30 bg-blue-500/[0.04] text-blue-400",
    emerald: "border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-400",
    amber: "border-amber-500/30 bg-amber-500/[0.04] text-amber-400",
    violet: "border-violet-500/30 bg-violet-500/[0.04] text-violet-400",
  }[tone];

  return (
    <div className={cn("rounded-xl border p-3 bg-white/[0.02] transition-all hover:bg-white/[0.04]", toneMap, className)}>
      <div className="flex items-center justify-between">
        <Icon className="size-3.5 opacity-80" />
        <span className="font-mono text-lg font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </span>
      </div>
      <p className="mt-1 text-[11px] font-medium text-muted-foreground font-mono">{label}</p>
    </div>
  );
}

