import { Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ModelSelector } from "@/components/brand/ModelSelector";
import { XplainAiLogo } from "@/components/brand/XplainAiLogo";
import { Button } from "@/components/ui/button";
import { getRunModeMeta } from "@/lib/run-mode";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/stores/conversation-store";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

export type ConnectionState = "offline" | "connecting" | "live";

interface TopNavProps {
  connection?: ConnectionState;
}

function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${String(Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function TopNav({ connection = "offline" }: TopNavProps) {
  const [brandOpen, setBrandOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  const setMobileNavOpen = useUIStore((state) => state.setMobileNavOpen);
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen);

  const activeModel = useSessionStore((state) => state.activeModel);
  const defaultModel = useSessionStore((state) => state.defaultModel);
  const firstTokenLatencyMs = useSessionStore((state) => state.firstTokenLatencyMs);
  const totalLatencyMs = useSessionStore((state) => state.totalLatencyMs);
  const tokenUsage = useSessionStore((state) => state.tokenUsage);
  const isStreaming = useSessionStore((state) => state.isStreaming);
  const storeConnection = useSessionStore((state) => state.connection);
  const providerName = useSessionStore((state) => state.providerName);
  const runMode = useSessionStore((state) => state.runMode);
  const phase = useSessionStore((state) => state.phase);

  const conversations = useConversationStore((state) => state.conversations);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const newChat = useConversationStore((state) => state.newChat);

  const link = connection === "offline" ? storeConnection : connection;
  const latency = firstTokenLatencyMs ?? totalLatencyMs;
  const modeMeta = getRunModeMeta(runMode);
  const conversationTitle =
    conversations.find((item) => item.id === activeConversationId)?.title ?? "New conversation";
  const hasRunMetrics =
    totalLatencyMs != null || firstTokenLatencyMs != null || tokenUsage != null;
  const showRunChip =
    isStreaming ||
    (hasRunMetrics &&
      (phase === "finished" || phase === "failed" || phase === "cancelled"));

  useEffect(() => {
    if (!brandOpen && !detailsOpen) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (brandOpen && !brandRef.current?.contains(target)) setBrandOpen(false);
      if (detailsOpen && !detailsRef.current?.contains(target)) setDetailsOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("mousedown", onPointer);
    };
  }, [brandOpen, detailsOpen]);

  return (
    <header className="relative z-30 shrink-0 border-b border-rose-950/60 bg-[#0B0409]/80 px-3 py-2.5 backdrop-blur-2xl sm:px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="xl:hidden text-zinc-400 hover:text-zinc-100"
          onClick={() => {
            setMobileNavOpen(true);
          }}
        >
          <span className="sr-only">Open history</span>
          <span className="block size-3.5 rounded-[2px] border border-foreground/70" />
        </Button>

        <div ref={brandRef} className="relative">
          <button
            type="button"
            className="group flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition hover:bg-white/[0.04] active:scale-95"
            onClick={() => {
              setBrandOpen((value) => !value);
            }}
            aria-haspopup="menu"
            aria-expanded={brandOpen}
          >
            <XplainAiLogo size={32} className="group-hover:drop-shadow-[0_0_14px_rgba(225,29,72,0.6)]" />
            <span className="text-left">
              <span className="block font-display text-[15px] font-semibold tracking-tight text-foreground">
                XplainAI
              </span>
              <span className="hidden text-[10px] font-mono tracking-wider text-rose-300/80 sm:block uppercase">
                Autonomous Research OS
              </span>
            </span>
            <span
              className={cn(
                "ml-1 size-1.5 rounded-full",
                link === "live"
                  ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                  : link === "connecting"
                    ? "bg-amber-500"
                    : "bg-muted-foreground/50",
              )}
              title={link}
            />
          </button>

          {brandOpen ? (
            <div
              role="menu"
              className="absolute top-full left-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-rose-900/40 bg-[#130610]/95 py-1 shadow-[0_20px_48px_-28px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-white/[0.05]"
                onClick={() => {
                  setBrandOpen(false);
                  void newChat();
                }}
              >
                New chat
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-white/[0.05]"
                onClick={() => {
                  setBrandOpen(false);
                  setSettingsOpen(true);
                }}
              >
                Settings
              </button>
              <p className="border-t border-border/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Observable structure — not hidden chain-of-thought or factual verification.
              </p>
            </div>
          ) : null}
        </div>

        <div className="mx-auto hidden min-w-0 max-w-md flex-1 text-center md:block">
          <p className="truncate text-sm font-medium text-foreground/90">{conversationTitle}</p>
          <p className="truncate text-[11px] text-muted-foreground">{modeMeta.label}</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {showRunChip ? (
            <div ref={detailsRef} className="relative hidden sm:block">
              <button
                type="button"
                className="rounded-full border border-border/50 bg-white/[0.03] px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
                onClick={() => {
                  setDetailsOpen((value) => !value);
                }}
              >
                {isStreaming
                  ? `Streaming · ${formatLatency(latency)}`
                  : `${formatLatency(totalLatencyMs ?? latency)} · ${tokenUsage ? String(tokenUsage.total_tokens) : "—"} tok`}
              </button>
              {detailsOpen ? (
                <div className="absolute top-full right-0 z-50 mt-2 w-56 rounded-xl border border-border/60 bg-[#12121A]/96 p-3 text-xs shadow-xl backdrop-blur-xl">
                  <dl className="space-y-1.5 text-muted-foreground">
                    <div className="flex justify-between gap-3">
                      <dt>Model</dt>
                      <dd className="text-foreground">{activeModel ?? defaultModel ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Latency</dt>
                      <dd className="text-foreground">{formatLatency(totalLatencyMs ?? latency)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Tokens</dt>
                      <dd className="text-foreground">
                        {tokenUsage ? String(tokenUsage.total_tokens) : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Mode</dt>
                      <dd className="text-foreground">{modeMeta.label}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Connection</dt>
                      <dd className="text-foreground">
                        {link === "live"
                          ? providerName
                            ? `WS · ${providerName}`
                            : "WS"
                          : link}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </div>
          ) : null}

          <ModelSelector />

          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={() => {
              setSettingsOpen(true);
            }}
          >
            <Settings className="size-4" />
            <span className="sr-only">Open settings</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
