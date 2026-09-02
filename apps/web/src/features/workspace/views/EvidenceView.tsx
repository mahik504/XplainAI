import { ShieldCheck } from "lucide-react";

import { ClaimMatrix } from "@/features/workspace/components/ClaimMatrix";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

export interface EvidenceViewProps {
  className?: string;
}

export function EvidenceView({ className }: EvidenceViewProps) {
  const domainClaims = useSessionStore((state) => state.domainClaims);
  const domainEvidence = useSessionStore((state) => state.domainEvidence);
  const domainSources = useSessionStore((state) => state.domainSources);
  const contradictions = useSessionStore((state) => state.contradictions);
  const spotlightClaimId = useUIStore((state) => state.spotlightClaimId);
  const setComposerPrefill = useUIStore((state) => state.setComposerPrefill);
  const setActiveCanvasTab = useUIStore((state) => state.setActiveCanvasTab);

  const handleDemandEvidence = (claimText: string) => {
    setComposerPrefill(claimText);
    setActiveCanvasTab("overview");
  };

  return (
    <div className={cn("flex flex-col space-y-4 pb-8", className)}>
      {/* Header Banner */}
      <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#070b16]/60 p-4 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="size-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
              Claim Verification Matrix
              <span className="rounded bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                {domainClaims.length} Claims Verified
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 font-sans">
              Automated epistemic decomposition of synthesis assertions aligned to empirical evidence snippets
            </p>
          </div>
        </div>
      </div>

      {/* Main Claim Matrix Component */}
      <ClaimMatrix
        claims={domainClaims}
        evidence={domainEvidence}
        sources={domainSources}
        contradictions={contradictions}
        onDemandEvidence={handleDemandEvidence}
        spotlightClaimId={spotlightClaimId}
      />
    </div>
  );
}
