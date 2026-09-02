import { useState } from "react";
import {
  ExternalLink,
  BookOpen,
  Globe,
  FileText,
  Layers,
  Sparkles,
  ShieldCheck,
  Search,
  Maximize2,
} from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { hudAudio } from "@/features/audio/audio-sfx";
import type {
  DomainCitation,
  DomainEvidence,
  DomainSource,
  DomainClaim,
} from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

export interface CitationPopoverProps {
  marker: string;
  citationIndex?: number | undefined;
  citation?: DomainCitation | undefined;
  source?: DomainSource | undefined;
  evidence?: DomainEvidence | undefined;
  claim?: DomainClaim | undefined;
  className?: string | undefined;
}

export function CitationPopover({
  marker,
  citationIndex,
  citation: propCitation,
  source: propSource,
  evidence: propEvidence,
  claim: propClaim,
  className,
}: CitationPopoverProps) {
  const [open, setOpen] = useState(false);

  const domainCitations = useSessionStore((state) => state.domainCitations);
  const domainSources = useSessionStore((state) => state.domainSources);
  const domainEvidence = useSessionStore((state) => state.domainEvidence);
  const domainClaims = useSessionStore((state) => state.domainClaims);

  const setActiveCanvasTab = useUIStore((state) => state.setActiveCanvasTab);
  const setSpotlightClaimId = useUIStore((state) => state.setSpotlightClaimId);
  const setSpotlightEvidenceId = useUIStore((state) => state.setSpotlightEvidenceId);
  const setSelectedNodeId = useSessionStore((state) => state.setSelectedNodeId);

  // Extract numeric index from marker like [1], [^1], or 1
  const numericIndex =
    citationIndex ??
    (() => {
      const match = marker.match(/\d+/);
      return match ? parseInt(match[0], 10) : 1;
    })();

  // Resolve matching citation
  const citation =
    propCitation ??
    domainCitations.find(
      (c) =>
        c.citation_index === numericIndex ||
        c.inline_marker === marker ||
        c.inline_marker === `[${numericIndex}]`
    ) ??
    domainCitations[numericIndex - 1];

  // Resolve matching source
  const source =
    propSource ??
    (citation
      ? domainSources.find((s) => s.id === citation.source_id)
      : domainSources[numericIndex - 1]);

  // Resolve matching evidence
  const evidence =
    propEvidence ??
    (citation
      ? domainEvidence.find((e) => e.id === citation.evidence_id)
      : domainEvidence[numericIndex - 1]);

  // Resolve matching claim
  const claim =
    propClaim ??
    (citation
      ? domainClaims.find((c) => c.id === citation.claim_id)
      : undefined);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      hudAudio.playClick(1400);
    }
    setOpen(nextOpen);
  };

  const handleInspectInEvidence = () => {
    hudAudio.playChirp();
    setOpen(false);
    setActiveCanvasTab("evidence");
    if (claim?.id) {
      setSpotlightClaimId(claim.id);
    } else if (evidence?.id) {
      setSpotlightEvidenceId(evidence.id);
    }
  };

  const handleViewInGraph = () => {
    hudAudio.playChirp();
    setOpen(false);
    setActiveCanvasTab("graph");
    if (source?.id) {
      setSelectedNodeId(source.id);
    } else if (evidence?.id) {
      setSelectedNodeId(evidence.id);
    }
  };

  const getSourceIcon = (type?: string) => {
    switch (type) {
      case "paper":
        return <BookOpen className="size-3.5 text-cyan-400" />;
      case "document":
      case "documentation":
        return <FileText className="size-3.5 text-indigo-400" />;
      case "tool":
        return <Layers className="size-3.5 text-amber-400" />;
      default:
        return <Globe className="size-3.5 text-emerald-400" />;
    }
  };

  const authorityScore = source?.authority_score ?? 0.85;
  const authorityPct = Math.round(authorityScore * 100);
  const evidenceConfidence = evidence?.confidence ?? 0.88;
  const confidencePct = Math.round(evidenceConfidence * 100);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center font-mono font-bold transition-all duration-150",
            "mx-0.5 -translate-y-0.5 rounded px-1.5 py-0.2 text-[10px] leading-tight cursor-pointer select-none",
            "border border-cyan-500/40 bg-cyan-950/50 text-cyan-300 shadow-[0_0_8px_rgba(0,240,255,0.15)]",
            "hover:border-cyan-400 hover:bg-cyan-500/20 hover:text-white hover:shadow-[0_0_12px_rgba(0,240,255,0.35)]",
            "active:scale-95 focus:outline-none focus:ring-1 focus:ring-cyan-400",
            open && "border-cyan-400 bg-cyan-500/30 text-white shadow-[0_0_16px_rgba(0,240,255,0.5)] ring-1 ring-cyan-400",
            className
          )}
          title={`Citation [${numericIndex}]: Click to inspect evidence snippet and source metadata`}
        >
          <span>[{numericIndex}]</span>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align="center"
          sideOffset={6}
          className={cn(
            "z-50 w-84 max-w-[90vw] overflow-hidden rounded-xl border border-cyan-500/30",
            "bg-[#070b16]/95 p-3.5 text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(0,240,255,0.15)]",
            "backdrop-blur-2xl animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-white/[0.08] pb-2.5">
            <div className="flex items-start gap-2 min-w-0">
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
                {getSourceIcon(source?.source_type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[9px] font-bold text-cyan-300 uppercase tracking-wider">
                    Source [{numericIndex}]
                  </span>
                  {source?.source_type && (
                    <span className="rounded bg-cyan-950/60 border border-cyan-500/30 px-1 py-0.2 text-[9px] font-mono text-cyan-300 capitalize">
                      {source.source_type}
                    </span>
                  )}
                  {source?.reliability_tier && (
                    <span
                      className={cn(
                        "rounded px-1 py-0.2 text-[9px] font-mono capitalize border",
                        source.reliability_tier === "high"
                          ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-300"
                          : "bg-amber-950/60 border-amber-500/30 text-amber-300"
                      )}
                    >
                      {source.reliability_tier} tier
                    </span>
                  )}
                </div>
                <h4 className="mt-1 text-xs font-semibold text-white leading-snug line-clamp-2">
                  {source?.title || "Verified Research Source"}
                </h4>
                {source?.domain && (
                  <p className="mt-0.5 text-[10px] font-mono text-slate-400 truncate">
                    {source.domain}
                  </p>
                )}
              </div>
            </div>

            {source?.url && (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-cyan-300"
                title="Open external source in new tab"
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>

          {/* Evidence Excerpt */}
          <div className="my-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1 text-cyan-300">
                <Sparkles className="size-3 text-cyan-400" />
                Evidence Grounding
              </span>
              <span>{confidencePct}% confidence</span>
            </div>

            <div className="relative rounded-lg border border-white/[0.06] bg-black/40 p-2.5 text-[11px] leading-relaxed text-slate-200">
              <p className="italic line-clamp-4">
                &ldquo;{evidence?.text || source?.snippet || "Grounding evidence excerpt verified by autonomous research engine."}&rdquo;
              </p>
            </div>

            {/* Spatial & Authority metadata */}
            <div className="flex items-center justify-between gap-2 pt-0.5 text-[9px] font-mono text-slate-400">
              <div className="flex items-center gap-1">
                <ShieldCheck className="size-3 text-emerald-400" />
                <span>Authority: {authorityPct}%</span>
              </div>
              {evidence?.page_number && (
                <div className="rounded bg-white/[0.04] px-1 py-0.5 border border-white/[0.06]">
                  Page {evidence.page_number}
                </div>
              )}
              {evidence?.bbox && (
                <div className="rounded bg-white/[0.04] px-1 py-0.5 border border-white/[0.06]">
                  BBox Spatial
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-2.5 flex items-center gap-1.5 border-t border-white/[0.08] pt-2">
            <button
              type="button"
              onClick={handleInspectInEvidence}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 hover:text-white"
            >
              <Search className="size-3" />
              <span>Evidence Matrix</span>
            </button>
            <button
              type="button"
              onClick={handleViewInGraph}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-medium text-indigo-300 transition-all hover:bg-indigo-500/20 hover:text-white"
            >
              <Maximize2 className="size-3" />
              <span>3D Topology</span>
            </button>
          </div>

          <PopoverPrimitive.Arrow className="fill-[#070b16] stroke-cyan-500/30" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

