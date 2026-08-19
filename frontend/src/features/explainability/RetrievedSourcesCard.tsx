import { ExternalLink, BookOpen, Globe, FileText, CheckCircle2 } from "lucide-react";
import type { RetrievedSource } from "@/lib/sources";
import { Badge } from "@/components/ui/badge";

interface RetrievedSourcesCardProps {
  sources: RetrievedSource[];
  emptyHint?: boolean;
}

export function RetrievedSourcesCard({ sources, emptyHint = false }: RetrievedSourcesCardProps) {
  if (sources.length === 0 && !emptyHint) return null;

  if (sources.length === 0) {
    return (
      <div className="rounded-xl border border-rose-950/80 bg-[#12050E]/40 p-4 text-xs text-zinc-400">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="size-3.5 text-rose-400" />
          <span className="font-semibold text-zinc-300">No External Sources Retrieved</span>
        </div>
        <p className="text-zinc-500 leading-relaxed">
          The response was synthesized directly or research tools returned no usable metadata.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <BookOpen className="size-3" />
          </div>
          <span className="text-xs font-semibold text-zinc-100 font-display">Grounded Research Dossier</span>
        </div>
        <Badge variant="emerald" className="text-[10px] font-mono px-1.5 py-0 border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
          {sources.length} Verified
        </Badge>
      </div>

      <div className="space-y-2.5">
        {sources.map((source) => {
          const isArxiv = (source.url || "").includes("arxiv.org") || (source.tool || "").includes("arxiv");
          const isWiki = (source.url || "").includes("wikipedia.org") || (source.tool || "").includes("wikipedia");
          const authority = isArxiv ? "0.95 (Peer Review)" : isWiki ? "0.90 (Consensus)" : "0.80 (Web)";

          return (
            <div
              key={source.source_id}
              className="group relative rounded-xl border border-rose-950/70 bg-[#12050E]/60 p-3 text-xs transition-all hover:border-rose-500/40 hover:bg-[#180814]/80 shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isArxiv ? (
                    <FileText className="size-3.5 shrink-0 text-cyan-400" />
                  ) : isWiki ? (
                    <BookOpen className="size-3.5 shrink-0 text-rose-400" />
                  ) : (
                    <Globe className="size-3.5 shrink-0 text-emerald-400" />
                  )}
                  <h4 className="font-semibold text-zinc-200 truncate group-hover:text-rose-300 font-display">
                    {source.title}
                  </h4>
                </div>

                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="shrink-0 p-1 text-zinc-500 hover:text-rose-400 transition"
                    title="Open external paper/source"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </div>

              {source.snippet ? (
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-300 line-clamp-3 bg-[#080206]/80 p-2 rounded-lg border border-rose-950/60 font-serif italic">
                  "{source.snippet}"
                </p>
              ) : null}

              <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-rose-950/40 pt-1.5">
                <span className="capitalize text-zinc-400">{source.source_type} ? {source.tool}</span>
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="size-2.5" />
                  Auth: {authority}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
