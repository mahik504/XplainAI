import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Search,
  ExternalLink,
  Layers,
  Maximize2,
  Send,
  ChevronDown,
  ChevronRight,
  Flame,
  FileText,
} from "lucide-react";

import { hudAudio } from "@/features/audio/audio-sfx";
import type {
  DomainClaim,
  DomainEvidence,
  DomainSource,
  ContradictionItem,
  ClaimStatus,
} from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

export interface ClaimMatrixProps {
  claims: DomainClaim[];
  evidence: DomainEvidence[];
  sources: DomainSource[];
  contradictions?: ContradictionItem[] | undefined;
  onDemandEvidence?: ((claimText: string) => void) | undefined;
  onLocateInGraph?: ((claimId: string) => void) | undefined;
  spotlightClaimId?: string | null | undefined;
  className?: string | undefined;
}

export function ClaimMatrix({
  claims = [],
  evidence = [],
  sources = [],
  contradictions = [],
  onDemandEvidence,
  onLocateInGraph,
  spotlightClaimId,
  className,
}: ClaimMatrixProps) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedClaimIds, setExpandedClaimIds] = useState<Set<string>>(new Set());

  const setComposerPrefill = useUIStore((state) => state.setComposerPrefill);
  const setActiveCanvasTab = useUIStore((state) => state.setActiveCanvasTab);
  const setSelectedNodeId = useUIStore((state) => state.setSpotlightClaimId);

  const evidenceMap = useMemo(() => {
    const map = new Map<string, DomainEvidence>();
    evidence.forEach((e) => map.set(e.id, e));
    return map;
  }, [evidence]);

  const sourceMap = useMemo(() => {
    const map = new Map<string, DomainSource>();
    sources.forEach((s) => map.set(s.id, s));
    return map;
  }, [sources]);

  const totalClaims = claims.length;
  const supportedCount = claims.filter((c) => c.status === "supported").length;
  const weaklySupportedCount = claims.filter((c) => c.status === "weakly_supported").length;
  const contradictedCount = claims.filter((c) => c.status === "contradicted").length;
  const supportRate = totalClaims > 0 ? Math.round((supportedCount / totalClaims) * 100) : 0;

  const toggleExpand = (id: string) => {
    hudAudio.playClick(1200);
    setExpandedClaimIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDemandEvidence = (claim: DomainClaim) => {
    hudAudio.playChirp();
    const query = `Verify and retrieve empirical peer-reviewed evidence for the claim: "${claim.text}"`;
    if (onDemandEvidence) {
      onDemandEvidence(query);
    } else {
      setComposerPrefill(query);
      setActiveCanvasTab("overview");
    }
  };

  const handleLocateInGraph = (claimId: string) => {
    hudAudio.playChirp();
    if (onLocateInGraph) {
      onLocateInGraph(claimId);
    } else {
      setSelectedNodeId(claimId);
      setActiveCanvasTab("graph");
    }
  };

  const filteredClaims = useMemo(() => {
    return claims.filter((c) => {
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        return (
          c.text.toLowerCase().includes(q) ||
          c.importance.toLowerCase().includes(q) ||
          c.status.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [claims, filterStatus, searchQuery]);

  const getStatusBadge = (status: ClaimStatus) => {
    switch (status) {
      case "supported":
        return {
          icon: <CheckCircle2 className="size-3.5 text-emerald-400" />,
          label: "Supported",
          className: "bg-emerald-950/60 border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15)]",
        };
      case "weakly_supported":
        return {
          icon: <AlertTriangle className="size-3.5 text-amber-400" />,
          label: "Weakly Supported",
          className: "bg-amber-950/60 border-amber-500/40 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.15)]",
        };
      case "contradicted":
        return {
          icon: <XCircle className="size-3.5 text-rose-400" />,
          label: "Contradicted",
          className: "bg-rose-950/60 border-rose-500/40 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.15)]",
        };
      default:
        return {
          icon: <HelpCircle className="size-3.5 text-slate-400" />,
          label: "Unverified",
          className: "bg-slate-900/60 border-slate-700/50 text-slate-300",
        };
    }
  };

  return (
    <div className={cn("flex flex-col space-y-4", className)}>
      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="rounded-xl border border-white/[0.08] bg-[#070b16]/60 p-3 backdrop-blur-xl">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Total Claims</span>
          <p className="mt-1 font-mono text-xl font-bold text-white">{totalClaims}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 backdrop-blur-xl">
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">Supported</span>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-300">{supportedCount}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 backdrop-blur-xl">
          <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">Weak / Partial</span>
          <p className="mt-1 font-mono text-xl font-bold text-amber-300">{weaklySupportedCount}</p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3 backdrop-blur-xl">
          <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider">Contradictions</span>
          <p className="mt-1 font-mono text-xl font-bold text-rose-300">{contradictedCount}</p>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 backdrop-blur-xl">
          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">Grounding Rate</span>
          <p className="mt-1 font-mono text-xl font-bold text-cyan-300">{supportRate}%</p>
        </div>
      </div>

      {/* Contradictions Callout Alert if any */}
      {contradictions.length > 0 && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 backdrop-blur-xl space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-rose-400 shrink-0" />
            <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-rose-300">
              Contradiction Matrix ({contradictions.length} Conflict{contradictions.length > 1 ? "s" : ""} Detected)
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {contradictions.map((con) => (
              <div
                key={con.id}
                className="rounded-lg border border-rose-500/20 bg-black/40 p-3 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded bg-rose-900/60 px-1.5 py-0.5 text-[9px] font-mono uppercase text-rose-200">
                    {con.severity} Severity
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 capitalize">
                    {con.contradiction_type.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-slate-200 text-[11px] leading-relaxed font-sans">
                  {con.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {["all", "supported", "weakly_supported", "contradicted", "unverified"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                hudAudio.playClick(1000);
                setFilterStatus(status);
              }}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition-all capitalize",
                filterStatus === status
                  ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                  : "bg-white/[0.03] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.06]"
              )}
            >
              {status.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search claims or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-white/[0.1] bg-black/40 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Claim Cards List */}
      <div className="space-y-3">
        {filteredClaims.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#070b16]/40 p-8 text-center backdrop-blur-xl">
            <HelpCircle className="size-8 text-slate-500" />
            <p className="mt-2 text-xs font-medium text-slate-300">No claims match the selected filter.</p>
          </div>
        ) : (
          filteredClaims.map((claim) => {
            const badge = getStatusBadge(claim.status);
            const isExpanded = expandedClaimIds.has(claim.id) || spotlightClaimId === claim.id;
            const linkedEvidence = claim.evidence_ids
              .map((id) => evidenceMap.get(id))
              .filter((e): e is DomainEvidence => Boolean(e));
            const confidencePct = Math.round(claim.confidence * 100);

            return (
              <motion.div
                key={claim.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "rounded-xl border transition-all duration-200 overflow-hidden backdrop-blur-xl",
                  spotlightClaimId === claim.id
                    ? "border-cyan-400 bg-cyan-950/30 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                    : "border-white/[0.08] bg-[#070b16]/60 hover:border-white/20"
                )}
              >
                {/* Header Row */}
                <div
                  className="flex items-start justify-between gap-3 p-3.5 cursor-pointer select-none"
                  onClick={() => toggleExpand(claim.id)}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      className="mt-0.5 text-slate-400 hover:text-white transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </button>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold",
                            badge.className
                          )}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>

                        <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-mono text-slate-400 uppercase">
                          {claim.importance} Priority
                        </span>

                        <span className="text-[10px] font-mono text-slate-400">
                          Claim #{claim.sentence_index + 1}
                        </span>

                        <span className="text-[10px] font-mono text-cyan-300">
                          {confidencePct}% Confidence
                        </span>
                      </div>

                      <p className="text-[13px] font-medium text-white leading-relaxed font-sans">
                        {claim.text}
                      </p>
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {(claim.status === "unverified" || claim.status === "weakly_supported") && (
                      <button
                        type="button"
                        onClick={() => handleDemandEvidence(claim)}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-mono text-amber-300 hover:bg-amber-500/20 hover:text-white transition-all shadow-[0_0_8px_rgba(245,158,11,0.15)]"
                        title="Demand additional empirical evidence from web & literature"
                      >
                        <Send className="size-3" />
                        <span>Demand Evidence</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleLocateInGraph(claim.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-mono text-indigo-300 hover:bg-indigo-500/20 hover:text-white transition-all"
                      title="Inspect node in 3D Topology"
                    >
                      <Maximize2 className="size-3" />
                      <span>3D Graph</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Linked Evidence Section */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-white/[0.08] bg-black/40 px-4 py-3 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span className="flex items-center gap-1 text-cyan-300">
                          <Layers className="size-3 text-cyan-400" />
                          Linked Evidence Chunks ({linkedEvidence.length})
                        </span>
                      </div>

                      {linkedEvidence.length === 0 ? (
                        <p className="text-[11px] italic text-slate-500">
                          No direct evidence snippets currently attached to this assertion.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {linkedEvidence.map((evi) => {
                            const src = sourceMap.get(evi.source_id);
                            return (
                              <div
                                key={evi.id}
                                className="rounded-lg border border-white/[0.06] bg-[#070b16]/80 p-3 space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <FileText className="size-3.5 text-cyan-400 shrink-0" />
                                    <h5 className="text-[11px] font-semibold text-white truncate">
                                      {src?.title || evi.source_title || "Primary Research Document"}
                                    </h5>
                                    {src?.domain && (
                                      <span className="text-[9px] font-mono text-slate-400 truncate">
                                        ({src.domain})
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="rounded bg-white/[0.04] px-1 py-0.2 text-[9px] font-mono text-cyan-300">
                                      {Math.round(evi.confidence * 100)}% Match
                                    </span>
                                    {src?.url && (
                                      <a
                                        href={src.url}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="text-slate-400 hover:text-cyan-300 transition-colors"
                                      >
                                        <ExternalLink className="size-3" />
                                      </a>
                                    )}
                                  </div>
                                </div>

                                <p className="text-[11px] leading-relaxed text-slate-300 italic">
                                  "{evi.text}"
                                </p>

                                {evi.page_number && (
                                  <div className="flex items-center gap-2 text-[9px] font-mono text-slate-400 pt-0.5">
                                    <span>Page {evi.page_number}</span>
                                    {evi.bbox && <span>Spatial BBox Defined</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
