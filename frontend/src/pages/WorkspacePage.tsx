import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo } from "react";
import type { Node, NodeMouseHandler } from "@xyflow/react";

import { NodeInspector } from "@/components/common/NodeInspector";
import { ChatPanel } from "@/features/conversation";
import { DemoLanding, StoryGuide } from "@/features/demo";
import { GraphPanel } from "@/features/graph-visualizer";
import { TimelinePanel } from "@/features/timeline";
import { TrustPanel } from "@/features/trust";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useStoryOrchestration } from "@/hooks/use-story-orchestration";
import {
  ASSERTION_NODE_ID,
  applyClaimFocusLayout,
  buildClaimFocusMetrics,
  primaryAssertionId,
  resolveClaimFocus,
} from "@/lib/claim-focus";
import { getShowcasePrompt, type DemoPrompt } from "@/lib/demo-prompts";
import { buildResponseStructureGraph, isStructureNodeData } from "@/lib/response-graph";
import { buildRunGraph } from "@/lib/run-graph";
import { primaryUnsupportedAssertionId } from "@/lib/unsupported-claims";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

export function WorkspacePage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const activePanel = useUIStore((state) => state.activePanel);
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
  const bumpDemoRun = useUIStore((state) => state.bumpDemoRun);
  const startJudgeShowcase = useUIStore((state) => state.startJudgeShowcase);
  const stopJudgeMode = useUIStore((state) => state.stopJudgeMode);

  const connection = useSessionStore((state) => state.connection);
  const messages = useSessionStore((state) => state.messages);
  const isStreaming = useSessionStore((state) => state.isStreaming);
  const lastError = useSessionStore((state) => state.lastError);
  const lastErrorCode = useSessionStore((state) => state.lastErrorCode);
  const graphNodes = useSessionStore((state) => state.graphNodes);
  const graphEdges = useSessionStore((state) => state.graphEdges);
  const timeline = useSessionStore((state) => state.timeline);
  const trustScore = useSessionStore((state) => state.trustScore);
  const trustSignals = useSessionStore((state) => state.trustSignals);
  const trustHistory = useSessionStore((state) => state.trustHistory);
  const responseAnalysis = useSessionStore((state) => state.responseAnalysis);
  const sendMessage = useSessionStore((state) => state.sendMessage);
  const stop = useSessionStore((state) => state.stop);
  const setSelectedNodeId = useSessionStore((state) => state.setSelectedNodeId);
  const selectedNodeId = useSessionStore((state) => state.selectedNodeId);
  const activeModel = useSessionStore((state) => state.activeModel);
  const phase = useSessionStore((state) => state.phase);

  useStoryOrchestration();

  const chatDisabled = connection !== "live" || isReplaying;
  const chatError =
    lastError !== null
      ? lastErrorCode
        ? `${lastErrorCode}: ${lastError}`
        : lastError
      : null;

  const claimFocusActive = focusedAssertionId !== null && !isReplaying;
  const demoLandingDismissed = useUIStore((state) => state.demoLandingDismissed);
  const dismissDemoLanding = useUIStore((state) => state.dismissDemoLanding);
  const showDemoLanding =
    messages.length === 0 &&
    !isStreaming &&
    phase === "idle" &&
    !isReplaying &&
    !judgeModeActive &&
    !demoLandingDismissed;

  useEffect(() => {
    if (isStreaming && (isReplaying || replayPhase !== null)) {
      stopReplay();
    }
  }, [isStreaming, isReplaying, replayPhase, stopReplay]);

  // Pipeline while streaming / starting; morph to structure 250ms after finish.
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

  // ESC exits Claim Focus Mode.
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
        // Empty finished analysis — keep structure surface (do not fall back to pipeline).
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

  // Empty structure must never leave Claim Focus stuck.
  useEffect(() => {
    if (!showingStructure) return;
    if (structureGraph && structureGraph.nodes.length === 0 && focusedAssertionId !== null) {
      exitClaimFocus();
    }
  }, [exitClaimFocus, focusedAssertionId, showingStructure, structureGraph]);

  const claimMetrics = useMemo(() => {
    if (!claimFocusActive || !responseAnalysis || !focusedAssertionId) return null;
    return buildClaimFocusMetrics(responseAnalysis, focusedAssertionId);
  }, [claimFocusActive, focusedAssertionId, responseAnalysis]);

  const canReplay =
    !isStreaming && phase !== "idle" && (phase === "finished" || phase === "failed" || phase === "cancelled");

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
      // Manual composer traffic must never be hijacked by Story / Judge timers.
      setStoryModeEnabled(false);
      stopJudgeMode();
      setStoryStep(null);
      sendMessage(text);
    },
    [sendMessage, setStoryModeEnabled, setStoryStep, stopJudgeMode],
  );

  const launchPrompt = useCallback(
    (prompt: DemoPrompt, asShowcase: boolean) => {
      if (connection !== "live") return;
      if (asShowcase) {
        startJudgeShowcase();
      } else {
        stopJudgeMode();
        bumpDemoRun();
      }
      sendMessage(prompt.prompt);
    },
    [bumpDemoRun, connection, sendMessage, startJudgeShowcase, stopJudgeMode],
  );

  const onSelectPrompt = useCallback(
    (prompt: DemoPrompt) => {
      launchPrompt(prompt, Boolean(prompt.showcase));
    },
    [launchPrompt],
  );

  const onRunShowcase = useCallback(() => {
    launchPrompt(getShowcasePrompt(), true);
  }, [launchPrompt]);

  const graph = (
    <GraphPanel
      active
      className="h-full"
      nodes={displayGraph.nodes}
      edges={displayGraph.edges}
      cameraEnabled
      onNodeClick={onNodeClick}
      title={
        claimFocusActive
          ? "Claim Focus"
          : showingStructure
            ? "Response Structure"
            : "Reasoning Pipeline"
      }
      description={
        claimFocusActive
          ? "Assertion-centered explainability"
          : showingStructure
            ? structureGraph && structureGraph.nodes.length === 0
              ? "No explainable structure detected"
              : "Observable structural analysis"
            : "Live execution surface"
      }
      surface={showingStructure || claimFocusActive ? "structure" : "pipeline"}
      claimFocusActive={claimFocusActive}
      onExitClaimFocus={handleExitClaimFocus}
      viewKey={
        claimFocusActive
          ? `claim-focus-${focusedAssertionId}`
          : showingStructure
            ? `structure-${String(structureGraph?.nodes.length ?? 0)}-${structureGraph?.nodes.length === 0 ? "empty" : "ready"}`
            : `pipeline-${phase}-${String(graphNodes.length)}`
      }
    />
  );

  const inspector = (
    <AnimatePresence>
      {selectedNodeId || claimFocusActive ? (
        <NodeInspector key="inspector" graphSurface={showingStructure ? "structure" : "pipeline"} />
      ) : null}
    </AnimatePresence>
  );

  const timelinePanel = (
    <TimelinePanel
      active={!isDesktop && activePanel === "timeline"}
      className="h-full"
      events={timeline}
      canReplay={canReplay}
      endPhase={phase === "idle" ? "finished" : phase}
    />
  );

  const trust = (
    <TrustPanel
      active={!isDesktop && activePanel === "trust"}
      className="h-full"
      score={trustScore}
      signals={trustSignals}
      history={trustHistory}
      claimMetrics={claimMetrics}
    />
  );

  const storyGuide =
    storyModeEnabled &&
    !showDemoLanding &&
    (judgeModeActive || storyStep !== null) ? (
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

  const demoLanding = (
    <AnimatePresence>
      {showDemoLanding ? (
        <DemoLanding
          key="demo-landing"
          disabled={connection !== "live"}
          onSelectPrompt={onSelectPrompt}
          onRunShowcase={onRunShowcase}
          onDismiss={dismissDemoLanding}
        />
      ) : null}
    </AnimatePresence>
  );

  if (!isDesktop) {
    return (
      <div className="relative h-full min-h-0">
        {graph}
        {inspector}
        {storyGuide}
        {demoLanding}

        <AnimatePresence mode="wait">
          {activePanel === "chat" ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="absolute inset-x-3 bottom-3 top-[18%] z-30"
            >
              <ChatPanel
                active
                floating
                className="h-full"
                messages={messages}
                isStreaming={isStreaming}
                disabled={chatDisabled}
                error={chatError}
                responseAnalysis={responseAnalysis}
                onSend={handleManualSend}
                onStop={stop}
              />
            </motion.div>
          ) : null}
          {activePanel === "timeline" ? (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="absolute inset-x-3 bottom-3 top-[35%] z-30"
            >
              {timelinePanel}
            </motion.div>
          ) : null}
          {activePanel === "trust" ? (
            <motion.div
              key="trust"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="absolute inset-x-3 bottom-3 top-[35%] z-30"
            >
              {trust}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="os-workspace relative grid h-full min-h-0 gap-3">
      <section className="os-hero relative min-h-0">
        {graph}
        {inspector}
        {storyGuide}
      </section>

      <aside className="os-chat min-h-0">
        <ChatPanel
          active
          floating
          className="h-full"
          messages={messages}
          isStreaming={isStreaming}
          disabled={chatDisabled}
          error={chatError}
          responseAnalysis={responseAnalysis}
          onSend={handleManualSend}
          onStop={stop}
        />
      </aside>

      <aside className="os-timeline min-h-0">{timelinePanel}</aside>

      <aside className="os-trust min-h-0">{trust}</aside>

      {demoLanding}
    </div>
  );
}
