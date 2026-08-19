import type { Edge, Node, NodeMouseHandler } from "@xyflow/react";
import { AnimatePresence } from "framer-motion";
import {
  Activity,
  BookOpen,
  Box,
  FileText,
  Split,
  Terminal,
  X,
} from "lucide-react";
import React, { useState } from "react";

import { NodeInspector } from "@/components/common/NodeInspector";
import { StructureLegend } from "@/features/demo";
import { GraphPanel } from "@/features/graph-visualizer";
import { hudAudio } from "@/features/audio/audio-sfx";
import type { ClaimFocusMetrics } from "@/lib/claim-focus";
import type { RetrievedSource } from "@/lib/sources";
import type { StageEvent } from "@/lib/stage-graph";
import type { ResponseStructureAnalysis } from "@/lib/xai";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

import { AgentTerminalTab } from "./AgentTerminalTab";
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

type TabType = "topology" | "sources" | "signals" | "dialectic" | "terminal";

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
  const setInspectorOpen = useUIStore((state) => state.setInspectorOpen);

  const showLegend =
    Boolean(responseAnalysis && responseAnalysis.score.sentenceCount > 0) &&
    (showingStructure || claimFocusActive);

  const handleTabChange = (tab: TabType) => {
    hudAudio.playClick(1400);
    setActiveTab(tab);
  };

  return (
    <aside
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden bg-[#080207] border-l border-rose-950/70 shadow-2xl",
        className,
      )}
    >
      {/* Header & Tabs */}
      <header className="shrink-0 border-b border-rose-950/60 bg-[#0d040c]/90 px-3 py-2 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold tracking-tight text-rose-300">
              {claimFocusActive ? "CLAIM VERIFICATION" : "EXPLAINABILITY HUD"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 rounded-lg border border-rose-950/80 bg-black/50 p-0.5 font-mono">
              <TabButton
                active={activeTab === "topology"}
                onClick={() => handleTabChange("topology")}
                icon={Box}
                label="3D Graph"
                badge={nodes.length > 0 ? String(nodes.length) : undefined}
              />
              <TabButton
                active={activeTab === "sources"}
                onClick={() => handleTabChange("sources")}
                icon={BookOpen}
                label="Sources"
                badge={retrievedSources.length > 0 ? String(retrievedSources.length) : undefined}
              />
              <TabButton
                active={activeTab === "signals"}
                onClick={() => handleTabChange("signals")}
                icon={Activity}
                label="Signals"
              />
              <TabButton
                active={activeTab === "dialectic"}
                onClick={() => handleTabChange("dialectic")}
                icon={Split}
                label="Dialectic"
              />
              <TabButton
                active={activeTab === "terminal"}
                onClick={() => handleTabChange("terminal")}
                icon={Terminal}
                label="Terminal"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                hudAudio.playClick();
                setInspectorOpen(false);
              }}
              className="flex size-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-rose-950/50 hover:text-rose-200"
              title="Close panel"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Live Stage Progress */}
        {(isStreaming || stageEvents.length > 0) && (
          <div className="mt-2 pt-2 border-t border-rose-950/40">
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
              <div className="rounded-xl border border-rose-950/60 bg-[#0e050c]/50 p-6 text-center text-xs text-zinc-400">
                <FileText className="mx-auto size-8 text-rose-700/50 mb-2" />
                <p className="font-medium text-foreground">No retrieved sources for this inquiry.</p>
                <p className="mt-1 text-zinc-500">
                  Gathered sources from ArXiv, Wikipedia, and the web will appear here.
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

        {activeTab === "terminal" && (
          <div className="scrollbar-slim size-full space-y-4 overflow-y-auto p-4">
            <AgentTerminalTab stageEvents={stageEvents} mode={runMode} />
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
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-mono transition",
        active
          ? "bg-rose-500/20 text-rose-200 border border-rose-500/40 shadow-sm"
          : "text-zinc-400 hover:text-rose-200 hover:bg-rose-950/40",
      )}
    >
      <Icon className="size-3" />
      <span>{label}</span>
      {badge ? (
        <span
          className={cn(
            "rounded-full px-1.5 text-[9px] font-mono",
            active ? "bg-rose-500 text-white" : "bg-rose-950/60 text-rose-300 border border-rose-900/40",
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

