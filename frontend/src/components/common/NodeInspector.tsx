import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ScanSearch, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  buildClaimFocusMetrics,
  resolveClaimFocus,
} from "@/lib/claim-focus";
import {
  buildResponseStructureGraph,
  isStructureNodeData,
  type StructureNodeData,
} from "@/lib/response-graph";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";
import type { GraphSurface } from "@/stores/ui-store";
import { useUIStore } from "@/stores/ui-store";

function formatLatency(ms: number | null): string {
  if (ms === null) return "Awaiting measurement";
  if (ms < 1000) return `${String(Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function InspectorSection({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`inspector-${id}`}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left outline-none transition hover:bg-white/[0.03] focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <span className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-300",
            open && "rotate-180 text-neon-cyan",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={`inspector-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 text-sm leading-relaxed text-foreground/90">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function StructureInspectorBody({
  node,
  analysisScore,
}: {
  node: StructureNodeData;
  analysisScore: {
    sentenceCount: number;
    hedgeCount: number;
    evidenceCount: number;
    reasoningDepth: number;
  };
}) {
  const [open, setOpen] = useState({
    segments: true,
    counts: true,
    examples: true,
  });

  return (
    <>
      <InspectorSection
        id="segments"
        title="Detected segments"
        open={open.segments}
        onToggle={() => {
          setOpen((prev) => ({ ...prev, segments: !prev.segments }));
        }}
      >
        <p className="text-foreground/90">
          {node.label} · {node.subtitle}
        </p>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          Count · {String(node.count)}
        </p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          Match confidence · {String(Math.round(node.confidence * 100))}%
        </p>
      </InspectorSection>

      <InspectorSection
        id="counts"
        title="Counts"
        open={open.counts}
        onToggle={() => {
          setOpen((prev) => ({ ...prev, counts: !prev.counts }));
        }}
      >
        <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
          <li>Node segments · {String(node.count)}</li>
          <li>Evidence markers · {String(analysisScore.evidenceCount)}</li>
          <li>Hedge count · {String(analysisScore.hedgeCount)}</li>
          <li>Sentences analyzed · {String(analysisScore.sentenceCount)}</li>
          <li>Structural depth · {analysisScore.reasoningDepth.toFixed(2)}</li>
        </ul>
      </InspectorSection>

      <InspectorSection
        id="examples"
        title="Top examples"
        open={open.examples}
        onToggle={() => {
          setOpen((prev) => ({ ...prev, examples: !prev.examples }));
        }}
      >
        {node.samples.length === 0 ? (
          <p className="text-muted-foreground">No sample segments for this node.</p>
        ) : (
          <ul className="space-y-2">
            {node.samples.map((sample, index) => (
              <li
                key={`${String(index)}-${sample.slice(0, 32)}`}
                className="rounded-md border border-border/50 bg-black/20 px-2 py-1.5 text-xs leading-relaxed text-foreground/85"
              >
                {sample}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[10px] text-muted-foreground">
          Observable response structure only — not model chain-of-thought.
        </p>
      </InspectorSection>
    </>
  );
}

function ClaimFocusInspectorBody({
  assertionId,
}: {
  assertionId: string;
}) {
  const responseAnalysis = useSessionStore((state) => state.responseAnalysis);
  const sourcesRetrieved = useSessionStore((state) => state.sourcesRetrieved);
  const resolved = useMemo(() => {
    if (!responseAnalysis) return null;
    return resolveClaimFocus(responseAnalysis, assertionId);
  }, [assertionId, responseAnalysis]);
  const metrics = useMemo(() => {
    if (!responseAnalysis) return null;
    return buildClaimFocusMetrics(responseAnalysis, assertionId, {
      retrievedSourcesCount: sourcesRetrieved,
    });
  }, [assertionId, responseAnalysis, sourcesRetrieved]);

  const [open, setOpen] = useState({
    assertion: true,
    evidence: true,
    uncertainty: true,
    support: true,
  });

  if (!resolved || !metrics) {
    return <p className="px-3 py-3 text-sm text-muted-foreground">No focused assertion.</p>;
  }

  return (
    <>
      <InspectorSection
        id="assertion"
        title="Focused Assertion"
        open={open.assertion}
        onToggle={() => {
          setOpen((prev) => ({ ...prev, assertion: !prev.assertion }));
        }}
      >
        <p className="text-foreground/90">{resolved.assertion.text}</p>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          Structure match · {String(Math.round(metrics.detectionConfidence * 100))}%
        </p>
      </InspectorSection>

      <InspectorSection
        id="evidence"
        title="Detected evidence"
        open={open.evidence}
        onToggle={() => {
          setOpen((prev) => ({ ...prev, evidence: !prev.evidence }));
        }}
      >
        {resolved.evidence.length === 0 ? (
          <p className="text-neon-amber">No supporting evidence detected</p>
        ) : (
          <ul className="space-y-2">
            {resolved.evidence.map((sentence, index) => (
              <li
                key={`${String(index)}-${String(sentence.start)}`}
                className="rounded-md border border-neon-emerald/25 bg-neon-emerald/8 px-2 py-1.5 text-xs leading-relaxed"
              >
                {sentence.text}
              </li>
            ))}
          </ul>
        )}
      </InspectorSection>

      <InspectorSection
        id="uncertainty"
        title="Nearby uncertainty"
        open={open.uncertainty}
        onToggle={() => {
          setOpen((prev) => ({ ...prev, uncertainty: !prev.uncertainty }));
        }}
      >
        {resolved.nearbyUncertainty.length === 0 ? (
          <p className="text-muted-foreground">No nearby uncertainty signals.</p>
        ) : (
          <ul className="space-y-2">
            {resolved.nearbyUncertainty.map((sentence, index) => (
              <li
                key={`${String(index)}-${String(sentence.start)}`}
                className="rounded-md border border-neon-amber/25 bg-neon-amber/8 px-2 py-1.5 text-xs leading-relaxed"
              >
                {sentence.text}
              </li>
            ))}
          </ul>
        )}
      </InspectorSection>

      <InspectorSection
        id="support"
        title="Supporting sentences"
        open={open.support}
        onToggle={() => {
          setOpen((prev) => ({ ...prev, support: !prev.support }));
        }}
      >
        <p className="font-mono text-[11px] text-muted-foreground">
          Support level · {String(Math.round(metrics.supportLevel * 100))}%
        </p>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Linked by proximity in finished response text — not model chain-of-thought.
        </p>
      </InspectorSection>
    </>
  );
}

export function NodeInspector({
  className,
  graphSurface = "pipeline",
}: {
  className?: string;
  graphSurface?: GraphSurface;
}) {
  const selectedNodeId = useSessionStore((state) => state.selectedNodeId);
  const phase = useSessionStore((state) => state.phase);
  const activeModel = useSessionStore((state) => state.activeModel);
  const trustScore = useSessionStore((state) => state.trustScore);
  const firstTokenLatencyMs = useSessionStore((state) => state.firstTokenLatencyMs);
  const totalLatencyMs = useSessionStore((state) => state.totalLatencyMs);
  const streamedChars = useSessionStore((state) => state.streamedChars);
  const tokenUsage = useSessionStore((state) => state.tokenUsage);
  const messages = useSessionStore((state) => state.messages);
  const lastError = useSessionStore((state) => state.lastError);
  const lastErrorCode = useSessionStore((state) => state.lastErrorCode);
  const finishReason = useSessionStore((state) => state.finishReason);
  const isStreaming = useSessionStore((state) => state.isStreaming);
  const responseAnalysis = useSessionStore((state) => state.responseAnalysis);
  const setSelectedNodeId = useSessionStore((state) => state.setSelectedNodeId);
  const focusedAssertionId = useUIStore((state) => state.focusedAssertionId);
  const exitClaimFocus = useUIStore((state) => state.exitClaimFocus);

  const outputRef = useRef<HTMLDivElement>(null);
  const [openSections, setOpenSections] = useState({
    reasoning: true,
    evidence: true,
    confidence: true,
    structure: true,
    output: true,
  });

  const structureNode = useMemo((): StructureNodeData | null => {
    if (!selectedNodeId?.startsWith("structure-") || !responseAnalysis) return null;
    const graph = buildResponseStructureGraph(responseAnalysis);
    const match = graph.nodes.find((node) => node.id === selectedNodeId);
    if (!match || !isStructureNodeData(match.data)) return null;
    return match.data;
  }, [responseAnalysis, selectedNodeId]);

  useEffect(() => {
    const el = outputRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, selectedNodeId, isStreaming]);

  if ((!selectedNodeId && !focusedAssertionId) || phase === "idle") {
    return null;
  }

  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const latestUser = [...messages].reverse().find((message) => message.role === "user");
  const score = responseAnalysis?.score;
  const claimFocusMode = focusedAssertionId !== null;
  const structureModeNode =
    !claimFocusMode && graphSurface === "structure" && structureNode ? structureNode : null;

  const reasoningByNode: Record<string, string> = {
    input: latestUser?.content
      ? `Accepted user turn: ${latestUser.content.slice(0, 140)}`
      : "Waiting for input.",
    model: activeModel
      ? `Routing generation through ${activeModel}.`
      : "Model not resolved yet.",
    stream: isStreaming
      ? streamedChars > 0
        ? `Streaming in progress (${String(streamedChars)} characters). Structure analysis runs after finish.`
        : "Stream channel open, awaiting first token."
      : score
        ? `Response structure: ${String(score.reasoningCount)} reasoning cues · ${String(score.claimCount)} claims · hedging ${(score.hedgingRatio * 100).toFixed(0)}%.`
        : "No finished response structure yet.",
    output: score
      ? `Finished response anatomy — evidence ${String(score.evidenceCount)}, examples ${String(score.exampleCount)}, conclusions ${String(score.conclusionCount)}.`
      : latestAssistant?.content
        ? "Final assistant payload ready; awaiting structure analysis."
        : "Output buffer empty.",
  };

  const evidence =
    score !== undefined
      ? `Structure evidence score ${String(Math.round(score.evidenceScore * 100))}% · ${String(score.evidenceCount)} evidence sentences`
      : tokenUsage !== null
        ? `${String(tokenUsage.prompt_tokens)} prompt · ${String(tokenUsage.completion_tokens)} completion`
        : streamedChars > 0
          ? `${String(streamedChars)} streamed characters`
          : "No evidence collected yet";

  const output =
    selectedNodeId === "output" || selectedNodeId === "stream"
      ? latestAssistant?.content.trim() || lastError || "—"
      : selectedNodeId === "input"
        ? latestUser?.content.trim() || "—"
        : activeModel ?? "—";

  const showStreamCursor =
    isStreaming && (selectedNodeId === "stream" || selectedNodeId === "output");
  const confidencePct =
    trustScore === null || !Number.isFinite(trustScore) ? null : Math.round(trustScore * 100);

  const toggle = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "glass-panel absolute top-3 right-3 z-40 flex w-[min(100%,21rem)] flex-col overflow-hidden shadow-[0_24px_60px_-30px_oklch(0_0_0_/_75%),0_0_40px_-22px_oklch(0.82_0.135_199_/_35%)]",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg border border-neon-cyan/30 bg-neon-cyan/10">
            <ScanSearch className="size-3.5 text-neon-cyan" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">
              {claimFocusMode
                ? "Claim focus"
                : structureModeNode
                  ? "Structure inspector"
                  : "Node inspector"}
            </p>
            <p className="truncate font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
              {claimFocusMode
                ? "Focused assertion"
                : structureModeNode
                  ? structureModeNode.label
                  : (selectedNodeId ?? "—")}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="rounded-md p-1.5 text-muted-foreground outline-none transition hover:bg-white/[0.06] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
          onClick={() => {
            if (claimFocusMode) exitClaimFocus();
            setSelectedNodeId(null);
          }}
        >
          <X className="size-3.5" />
          <span className="sr-only">Close</span>
        </button>
      </header>

      <div className="max-h-80 overflow-y-auto scrollbar-slim">
        {claimFocusMode && focusedAssertionId ? (
          <ClaimFocusInspectorBody assertionId={focusedAssertionId} />
        ) : structureModeNode && score ? (
          <StructureInspectorBody
            node={structureModeNode}
            analysisScore={{
              sentenceCount: score.sentenceCount,
              hedgeCount: score.hedgeCount,
              evidenceCount: score.evidenceCount,
              reasoningDepth: score.reasoningDepth,
            }}
          />
        ) : (
          <>
            <InspectorSection
              id="reasoning"
              title="Reasoning"
              open={openSections.reasoning}
              onToggle={() => {
                toggle("reasoning");
              }}
            >
              {selectedNodeId
                ? (reasoningByNode[selectedNodeId] ?? "No reasoning bound.")
                : "No reasoning bound."}
            </InspectorSection>

            <InspectorSection
              id="evidence"
              title="Evidence"
              open={openSections.evidence}
              onToggle={() => {
                toggle("evidence");
              }}
            >
              <p>{evidence}</p>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                Latency · {formatLatency(firstTokenLatencyMs ?? totalLatencyMs)}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                Finish ·{" "}
                {finishReason ??
                  (lastErrorCode ? `${lastErrorCode}${lastError ? `: ${lastError}` : ""}` : "—")}
              </p>
            </InspectorSection>

            {score ? (
              <InspectorSection
                id="structure"
                title="Response structure"
                open={openSections.structure}
                onToggle={() => {
                  toggle("structure");
                }}
              >
                <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
                  <li className="text-neon-cyan">Claims · {score.claimCount}</li>
                  <li className="text-neon-emerald">Evidence · {score.evidenceCount}</li>
                  <li className="text-neon-violet">Reasoning · {score.reasoningCount}</li>
                  <li className="text-orange-400">Examples · {score.exampleCount}</li>
                  <li className="text-neon-amber">
                    Hedging · {(score.hedgingRatio * 100).toFixed(0)}%
                  </li>
                  <li className="text-pink-400">Conclusions · {score.conclusionCount}</li>
                </ul>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Derived from finished assistant text only — not model chain-of-thought.
                </p>
              </InspectorSection>
            ) : null}

            <InspectorSection
              id="confidence"
              title="Confidence"
              open={openSections.confidence}
              onToggle={() => {
                toggle("confidence");
              }}
            >
              <div className="flex items-end justify-between gap-3">
                <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {confidencePct === null ? "—" : `${String(confidencePct)}%`}
                </span>
                <span className="pb-1 text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                  Live index
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-emerald shadow-[0_0_16px_-4px_var(--neon-cyan)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${String(confidencePct ?? 0)}%` }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </InspectorSection>

            <InspectorSection
              id="output"
              title="Output"
              open={openSections.output}
              onToggle={() => {
                toggle("output");
              }}
            >
              <div
                ref={outputRef}
                className="max-h-28 overflow-y-auto rounded-lg border border-border/50 bg-black/25 px-2.5 py-2 font-mono text-xs leading-relaxed scrollbar-slim"
              >
                {output}
                {showStreamCursor ? <span className="typing-caret" aria-hidden /> : null}
              </div>
            </InspectorSection>
          </>
        )}
      </div>
    </motion.aside>
  );
}
