import { AlertTriangle } from "lucide-react";

export interface MissingContextItem {
  item: string;
  importance: string;
  why_it_matters: string;
}

interface MissingContextCardProps {
  items: MissingContextItem[];
}

export function MissingContextCard({ items }: MissingContextCardProps) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-neon-amber/30 bg-neon-amber/5 px-3 py-3">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="size-3.5 text-neon-amber" aria-hidden />
        <h3 className="text-[11px] tracking-[0.14em] text-neon-amber uppercase">
          Potential missing context
        </h3>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.item} className="text-xs leading-relaxed">
            <p className="font-medium text-foreground">
              <span className="mr-1.5 text-neon-amber">⚠</span>
              {item.item}
              <span className="ml-1.5 text-[10px] tracking-wide text-muted-foreground uppercase">
                {item.importance}
              </span>
            </p>
            <p className="mt-0.5 text-muted-foreground">{item.why_it_matters}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
