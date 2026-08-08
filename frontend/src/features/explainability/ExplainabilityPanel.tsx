import type { Edge, Node, NodeMouseHandler } from "@xyflow/react";
import { AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

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
  phase: string;
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

export function ExplainabilityPanel({
  className,
  isStreaming,
  phase,
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
  const showLegend =
    Boolean(responseAnalysis && responseAnalysis.score.sentenceCount > 0) &&
    (showingStructure || claimFocusActive);

  return (
    <aside
      className={cn(
        "glass-panel flex h-full min-h-0 flex-col overflow-hidden border border-border/50",
        className,
      )}
    >
      <header className="shrink-0 border-b border-border/40 px-4 py-3">
        <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
          Explainability
        </p>
        <p className="mt-0.5 text-sm text-foreground/90">Observable structure of this response</p>
      </header>

      <div className="scrollbar-slim min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <Section
          title={isStreaming || phase === "started" ? "Live orchestration" : "Run stages"}
          {...(isStreaming ? { hint: "Actual stage events" } : {})}
        >
          <StageRail events={stageEvents} isStreaming={isStreaming} mode={runMode} />
        </Section>

        <Section title={graphTitle} hint={graphDescription}>
          <div className="relative h-[280px] overflow-hidden rounded-xl border border-border/40 bg-gradient-to-b from-black/35 to-black/15 sm:h-[340px]">
            <GraphPanel
              active
              className="h-full border-0 bg-transparent shadow-none"
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
          </div>
          {showLegend ? <StructureLegend compact /> : null}
        </Section>

        <Section title="Structural signals">
          <StructuralSignalsCard
            analysis={responseAnalysis}
            claimMetrics={claimMetrics}
            retrievedSourcesCount={retrievedSources.length}
          />
        </Section>

        <Section title="Sources">
          <RetrievedSourcesCard sources={retrievedSources} emptyHint={sourcesEmptyHint} />
          {!sourcesEmptyHint && retrievedSources.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No retrieved sources for this response. Structural evidence markers are separate.
            </p>
          ) : null}
        </Section>

        <MissingContextCard items={missingContext} />
        <CounterPerspectiveCard text={counterPerspective} />
      </div>
    </aside>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{title}</h3>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
