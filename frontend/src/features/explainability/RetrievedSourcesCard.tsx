import { Link2 } from "lucide-react";

import type { RetrievedSource } from "@/lib/sources";

interface RetrievedSourcesCardProps {
  sources: RetrievedSource[];
  /** When research tools ran but returned no usable metadata. */
  emptyHint?: boolean;
}

export function RetrievedSourcesCard({ sources, emptyHint = false }: RetrievedSourcesCardProps) {
  if (sources.length === 0 && !emptyHint) return null;

  if (sources.length === 0) {
    return (
      <section className="rounded-xl border border-border/50 bg-white/[0.02] px-3 py-3">
        <div className="mb-1.5 flex items-center gap-2">
          <Link2 className="size-3.5 text-muted-foreground" aria-hidden />
          <h3 className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            Retrieved sources
          </h3>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Research tools ran, but no usable source metadata was returned. Response-text evidence
          markers are separate and are not treated as citations.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border/50 bg-white/[0.03] px-3 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Link2 className="size-3.5 text-neon-emerald" aria-hidden />
        <h3 className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          Retrieved sources
        </h3>
        <span className="text-[10px] text-muted-foreground">{sources.length}</span>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Retrieved by tools — not automatic proof of a claim.
      </p>
      <ul className="space-y-2">
        {sources.slice(0, 6).map((source) => (
          <li key={source.source_id} className="text-xs">
            <p className="font-medium text-foreground">{source.title}</p>
            <p className="text-[10px] text-muted-foreground">
              {source.source_type} · {source.tool}
            </p>
            {source.snippet ? (
              <p className="mt-0.5 line-clamp-2 text-muted-foreground">{source.snippet}</p>
            ) : null}
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-0.5 inline-block text-[11px] text-primary underline decoration-primary/30"
              >
                Open source
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
