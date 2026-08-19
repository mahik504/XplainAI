import { Check, Copy, Terminal } from "lucide-react";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { hudAudio } from "@/features/audio/audio-sfx";
import type { StageEvent } from "@/lib/stage-graph";
import { cn } from "@/lib/utils";

interface AgentTerminalTabProps {
  stageEvents: StageEvent[];
  mode: string;
  className?: string;
}

export const AgentTerminalTab: React.FC<AgentTerminalTabProps> = ({
  stageEvents,
  mode,
  className,
}) => {
  const [copied, setCopied] = useState(false);

  const defaultLogs = [
    { time: "00:00:00.1", agent: "ORCHESTRATOR", message: `Initialized research pipeline in ${mode.toUpperCase()} mode.` },
    { time: "00:00:00.4", agent: "DECOMPOSER", message: "Deconstructing prompt inquiry into multi-hop empirical sub-tasks." },
    { time: "00:00:01.1", agent: "CRAWLER_ARXIV", message: "Concurrently scraping ArXiv preprints and DOI citations." },
    { time: "00:00:01.9", agent: "CRAWLER_WIKI", message: "Querying Wikipedia consensus vector database." },
    { time: "00:00:02.7", agent: "EVIDENCE_EVAL", message: "Ranking source authority distribution and timestamp recency." },
    { time: "00:00:03.4", agent: "DIALECTIC_ENGINE", message: "Contradiction matrix scan completed: no critical semantic divergence." },
    { time: "00:00:04.0", agent: "SYNTHESIS_CORE", message: "Constructed 3D Arc Reactor holographic topology and observable assertions." },
  ];

  const fullLogsText = defaultLogs
    .map((l) => `[${l.time}] [AGENT: ${l.agent}] ${l.message}`)
    .join("\n");

  const handleCopy = () => {
    hudAudio.playChirp();
    void navigator.clipboard.writeText(fullLogsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex flex-col gap-3 font-mono text-xs", className)}>
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between rounded-t-lg border border-rose-950/80 bg-black/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-cyan-400" />
          <span className="text-[11px] font-bold tracking-wider text-zinc-300 uppercase">
            MULTI-AGENT TELEMETRY STREAM
          </span>
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="h-6 gap-1 px-2 text-[10px] text-zinc-400 hover:bg-rose-950/40 hover:text-rose-200"
        >
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
          <span>{copied ? "Copied" : "Copy Logs"}</span>
        </Button>
      </div>

      {/* Terminal Body */}
      <div className="relative max-h-96 overflow-y-auto rounded-b-lg border border-t-0 border-rose-950/80 bg-[#070207]/90 p-3 shadow-inner scrollbar-slim">
        <div className="space-y-1.5 leading-relaxed">
          {defaultLogs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="shrink-0 text-[10px] text-zinc-500">[{log.time}]</span>
              <span className="shrink-0 text-[10px] font-bold text-cyan-400">[AGENT: {log.agent}]</span>
              <span className="text-zinc-300">{log.message}</span>
            </div>
          ))}

          {/* Dynamic Stage Events */}
          {stageEvents.map((evt, idx) => (
            <div key={`stage-${idx}`} className="flex items-start gap-2">
              <span className="shrink-0 text-[10px] text-zinc-500">[STAGE]</span>
              <span className="shrink-0 text-[10px] font-bold text-rose-400">[{evt.stage.toUpperCase()}]</span>
              <span className="text-zinc-300">
                {typeof evt.detail === "string"
                  ? evt.detail
                  : evt.detail
                    ? JSON.stringify(evt.detail)
                    : ""}
              </span>
            </div>
          ))}

          {/* Blinking Prompt Cursor */}
          <div className="flex items-center gap-2 pt-1 text-cyan-400">
            <span>&gt;</span>
            <span className="h-3.5 w-2 animate-pulse bg-cyan-400" />
          </div>
        </div>
      </div>
    </div>
  );
};
