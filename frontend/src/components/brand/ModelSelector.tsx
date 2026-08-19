import { Check, ChevronDown, Sliders } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ChatModelInfo } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

export function ModelSelector({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const availableModels = useSessionStore((state) => state.availableModels);
  const activeModel = useSessionStore((state) => state.activeModel);
  const defaultModel = useSessionStore((state) => state.defaultModel);
  const setActiveModel = useSessionStore((state) => state.setActiveModel);
  const isStreaming = useSessionStore((state) => state.isStreaming);
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen);

  const selectedId = activeModel ?? defaultModel;
  const selected =
    availableModels.find((model) => model.id === selectedId) ??
    (selectedId
      ? ({
          id: selectedId,
          label: selectedId,
          description: "Active model",
          tier: "general",
          provider: "custom",
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

  // Group models by provider
  const groupedModels = useMemo(() => {
    const groups: {
      OpenAI: ChatModelInfo[];
      Anthropic: ChatModelInfo[];
      Google: ChatModelInfo[];
      Custom: ChatModelInfo[];
    } = {
      OpenAI: [],
      Anthropic: [],
      Google: [],
      Custom: [],
    };
    for (const model of availableModels) {
      const provider = model.provider?.toLowerCase();
      if (provider === "anthropic" || model.id.includes("claude")) {
        groups.Anthropic.push(model);
      } else if (provider === "google" || model.id.includes("gemini")) {
        groups.Google.push(model);
      } else if (provider === "custom" || model.id.startsWith("custom:") || model.id.startsWith("local:")) {
        groups.Custom.push(model);
      } else {
        groups.OpenAI.push(model);
      }
    }
    return groups;
  }, [availableModels]);

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
          "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-mono transition",
          open
            ? "border-rose-500/60 bg-rose-500/15 text-rose-200 shadow-[0_0_12px_rgba(225,29,72,0.2)]"
            : "border-rose-950/70 bg-[#12040f]/80 text-zinc-300 hover:border-rose-500/40 hover:bg-rose-950/30 hover:text-rose-200",
          "focus-visible:ring-1 focus-visible:ring-rose-500 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span className="flex size-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.9)]" />
        <span className="min-w-0 truncate font-semibold text-foreground">{selected.label}</span>
        <ChevronDown className={cn("size-3 shrink-0 text-zinc-400 transition", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Select Intelligence Model"
          className="absolute top-full right-0 z-50 mt-1.5 w-[19rem] overflow-hidden rounded-xl border border-rose-950/90 bg-[#120510]/95 shadow-2xl backdrop-blur-2xl font-mono"
        >
          <div className="max-h-80 overflow-y-auto p-1.5 scrollbar-slim">
            {Object.entries(groupedModels).map(([providerName, models]) => {
              if (models.length === 0) return null;
              return (
                <div key={providerName} className="mb-2 last:mb-0">
                  <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                    {providerName}
                  </div>
                  <div className="space-y-0.5">
                    {models.map((model) => {
                      const active = model.id === selected.id;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={cn(
                            "flex w-full items-start justify-between rounded-lg px-2.5 py-2 text-left transition-colors",
                            active
                              ? "bg-rose-500/20 text-rose-100 border border-rose-500/30"
                              : "text-zinc-400 hover:bg-rose-950/30 hover:text-rose-200",
                          )}
                          onClick={() => {
                            setActiveModel(model.id);
                            setOpen(false);
                          }}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-foreground">{model.label}</span>
                              {model.tier === "fast" ? (
                                <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.2 text-[9px] font-medium text-emerald-300">
                                  Fast
                                </span>
                              ) : model.tier === "advanced" ? (
                                <span className="rounded bg-rose-500/15 border border-rose-500/30 px-1 py-0.2 text-[9px] font-medium text-rose-300">
                                  Reasoning
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-zinc-400 font-sans">
                              {model.description}
                            </p>
                          </div>
                          {active ? <Check className="mt-0.5 size-3.5 shrink-0 text-rose-400" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-rose-950/60 p-1.5">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-400 transition hover:bg-rose-950/40 hover:text-rose-200"
              onClick={() => {
                setOpen(false);
                setSettingsOpen(true);
              }}
            >
              <Sliders className="size-3.5 text-rose-400" />
              <span>Custom Model & API Keys…</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

