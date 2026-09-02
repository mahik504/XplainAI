import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Globe,
  FileText,
  Layers,
  Search,
  ExternalLink,
  Eye,
  X,
} from "lucide-react";

import { hudAudio } from "@/features/audio/audio-sfx";
import type { DomainSource, DomainEvidence } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

export interface SourcesViewProps {
  className?: string;
}

export function SourcesView({ className }: SourcesViewProps) {
  const domainSources = useSessionStore((state) => state.domainSources);
  const domainEvidence = useSessionStore((state) => state.domainEvidence);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [previewSource, setPreviewSource] = useState<DomainSource | null>(null);

  const evidenceBySource = useMemo(() => {
    const map = new Map<string, DomainEvidence[]>();
    domainEvidence.forEach((e) => {
      const list = map.get(e.source_id) ?? [];
      list.push(e);
      map.set(e.source_id, list);
    });
    return map;
  }, [domainEvidence]);

  const filteredSources = useMemo(() => {
    return domainSources.filter((s) => {
      if (filterType !== "all" && s.source_type !== filterType) return false;
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        return (
          s.title.toLowerCase().includes(q) ||
          s.domain.toLowerCase().includes(q) ||
          s.snippet.toLowerCase().includes(q) ||
          (s.author && s.author.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [domainSources, filterType, searchQuery]);

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "paper":
        return <BookOpen className="size-4 text-cyan-400" />;
      case "document":
      case "documentation":
        return <FileText className="size-4 text-indigo-400" />;
      case "tool":
        return <Layers className="size-4 text-amber-400" />;
      default:
        return <Globe className="size-4 text-emerald-400" />;
    }
  };

  return (
    <div className={cn("flex flex-col space-y-4 pb-8", className)}>
      {/* Header Banner */}
      <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#070b16]/60 p-4 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
            <BookOpen className="size-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
              Source Dossier & Literature Registry
              <span className="rounded bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                {domainSources.length} Registered
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 font-sans">
              Curated registry of crawled web domains, arXiv preprints, uploaded PDFs, and documentation
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {["all", "paper", "web", "document", "tool"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                hudAudio.playClick(900);
                setFilterType(type);
              }}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition-all capitalize",
                filterType === type
                  ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                  : "bg-white/[0.03] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.06]"
              )}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter sources by title, domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-white/[0.1] bg-black/40 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Sources Table / Grid */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#070b16]/70 backdrop-blur-2xl shadow-2xl overflow-hidden">
        {filteredSources.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <BookOpen className="size-8 text-slate-500" />
            <p className="mt-2 text-xs font-medium text-slate-300">No sources found matching filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-4">Source Title & Domain</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Authority</th>
                  <th className="py-3 px-3">Tier</th>
                  <th className="py-3 px-3">Evidence</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredSources.map((source) => {
                  const linkedCount = (evidenceBySource.get(source.id) ?? []).length;
                  const authorityPct = Math.round(source.authority_score * 100);

                  return (
                    <tr
                      key={source.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="py-3 px-4 max-w-sm">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
                            {getSourceIcon(source.source_type)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-white truncate max-w-xs group-hover:text-cyan-200 transition-colors">
                              {source.title || "Research Document"}
                            </h4>
                            <p className="text-[10px] font-mono text-slate-400 truncate">
                              {source.domain || source.url}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="rounded bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-mono text-cyan-300 capitalize">
                          {source.source_type}
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <div className="h-1.5 w-12 rounded-full bg-white/[0.08] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-cyan-400"
                              style={{ width: `${authorityPct}%` }}
                            />
                          </div>
                          <span className="text-slate-200">{authorityPct}%</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-mono capitalize border",
                            source.reliability_tier === "high"
                              ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-300"
                              : "bg-amber-950/60 border-amber-500/30 text-amber-300"
                          )}
                        >
                          {source.reliability_tier || "medium"}
                        </span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-300">
                        {linkedCount} Chunks
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              hudAudio.playClick(1300);
                              setPreviewSource(source);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] font-mono text-slate-300 hover:bg-white/[0.08] hover:text-white transition-all"
                            title="Preview source content"
                          >
                            <Eye className="size-3" />
                            <span>Preview</span>
                          </button>

                          {source.url && (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] p-1 text-slate-400 hover:bg-white/[0.08] hover:text-cyan-300 transition-all"
                              title="Open original URL"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Content Preview Modal */}
      <AnimatePresence>
        {previewSource && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
            onClick={() => setPreviewSource(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative flex flex-col w-full max-w-2xl max-h-[80vh] rounded-2xl border border-cyan-500/30 bg-[#070b16]/95 shadow-2xl backdrop-blur-2xl overflow-hidden"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] p-4.5 bg-black/20">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                    {getSourceIcon(previewSource.source_type)}
                  </div>
                  <div className="min-w-0">
                    <span className="font-mono text-[9px] font-bold text-cyan-300 uppercase tracking-wider">
                      {previewSource.source_type} Source
                    </span>
                    <h3 className="text-sm font-bold text-white leading-snug">
                      {previewSource.title}
                    </h3>
                    <p className="mt-0.5 text-xs font-mono text-slate-400 truncate">
                      {previewSource.domain || previewSource.url}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewSource(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    Extracted Verbatim Content
                  </span>
                  <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4 text-xs leading-relaxed text-slate-200 font-sans whitespace-pre-wrap">
                    {previewSource.snippet || "Full document text ingested and verified by autonomous evidence parser."}
                  </div>
                </div>

                {evidenceBySource.get(previewSource.id) && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">
                      Extracted Evidence Snippets ({evidenceBySource.get(previewSource.id)?.length})
                    </span>
                    <div className="space-y-2">
                      {evidenceBySource.get(previewSource.id)?.map((evi) => (
                        <div
                          key={evi.id}
                          className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs italic text-slate-300"
                        >
                          "{evi.text}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-white/[0.08] p-3.5 bg-black/20 text-xs font-mono">
                <span className="text-slate-400">
                  Authority Score: {Math.round(previewSource.authority_score * 100)}%
                </span>
                {previewSource.url && (
                  <a
                    href={previewSource.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-200"
                  >
                    <span>Open External</span>
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
