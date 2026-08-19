import type { Edge, Node, NodeMouseHandler } from "@xyflow/react";
import { AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Activity,
  Split,
  Box,
  FileText,
} from "lucide-react";
import React, { useState } from "react";

import { NodeInspector } from "@/components/common/NodeInspector";
import { StructureLegend } from "@/features/demo";
import { GraphPanel } from "@/features/graph-visualizer";
import type { ClaimFocusMetrics } from "@/lib/claim-focus";
import type { RetrievedSource } from "@/lib/sources";
import type { StageEvent } from "@/lib/stage-graph";
import type { ResponseStructureAnalysis } from "@/lib/xai";
import { cn } from "@/lib/utils";

import { CounterPerspectiveCard } from "./CounterPerspectiveCard";
import { MissingContextCard, type MissingContextItem } from "./MissingContextCard";
import { RetrievedSourcesCard } from "./RetrievedSourcesCard";
import { StageRail } from "./StageRail";
import { StructuralSignalsCard } from "./StructuralSignalsCard";

interface ExplainabilityPanelProps {
  className?: string;
  isStreaming: boolean;
  runMode: string;
  stageEvents: StageEvent[];
  nodes: Node[];
  edges: Edge[];
  showingStructure: boolean;
  claimFocusActive: boolean;
  onExitClaimFocus?: () => void;
  onNodeClick?: NodeMouseHandler<Node>;
  viewKey: string;
  graphTitle: string;
  graphDescription: string;
  responseAnalysis: ResponseStructureAnalysis | null;
  claimMetrics: ClaimFocusMetrics | null;
  retrievedSources: RetrievedSource[];
  sourcesEmptyHint: boolean;
  missingContext: MissingContextItem[];
  counterPerspective: string | null;
  selectedNodeId: string | null;
}

type TabType = "topology" | "sources" | "signals" | "dialectic";

export function ExplainabilityPanel({
  className,
  isStreaming,
  runMode,
  stageEvents,
  nodes,
  edges,
  showingStructure,
  claimFocusActive,
  onExitClaimFocus,
  onNodeClick,
  viewKey,
  graphTitle,
  graphDescription,
  responseAnalysis,
  claimMetrics,
  retrievedSources,
  sourcesEmptyHint,
  missingContext,
  counterPerspective,
  selectedNodeId,
}: ExplainabilityPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("topology");

  const showLegend =
    Boolean(responseAnalysis && responseAnalysis.score.sentenceCount > 0) &&
    (showingStructure || claimFocusActive);

  return (
    <aside
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#08080A]/90 shadow-2xl backdrop-blur-2xl",
        className,
      )}
    >
      {/* Cockpit Header & Navigation Tabs */}
      <header className="shrink-0 border-b border-zinc-800/70 bg-zinc-900/30 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400 font-semibold">
                EXPLAINABILITY COCKPIT
              </span>
              <span className="size-1 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
            </div>
            <p className="text-xs font-semibold text-zinc-100 font-display">
              {claimFocusActive ? "Claim Verification Active" : "Observable Truth Engine"}
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/80 p-0.5">
            <TabButton
              active={activeTab === "topology"}
              onClick={() => setActiveTab("topology")}
              icon={Box}
              label="3D Galaxy"
              badge={nodes.length > 0 ? String(nodes.length) : undefined}
            />
            <TabButton
              active={activeTab === "sources"}
              onClick={() => setActiveTab("sources")}
              icon={BookOpen}
              label="Dossier"
              badge={retrievedSources.length > 0 ? String(retrievedSources.length) : undefined}
            />
            <TabButton
              active={activeTab === "signals"}
              onClick={() => setActiveTab("signals")}
              icon={Activity}
              label="Signals"
            />
            <TabButton
              active={activeTab === "dialectic"}
              onClick={() => setActiveTab("dialectic")}
              icon={Split}
              label="Dialectic"
            />
          </div>
        </div>

        {/* Live Stage Progress Strip */}
        {(isStreaming || stageEvents.length > 0) && (
          <div className="mt-2.5 pt-2 border-t border-zinc-800/40">
            <StageRail events={stageEvents} isStreaming={isStreaming} mode={runMode} />
          </div>
        )}
      </header>

      {/* Main Tab Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "topology" && (
          <div className="relative size-full overflow-hidden">
            <GraphPanel
              active
              className="size-full border-0 bg-transparent shadow-none"
              nodes={nodes}
              edges={edges}
              cameraEnabled
              {...(onNodeClick ? { onNodeClick } : {})}
              title={graphTitle}
              description={graphDescription}
              surface={showingStructure || claimFocusActive ? "structure" : "pipeline"}
              claimFocusActive={claimFocusActive}
              {...(onExitClaimFocus ? { onExitClaimFocus } : {})}
              viewKey={viewKey}
              compactChrome
            />
            <AnimatePresence>
              {selectedNodeId || claimFocusActive ? (
                <NodeInspector
                  key="inspector"
                  graphSurface={showingStructure ? "structure" : "pipeline"}
                />
              ) : null}
            </AnimatePresence>
            {showLegend ? (
              <div className="absolute bottom-2 left-2 z-20">
                <StructureLegend compact />
              </div>
            ) : null}
          </div>
        )}

        {activeTab === "sources" && (
          <div className="scrollbar-slim size-full space-y-4 overflow-y-auto p-4">
            <RetrievedSourcesCard sources={retrievedSources} emptyHint={sourcesEmptyHint} />
            {!sourcesEmptyHint && retrievedSources.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-center text-xs text-zinc-400">
                <FileText className="mx-auto size-8 text-zinc-600 mb-2" />
                <p className="font-medium text-zinc-200">No retrieved sources for this response.</p>
                <p className="mt-1 text-zinc-500">
                  Tool-gathered sources from ArXiv, Wikipedia, and web will appear here.
                </p>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === "signals" && (
          <div className="scrollbar-slim size-full space-y-4 overflow-y-auto p-4">
            <StructuralSignalsCard
              analysis={responseAnalysis}
              claimMetrics={claimMetrics}
              retrievedSourcesCount={retrievedSources.length}
            />
          </div>
        )}

        {activeTab === "dialectic" && (
          <div className="scrollbar-slim size-full space-y-4 overflow-y-auto p-4">
            <MissingContextCard items={missingContext} />
            <CounterPerspectiveCard text={counterPerspective} />
          </div>
        )}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all active:scale-95",
        active
          ? "bg-zinc-800 text-amber-300 shadow-sm border border-amber-500/20"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40",
      )}
    >
      <Icon className="size-3" />
      <span>{label}</span>
      {badge ? (
        <span
          className={cn(
            "rounded-full px-1 text-[9px] font-mono",
            active ? "bg-amber-500/20 text-amber-300" : "bg-zinc-800 text-zinc-500",
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
