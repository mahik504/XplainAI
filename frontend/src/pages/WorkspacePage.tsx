import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo } from "react";
import type { Node, NodeMouseHandler } from "@xyflow/react";

import { ChatPanel } from "@/features/conversation";
import { StoryGuide } from "@/features/demo";
import { ExplainabilityPanel } from "@/features/explainability";
import { HistorySidebar } from "@/features/history";
import { useMediaQuery } from "@/hooks/use-media-query";
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
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const showHistoryRail = useMediaQuery("(min-width: 1360px)");
  const activePanel = useUIStore((state) => state.activePanel);
  const setActivePanel = useUIStore((state) => state.setActivePanel);
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

  const sourcesEmptyHint =
    phase === "finished" &&
    (runMode === "balanced" || runMode === "deep_research") &&
    retrievedSources.length === 0;

  const explainability = (
    <ExplainabilityPanel
      className="size-full"
      isStreaming={isStreaming}
      phase={phase}
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
      floating
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

  if (!isDesktop) {
    return (
      <div className="relative flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
          {(
            [
              ["chat", "Studio"],
              ["graph", "Cockpit"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                (id === "chat" && activePanel === "chat") ||
                (id === "graph" && activePanel !== "chat")
                  ? "bg-zinc-800 text-cyan-300 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              onClick={() => {
                setActivePanel(id === "chat" ? "chat" : "graph");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-h-0 flex-1">
          {activePanel === "chat" ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0"
            >
              {chatPanel}
              {storyGuide}
            </motion.div>
          ) : (
            <motion.div
              key="xai"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0"
            >
              {explainability}
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 gap-3">
      {showHistoryRail ? <HistorySidebar compact className="shrink-0" /> : null}

      {/* Main Conversational Studio */}
      <section className="relative min-h-0 min-w-0 flex-[1.25]">
        {chatPanel}
        {storyGuide}
      </section>

      {/* Research & Evidence Cockpit */}
      <section className="relative min-h-0 w-[min(46%,600px)] shrink-0 xl:w-[min(48%,660px)] 2xl:w-[min(50%,740px)]">
        {explainability}
      </section>
    </div>
  );
}
