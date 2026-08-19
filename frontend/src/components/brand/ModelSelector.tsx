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
          "inline-flex items-center gap-2 rounded-lg border border-border/60 bg-white/[0.03] px-2.5 py-1.5 text-left text-xs transition",
          "hover:border-primary/40 hover:bg-white/[0.06]",
          "focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span className="flex size-2 rounded-full bg-primary" />
        <span className="min-w-0 truncate font-medium text-foreground">{selected.label}</span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Select Intelligence Model"
          className="absolute top-full right-0 z-50 mt-1.5 w-[19rem] overflow-hidden rounded-xl border border-border/80 bg-[#161619] shadow-2xl"
        >
          <div className="max-h-80 overflow-y-auto p-1.5 scrollbar-slim">
            {Object.entries(groupedModels).map(([providerName, models]) => {
              if (models.length === 0) return null;
              return (
                <div key={providerName} className="mb-2 last:mb-0">
                  <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
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
                              ? "bg-white/[0.08] text-foreground"
                              : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                          )}
                          onClick={() => {
                            setActiveModel(model.id);
                            setOpen(false);
                          }}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-foreground">{model.label}</span>
                              {model.tier === "fast" ? (
                                <span className="rounded bg-emerald-500/10 px-1 py-0.2 text-[9px] font-medium text-emerald-400">
                                  Fast
                                </span>
                              ) : model.tier === "advanced" ? (
                                <span className="rounded bg-blue-500/10 px-1 py-0.2 text-[9px] font-medium text-blue-400">
                                  Reasoning
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
                              {model.description}
                            </p>
                          </div>
                          {active ? <Check className="mt-0.5 size-3.5 shrink-0 text-primary" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border/40 p-1.5">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
              onClick={() => {
                setOpen(false);
                setSettingsOpen(true);
              }}
            >
              <Sliders className="size-3.5 text-primary" />
              <span>Custom Model & API Keys…</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

