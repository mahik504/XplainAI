import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo } from "react";
import type { Node, NodeMouseHandler } from "@xyflow/react";

import { ChatPanel } from "@/features/conversation";
import { StoryGuide } from "@/features/demo";
import { ExplainabilityPanel } from "@/features/explainability";
import { HistorySidebar } from "@/features/history";
import { useStoryOrchestration } from "@/hooks/use-story-orchestration";
import {
  ASSERTION_NODE_ID,
  applyClaimFocusLayout,
  buildClaimFocusMetrics,
  primaryAssertionId,
  resolveClaimFocus,
} from "@/lib/claim-focus";
import { buildResponseStructureGraph, isStructureNodeData } from "@/lib/response-graph";
import { buildRunGraph } from "@/lib/run-graph";
import { primaryUnsupportedAssertionId } from "@/lib/unsupported-claims";
import { useConversationStore } from "@/stores/conversation-store";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

export function WorkspacePage() {
  const replayPhase = useUIStore((state) => state.replayPhase);
  const isReplaying = useUIStore((state) => state.isReplaying);
  const stopReplay = useUIStore((state) => state.stopReplay);
  const graphSurface = useUIStore((state) => state.graphSurface);
  const setGraphSurface = useUIStore((state) => state.setGraphSurface);
  const focusedAssertionId = useUIStore((state) => state.focusedAssertionId);
  const focusedEvidenceIds = useUIStore((state) => state.focusedEvidenceIds);
  const enterClaimFocus = useUIStore((state) => state.enterClaimFocus);
  const exitClaimFocus = useUIStore((state) => state.exitClaimFocus);
  const storyModeEnabled = useUIStore((state) => state.storyModeEnabled);
  const storyStep = useUIStore((state) => state.storyStep);
  const judgeModeActive = useUIStore((state) => state.judgeModeActive);
  const setStoryModeEnabled = useUIStore((state) => state.setStoryModeEnabled);
  const setStoryStep = useUIStore((state) => state.setStoryStep);
  const stopJudgeMode = useUIStore((state) => state.stopJudgeMode);

  const connection = useSessionStore((state) => state.connection);
  const messages = useSessionStore((state) => state.messages);
  const isStreaming = useSessionStore((state) => state.isStreaming);
  const lastError = useSessionStore((state) => state.lastError);
  const lastErrorCode = useSessionStore((state) => state.lastErrorCode);
  const graphNodes = useSessionStore((state) => state.graphNodes);
  const graphEdges = useSessionStore((state) => state.graphEdges);
  const responseAnalysis = useSessionStore((state) => state.responseAnalysis);
  const sendMessage = useSessionStore((state) => state.sendMessage);
  const retryLast = useSessionStore((state) => state.retryLast);
  const stop = useSessionStore((state) => state.stop);
  const setSelectedNodeId = useSessionStore((state) => state.setSelectedNodeId);
  const selectedNodeId = useSessionStore((state) => state.selectedNodeId);
  const activeModel = useSessionStore((state) => state.activeModel);
  const phase = useSessionStore((state) => state.phase);
  const runMode = useSessionStore((state) => state.runMode);
  const setRunMode = useSessionStore((state) => state.setRunMode);
  const sourcesRetrieved = useSessionStore((state) => state.sourcesRetrieved);
  const retrievedSources = useSessionStore((state) => state.retrievedSources);
  const missingContext = useSessionStore((state) => state.missingContext);
  const counterPerspective = useSessionStore((state) => state.counterPerspective);
  const stageEvents = useSessionStore((state) => state.stageEvents);
  const ensureActiveConversation = useConversationStore((state) => state.ensureActiveConversation);
  const setConversationMode = useConversationStore((state) => state.setConversationMode);
  const hydrateConversations = useConversationStore((state) => state.hydrate);

  useStoryOrchestration();

  useEffect(() => {
    void hydrateConversations();
  }, [hydrateConversations]);

  const chatDisabled = connection !== "live" || isReplaying;
  const chatError =
    lastError !== null ? (lastErrorCode ? `${lastErrorCode}: ${lastError}` : lastError) : null;

  const claimFocusActive = focusedAssertionId !== null && !isReplaying;

  useEffect(() => {
    if (isStreaming && (isReplaying || replayPhase !== null)) {
      stopReplay();
    }
  }, [isStreaming, isReplaying, replayPhase, stopReplay]);

  useEffect(() => {
    if (isStreaming || phase === "started" || phase === "streaming" || phase === "idle") {
      if (graphSurface !== "pipeline") setGraphSurface("pipeline");
      if (focusedAssertionId !== null) exitClaimFocus();
      return;
    }

    if (phase !== "finished" || !responseAnalysis || isReplaying) {
      return;
    }

    if (graphSurface === "structure") return;

    const timer = window.setTimeout(() => {
      setGraphSurface("structure");
      setSelectedNodeId(null);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    exitClaimFocus,
    focusedAssertionId,
    graphSurface,
    isReplaying,
    isStreaming,
    phase,
    responseAnalysis,
    setGraphSurface,
    setSelectedNodeId,
  ]);

  useEffect(() => {
    if (!claimFocusActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        exitClaimFocus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [claimFocusActive, exitClaimFocus]);

  const structureGraph = useMemo(() => {
    if (!responseAnalysis) return null;
    return buildResponseStructureGraph(responseAnalysis);
  }, [responseAnalysis]);

  const displayGraph = useMemo(() => {
    if (replayPhase && replayPhase !== "idle") {
      return buildRunGraph(replayPhase, activeModel ?? undefined);
    }
    if (graphSurface === "structure" && structureGraph) {
      if (structureGraph.nodes.length === 0) {
        return { nodes: [], edges: [] };
      }
      if (claimFocusActive) {
        return applyClaimFocusLayout(structureGraph.nodes, structureGraph.edges, {
          hasLinkedEvidence: focusedEvidenceIds.length > 0,
        });
      }
      return structureGraph;
    }
    return { nodes: graphNodes, edges: graphEdges };
  }, [
    activeModel,
    claimFocusActive,
    focusedEvidenceIds.length,
    graphEdges,
    graphNodes,
    graphSurface,
    replayPhase,
    structureGraph,
  ]);

  const showingStructure =
    graphSurface === "structure" &&
    !isReplaying &&
    !(replayPhase && replayPhase !== "idle") &&
    Boolean(structureGraph);

  useEffect(() => {
    if (!showingStructure) return;
    if (structureGraph && structureGraph.nodes.length === 0 && focusedAssertionId !== null) {
      exitClaimFocus();
    }
  }, [exitClaimFocus, focusedAssertionId, showingStructure, structureGraph]);

  const claimMetrics = useMemo(() => {
    if (!claimFocusActive || !responseAnalysis || !focusedAssertionId) return null;
    return buildClaimFocusMetrics(responseAnalysis, focusedAssertionId, {
      retrievedSourcesCount: sourcesRetrieved,
    });
  }, [claimFocusActive, focusedAssertionId, responseAnalysis, sourcesRetrieved]);

  const onNodeClick = useCallback<NodeMouseHandler<Node>>(
    (_event, node) => {
      setSelectedNodeId(node.id);

      if (!showingStructure || !responseAnalysis) return;

      const kind = isStructureNodeData(node.data) ? node.data.structureKind : null;
      if (node.id !== ASSERTION_NODE_ID && kind !== "assertion") return;

      const assertionId =
        primaryUnsupportedAssertionId(responseAnalysis) ?? primaryAssertionId(responseAnalysis);
      if (!assertionId) return;

      const resolved = resolveClaimFocus(responseAnalysis, assertionId);
      if (!resolved) return;

      enterClaimFocus(assertionId, resolved.evidenceIds);
    },
    [enterClaimFocus, responseAnalysis, setSelectedNodeId, showingStructure],
  );

  const handleExitClaimFocus = useCallback(() => {
    exitClaimFocus();
  }, [exitClaimFocus]);

  const handleManualSend = useCallback(
    (text: string) => {
      setStoryModeEnabled(false);
      stopJudgeMode();
      setStoryStep(null);
      void (async () => {
        const conversationId = await ensureActiveConversation();
        if (conversationId) setConversationMode(conversationId, runMode);
        sendMessage(text, { conversationId });
      })();
    },
    [
      ensureActiveConversation,
      runMode,
      sendMessage,
      setConversationMode,
      setStoryModeEnabled,
      setStoryStep,
      stopJudgeMode,
    ],
  );

  const handleRetry = useCallback(() => {
    void (async () => {
      const conversationId = await ensureActiveConversation();
      retryLast({ conversationId });
    })();
  }, [ensureActiveConversation, retryLast]);

  const graphTitle = claimFocusActive
    ? "Claim Verification"
    : showingStructure
      ? "Response Topology"
      : "Live Pipeline";
  const graphDescription = claimFocusActive
    ? "Assertion & Evidence Linkage"
    : showingStructure
      ? structureGraph && structureGraph.nodes.length === 0
        ? "Direct synthesis"
        : "Observable semantic structure"
      : "Stage execution stream";

  const viewKey = claimFocusActive
    ? `claim-focus-${focusedAssertionId}`
    : showingStructure
      ? `structure-${String(structureGraph?.nodes.length ?? 0)}-${structureGraph?.nodes.length === 0 ? "empty" : "ready"}`
      : `pipeline-${phase}-${String(graphNodes.length)}`;

  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const inspectorOpen = useUIStore((state) => state.inspectorOpen);

  const sourcesEmptyHint =
    phase === "finished" &&
    (runMode === "balanced" || runMode === "deep_research") &&
    retrievedSources.length === 0;

  const explainability = (
    <ExplainabilityPanel
      className="size-full"
      isStreaming={isStreaming}
      runMode={runMode}
      stageEvents={stageEvents}
      nodes={displayGraph.nodes}
      edges={displayGraph.edges}
      showingStructure={showingStructure}
      claimFocusActive={claimFocusActive}
      onExitClaimFocus={handleExitClaimFocus}
      onNodeClick={onNodeClick}
      viewKey={viewKey}
      graphTitle={graphTitle}
      graphDescription={graphDescription}
      responseAnalysis={responseAnalysis}
      claimMetrics={claimMetrics}
      retrievedSources={retrievedSources}
      sourcesEmptyHint={sourcesEmptyHint}
      missingContext={missingContext}
      counterPerspective={counterPerspective}
      selectedNodeId={selectedNodeId}
    />
  );

  const chatPanel = (
    <ChatPanel
      active
      className="size-full"
      messages={messages}
      isStreaming={isStreaming}
      disabled={chatDisabled}
      error={chatError}
      responseAnalysis={responseAnalysis}
      runMode={runMode}
      onRunModeChange={setRunMode}
      sourcesLinked={sourcesRetrieved}
      stageEvents={stageEvents}
      onSend={handleManualSend}
      onRetry={handleRetry}
      onStop={stop}
    />
  );

  const storyGuide =
    storyModeEnabled && (judgeModeActive || storyStep !== null) ? (
      <StoryGuide
        activeStep={storyStep}
        judgeMode={judgeModeActive}
        onDismiss={() => {
          setStoryModeEnabled(false);
          stopJudgeMode();
          setStoryStep(null);
        }}
      />
    ) : null;

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-[#09090b]">
      {/* Collapsible History Sidebar */}
      {!sidebarCollapsed ? (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 260, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="h-full shrink-0 overflow-hidden"
        >
          <HistorySidebar className="h-full w-[260px]" />
        </motion.div>
      ) : null}

      {/* Main Spacious Conversational Canvas (Single-Column Focus) */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {chatPanel}
        {storyGuide}
      </main>

      {/* Slide-over Explainability Inspector Drawer */}
      {inspectorOpen ? (
        <motion.aside
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="relative z-20 h-full w-[440px] shrink-0 xl:w-[500px] 2xl:w-[560px]"
        >
          {explainability}
        </motion.aside>
      ) : null}
    </div>
  );
}

