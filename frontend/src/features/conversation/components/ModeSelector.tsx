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
            ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
            : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200",
          disabled && "cursor-not-allowed opacity-40",
        )}
      >
        <ActiveIcon className="size-3.5 text-cyan-400" aria-hidden />
        <span className="font-semibold text-white">{activeMeta.label}</span>
        <span className="text-[10px] text-slate-400 hidden sm:inline">· {activeMeta.description}</span>
        <ChevronDown
          className={cn("size-3 text-slate-400 transition-transform duration-150", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Select response mode"
          className="absolute bottom-full left-0 z-50 mb-1.5 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#0a0f1d]/95 p-1 shadow-2xl backdrop-blur-2xl font-mono text-xs"
        >
          {RUN_MODES.map((mode) => {
            const Icon = ICONS[mode.icon];
            const isSelected = mode.id === value;

            return (
              <button
                key={mode.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(mode.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  isSelected
                    ? "bg-cyan-500/20 text-cyan-100 border border-cyan-500/30"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    isSelected ? "text-cyan-400" : "text-slate-500",
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{mode.label}</span>
                    {isSelected ? <Check className="size-3.5 text-cyan-400" /> : null}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400 font-sans">
                    {mode.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
