import { Check, ChevronDown, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ChatModelInfo } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

export function ModelSelector({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const availableModels = useSessionStore((state) => state.availableModels);
  const activeModel = useSessionStore((state) => state.activeModel);
  const defaultModel = useSessionStore((state) => state.defaultModel);
  const setActiveModel = useSessionStore((state) => state.setActiveModel);
  const isStreaming = useSessionStore((state) => state.isStreaming);

  const selectedId = activeModel ?? defaultModel;
  const selected =
    availableModels.find((model) => model.id === selectedId) ??
    (selectedId
      ? ({
          id: selectedId,
          label: selectedId,
          description: "Active model",
          tier: "general",
        } satisfies ChatModelInfo)
      : null);

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

  if (!selected) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>Model loading…</span>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={isStreaming}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className={cn(
          "inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-border/60 bg-white/[0.03] px-3 py-1.5 text-left text-xs transition",
          "hover:border-primary/35 hover:bg-white/[0.05]",
          "focus-visible:ring-[2px] focus-visible:ring-ring focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-45",
        )}
      >
        <Sparkles className="size-3.5 shrink-0 text-primary/80" aria-hidden />
        <span className="min-w-0 truncate font-medium text-foreground">{selected.label}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Chat model"
          className="absolute top-full right-0 z-50 mt-2 w-[17rem] overflow-hidden rounded-xl border border-border/60 bg-[#12121A]/95 py-1 shadow-[0_20px_48px_-28px_oklch(0_0_0_/_80%)] backdrop-blur-xl"
        >
          {availableModels.map((model) => {
            const active = model.id === selected.id;
            return (
              <li key={model.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2.5 text-left transition hover:bg-white/[0.05]",
                    active && "bg-white/[0.04]",
                  )}
                  onClick={() => {
                    setActiveModel(model.id);
                    setOpen(false);
                  }}
                >
                  <span className="mt-0.5 grid size-4 place-items-center">
                    {active ? <Check className="size-3.5 text-primary" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{model.label}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {model.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
