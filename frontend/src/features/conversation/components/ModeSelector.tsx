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
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-mono transition backdrop-blur-md",
          open
            ? "border-rose-500/60 bg-rose-500/15 text-rose-300 shadow-[0_0_12px_rgba(225,29,72,0.3)]"
            : "border-rose-950/70 bg-rose-950/30 text-zinc-300 hover:border-rose-500/40 hover:bg-rose-950/50 hover:text-rose-200",
          disabled && "cursor-not-allowed opacity-40",
        )}
      >
        <ActiveIcon className="size-3.5 text-rose-400" aria-hidden />
        <span className="font-semibold text-rose-200">{activeMeta.label}</span>
        <span className="hidden text-zinc-400 sm:inline">· {activeMeta.description}</span>
        <ChevronDown
          className={cn("size-3 text-zinc-400 transition", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Response mode"
          className="absolute bottom-full left-0 z-40 mb-2 w-72 overflow-hidden rounded-xl border border-rose-950/90 bg-[#120510]/95 p-1.5 shadow-2xl backdrop-blur-2xl"
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
                  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition font-mono",
                  active
                    ? "bg-rose-500/20 text-rose-100 border border-rose-500/30 shadow-sm"
                    : "hover:bg-rose-950/40 text-zinc-400 hover:text-rose-200",
                )}
                onClick={() => {
                  onChange(mode.id);
                  setOpen(false);
                }}
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-3.5 shrink-0",
                    active ? "text-rose-400" : "text-zinc-500",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-foreground">{mode.label}</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-400">
                    {mode.description}
                  </span>
                </span>
                {active ? <Check className="mt-0.5 size-3.5 shrink-0 text-rose-400" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
