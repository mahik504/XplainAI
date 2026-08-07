import { motion } from "framer-motion";
import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

export type ConnectionState = "offline" | "connecting" | "live";

interface TopNavProps {
  title?: string;
  connection?: ConnectionState;
}

function HudCell({
  label,
  value,
  tone = "default",
  live,
}: {
  label: string;
  value: string;
  tone?: "default" | "live" | "warn" | "good";
  live?: boolean;
}) {
  return (
    <motion.div
      layout
      className="hud-chip group relative min-w-[4.75rem] px-3.5 py-2 transition-colors duration-300 hover:bg-white/[0.04]"
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate font-mono text-xs font-medium tabular-nums transition-colors duration-300",
          tone === "default" && "text-foreground/90",
          tone === "live" && "text-neon-emerald",
          tone === "warn" && "text-neon-amber",
          tone === "good" && "text-neon-cyan",
        )}
      >
        {live ? (
          <span className="mr-1.5 inline-block size-1.5 translate-y-[-1px] rounded-full bg-neon-emerald shadow-[0_0_10px_var(--neon-emerald)]" />
        ) : null}
        <motion.span
          key={value}
          initial={{ opacity: 0.35, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {value}
        </motion.span>
      </p>
    </motion.div>
  );
}

function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${String(Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function TopNav({ title = "Explainability OS", connection = "offline" }: TopNavProps) {
  const setMobileNavOpen = useUIStore((state) => state.setMobileNavOpen);
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen);

  const activeModel = useSessionStore((state) => state.activeModel);
  const defaultModel = useSessionStore((state) => state.defaultModel);
  const trustScore = useSessionStore((state) => state.trustScore);
  const firstTokenLatencyMs = useSessionStore((state) => state.firstTokenLatencyMs);
  const totalLatencyMs = useSessionStore((state) => state.totalLatencyMs);
  const tokenUsage = useSessionStore((state) => state.tokenUsage);
  const isStreaming = useSessionStore((state) => state.isStreaming);
  const storeConnection = useSessionStore((state) => state.connection);
  const providerName = useSessionStore((state) => state.providerName);

  const link = connection === "offline" ? storeConnection : connection;
  const latency = firstTokenLatencyMs ?? totalLatencyMs;
  const model = activeModel ?? defaultModel ?? "—";
  const tokens = tokenUsage !== null ? String(tokenUsage.total_tokens) : "—";

  return (
    <header className="relative z-20 shrink-0 px-3 pt-3 sm:px-4 sm:pt-3.5">
      <div className="hud-island flex min-h-14 items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-2.5 py-1.5 shadow-[0_18px_50px_-28px_oklch(0_0_0_/_80%),inset_0_1px_0_0_oklch(1_0_0_/_8%)] backdrop-blur-2xl sm:px-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => {
            setMobileNavOpen(true);
          }}
        >
          <span className="sr-only">Open navigation</span>
          <span className="block size-3.5 rounded-[2px] border border-foreground/70" />
        </Button>

        <div className="hidden min-w-0 pl-1 sm:block">
          <p className="truncate text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            XplainAI
          </p>
          <h1 className="truncate text-sm font-medium text-foreground">{title}</h1>
        </div>

        <div className="hud-strip ml-auto flex min-w-0 flex-1 items-stretch justify-end overflow-x-auto sm:ml-4">
          <div className="hud-panel flex items-stretch divide-x divide-white/[0.06] overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-[inset_0_1px_0_0_oklch(1_0_0_/_6%)] backdrop-blur-xl">
            <div aria-live="polite" className="sr-only">
              Connection {link}
              {isStreaming ? ", streaming" : ""}
            </div>
            <HudCell
              label="LIVE"
              value={link === "live" ? (isStreaming ? "STREAMING" : "ONLINE") : link.toUpperCase()}
              tone={link === "live" ? "live" : link === "connecting" ? "warn" : "default"}
              live={link === "live"}
            />
            <HudCell label="Model" value={model} tone="good" />
            <HudCell label="Latency" value={formatLatency(latency)} />
            <HudCell
              label="Structure"
              value={trustScore === null ? "—" : `${String(Math.round(trustScore * 100))}%`}
              tone={
                trustScore !== null && trustScore >= 0.75
                  ? "live"
                  : trustScore !== null && trustScore < 0.45
                    ? "warn"
                    : "default"
              }
            />
            <HudCell label="Tokens" value={tokens} />
            <HudCell
              label="Connection"
              value={
                link === "live"
                  ? providerName
                    ? `WS · ${providerName}`
                    : "WS READY"
                  : link.toUpperCase()
              }
              tone={link === "live" ? "good" : "warn"}
            />
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 transition-transform duration-300 hover:scale-105"
          onClick={() => {
            setSettingsOpen(true);
          }}
        >
          <Settings className="size-4" />
          <span className="sr-only">Open settings</span>
        </Button>
      </div>
    </header>
  );
}
