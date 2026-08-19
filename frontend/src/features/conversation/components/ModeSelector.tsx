import { Check, ChevronDown, Scale, Search, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { RUN_MODES, getRunModeMeta, type RunMode } from "@/lib/run-mode";
import { cn } from "@/lib/utils";

const ICONS = {
  zap: Zap,
  scale: Scale,
  search: Search,
} as const;

interface ModeSelectorProps {
  value: RunMode;
  onChange: (mode: RunMode) => void;
  disabled?: boolean;
}

export function ModeSelector({ value, onChange, disabled }: ModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeMeta = getRunModeMeta(value);
  const ActiveIcon = ICONS[activeMeta.icon];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Response mode: ${activeMeta.label}`}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border/55 bg-black/35 px-3 py-1.5 text-[11px] font-medium text-foreground/90 backdrop-blur-md transition",
          "hover:border-primary/35 hover:bg-white/[0.04]",
          "focus-visible:ring-[2px] focus-visible:ring-ring focus-visible:outline-none",
          disabled && "cursor-not-allowed opacity-40",
          open && "border-primary/40 bg-white/[0.05]",
        )}
      >
        <ActiveIcon className="size-3.5 text-primary/90" aria-hidden />
        <span>{activeMeta.label}</span>
        <span className="hidden text-muted-foreground sm:inline">· {activeMeta.description}</span>
        <ChevronDown
          className={cn("size-3.5 text-muted-foreground transition", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Response mode"
          className="absolute bottom-full left-0 z-40 mb-2 w-72 overflow-hidden rounded-xl border border-border/80 bg-[#161619] p-1 shadow-2xl"
        >
          {RUN_MODES.map((mode) => {
            const Icon = ICONS[mode.icon];
            const active = mode.id === value;
            return (
              <button
                key={mode.id}
                type="button"
                role="option"
                aria-selected={active}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                  active ? "bg-white/[0.08] text-foreground" : "hover:bg-white/[0.04] text-muted-foreground",
                )}
                onClick={() => {
                  onChange(mode.id);
                  setOpen(false);
                }}
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-3.5 shrink-0",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-foreground">{mode.label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground/80">
                    {mode.description}
                  </span>
                </span>
                {active ? <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
