import { memo, useState } from "react";

import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "assertion", label: "Assertion", tone: "bg-neon-cyan" },
  { key: "evidence", label: "Evidence marker", tone: "bg-neon-emerald" },
  { key: "uncertainty", label: "Uncertainty", tone: "bg-neon-amber" },
  { key: "connector", label: "Connector", tone: "bg-neon-violet" },
] as const;

export const StructureLegend = memo(function StructureLegend({
  className,
  compact = false,
}: {
  className?: string;
  /** Compact collapsible control for the explainability panel */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (compact) {
    return (
      <div className={cn("mt-2", className)}>
        <button
          type="button"
          className="rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
          aria-expanded={open}
          onClick={() => {
            setOpen((value) => !value);
          }}
        >
          {open ? "Hide legend" : "Structure legend"}
        </button>
        {open ? (
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 px-1">
            {ITEMS.map((item) => (
              <li key={item.key} className="flex items-center gap-1.5 text-[10px] text-foreground/85">
                <span className={cn("size-1.5 shrink-0 rounded-full", item.tone)} />
                {item.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute right-3 bottom-3 z-20 rounded-xl border border-border/60 bg-black/45 px-2.5 py-2 shadow-lg backdrop-blur-xl",
        className,
      )}
    >
      <p className="mb-1.5 text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
        Structure legend
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 sm:flex-col sm:gap-1">
        {ITEMS.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-[10px] text-foreground/85">
            <span className={cn("size-1.5 shrink-0 rounded-full", item.tone)} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
});
