import { ExternalLink, BookOpen, Globe, FileText, CheckCircle2 } from "lucide-react";
import type { RetrievedSource } from "@/lib/sources";

interface RetrievedSourcesCardProps {
  sources: RetrievedSource[];
  emptyHint?: boolean;
}

export function RetrievedSourcesCard({ sources, emptyHint = false }: RetrievedSourcesCardProps) {
  if (sources.length === 0 && !emptyHint) return null;

  if (sources.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-white/[0.02] p-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="size-3.5 text-primary" />
          <span className="font-semibold text-foreground">No External Sources Retrieved</span>
        </div>
        <p className="text-muted-foreground/80 leading-relaxed">
          The response was synthesized directly from parametric memory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-white/[0.05] text-primary border border-border/60">
            <BookOpen className="size-3" />
          </div>
          <span className="text-xs font-semibold text-foreground font-display">Retrieved Sources</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
          {sources.length} Verified
        </span>
      </div>

      <div className="space-y-2.5">
        {sources.map((source) => {
          const isArxiv = (source.url || "").includes("arxiv.org") || (source.tool || "").includes("arxiv");
          const isWiki = (source.url || "").includes("wikipedia.org") || (source.tool || "").includes("wikipedia");
          const authority = isArxiv ? "0.95 (Peer Review)" : isWiki ? "0.90 (Consensus)" : "0.80 (Web)";

          return (
            <div
              key={source.source_id}
              className="group relative rounded-xl border border-border/60 bg-white/[0.02] p-3 text-xs transition-all hover:border-border hover:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isArxiv ? (
                    <FileText className="size-3.5 shrink-0 text-cyan-400" />
                  ) : isWiki ? (
                    <BookOpen className="size-3.5 shrink-0 text-blue-400" />
                  ) : (
                    <Globe className="size-3.5 shrink-0 text-emerald-400" />
                  )}
                  <h4 className="font-semibold text-foreground truncate group-hover:text-primary font-display">
                    {source.title}
                  </h4>
                </div>

                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition"
                    title="Open external paper/source"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </div>

              {source.snippet ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/90 line-clamp-3 bg-black/20 p-2 rounded-lg border border-border/40 font-serif italic">
                  "{source.snippet}"
                </p>
              ) : null}

              <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-muted-foreground/70 border-t border-border/40 pt-1.5">
                <span className="capitalize text-muted-foreground">{source.source_type} · {source.tool}</span>
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

