import type { ClaimFocusMetrics } from "@/lib/claim-focus";
import type { ResponseStructureAnalysis } from "@/lib/xai";
import { cn } from "@/lib/utils";

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
    return (
      <div className="space-y-3">
        <p className="line-clamp-3 text-xs leading-relaxed text-foreground/90">
          {claimMetrics.assertionText}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <SignalTile label="Evidence markers" value={claimMetrics.evidenceMarkerCount} tone="emerald" />
          <SignalTile label="Retrieved sources" value={claimMetrics.retrievedSourcesCount} tone="cyan" />
          <SignalTile
            label="Support signal"
            value={`${String(Math.round(claimMetrics.supportLevel * 100))}%`}
            tone="violet"
          />
          <SignalTile label="Uncertainty" value={claimMetrics.uncertaintyLabel} tone="amber" />
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Observable response structure — not factual verification.
        </p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <p className="text-xs text-muted-foreground">
        Signals appear after a finished reply — from observable text, not private reasoning.
      </p>
    );
  }

  const { score } = analysis;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <SignalTile label="Assertions" value={score.claimCount} tone="cyan" />
        <SignalTile label="Evidence markers" value={score.evidenceCount} tone="emerald" />
        <SignalTile label="Uncertainty" value={score.hedgeCount} tone="amber" />
        <SignalTile label="Connectors" value={score.reasoningCount} tone="violet" />
        <SignalTile
          label="Retrieved sources"
          value={retrievedSourcesCount}
          tone="cyan"
          className="col-span-2"
        />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Observable response structure — not factual verification.
      </p>
    </div>
  );
}

function SignalTile({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: number | string;
  tone: "cyan" | "emerald" | "amber" | "violet";
  className?: string;
}) {
  const toneClass = {
    cyan: "border-neon-cyan/25 bg-neon-cyan/[0.06]",
    emerald: "border-neon-emerald/25 bg-neon-emerald/[0.06]",
    amber: "border-neon-amber/25 bg-neon-amber/[0.06]",
    violet: "border-neon-violet/25 bg-neon-violet/[0.06]",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        toneClass,
        className,
      )}
    >
      <p className="font-display text-xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
