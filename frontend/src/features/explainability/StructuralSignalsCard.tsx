import type { ClaimFocusMetrics } from "@/lib/claim-focus";
import type { ResponseStructureAnalysis } from "@/lib/xai";
import { Badge } from "@/components/ui/badge";
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
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400 font-semibold">
              FOCUSED ASSERTION
            </span>
            <Badge variant="cyan" className="ml-auto text-[10px] font-mono px-1.5 py-0">
              {supportPct}% Grounded
            </Badge>
          </div>
          <p className="text-xs leading-relaxed text-zinc-200 font-medium">
            "{claimMetrics.assertionText}"
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-mono text-zinc-400">
            <span>Empirical Backing</span>
            <span className="text-cyan-400">{supportPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
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
            tone="cyan"
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
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-center text-xs text-zinc-400">
        <Activity className="mx-auto size-8 text-zinc-600 mb-2" />
        <p className="font-medium text-zinc-200">No Epistemic Signals Yet</p>
        <p className="mt-1 text-zinc-500">
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
        <div className="flex justify-between text-[11px] font-mono text-zinc-400">
          <span>Sentence Anatomy Distribution</span>
          <span>{totalSentences} sentences</span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-800 p-0.5 gap-0.5">
          <div
            className="h-full rounded-full bg-cyan-400 transition-all"
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
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-0.5">
          <span className="flex items-center gap-1 text-cyan-400">? {score.claimCount} Claims</span>
          <span className="flex items-center gap-1 text-emerald-400">? {score.evidenceCount} Evidence</span>
          <span className="flex items-center gap-1 text-violet-400">? {score.reasoningCount} Connectors</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SignalMetricTile
          label="Testable Claims"
          value={score.claimCount}
          tone="cyan"
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
          label="Verified External Sources"
          value={retrievedSourcesCount}
          tone="cyan"
          icon={ShieldCheck}
          className="col-span-2"
        />
      </div>

      <p className="text-[10px] font-mono text-zinc-500 leading-relaxed">
        ? Metrics computed directly from observable surface syntax. Zero simulated chain-of-thought.
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
  tone: "cyan" | "emerald" | "amber" | "violet";
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const toneMap = {
    cyan: "border-cyan-500/20 bg-cyan-950/20 text-cyan-400",
    emerald: "border-emerald-500/20 bg-emerald-950/20 text-emerald-400",
    amber: "border-amber-500/20 bg-amber-950/20 text-amber-400",
    violet: "border-violet-500/20 bg-violet-950/20 text-violet-400",
  }[tone];

  return (
    <div className={cn("rounded-xl border p-3 bg-zinc-900/40", toneMap, className)}>
      <div className="flex items-center justify-between">
        <Icon className="size-3.5 opacity-80" />
        <span className="font-mono text-lg font-bold tracking-tight text-zinc-100 tabular-nums">
          {value}
        </span>
      </div>
      <p className="mt-1 text-[11px] font-medium text-zinc-400">{label}</p>
    </div>
  );
}
