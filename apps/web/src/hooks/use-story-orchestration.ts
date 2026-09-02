import { useEffect, useRef } from "react";

import type { StoryStepId } from "@/lib/story-mode";
import { primaryUnsupportedAssertionId } from "@/lib/unsupported-claims";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

/**
 * Advances Story / Judge Mode from live session signals.
 * No AI — only responseAnalysis + run phase.
 * Timers are cancelled on: new send/stream, replay, story exit, showcase reset.
 */
export function useStoryOrchestration() {
  const storyModeEnabled = useUIStore((state) => state.storyModeEnabled);
  const judgeModeActive = useUIStore((state) => state.judgeModeActive);
  const graphSurface = useUIStore((state) => state.graphSurface);
  const focusedAssertionId = useUIStore((state) => state.focusedAssertionId);
  const composerPrefill = useUIStore((state) => state.composerPrefill);
  const showcaseRunId = useUIStore((state) => state.showcaseRunId);
  const isReplaying = useUIStore((state) => state.isReplaying);
  const setStoryStep = useUIStore((state) => state.setStoryStep);
  const setSpotlightAssertionId = useUIStore((state) => state.setSpotlightAssertionId);
  const setEvidenceDemandHighlight = useUIStore((state) => state.setEvidenceDemandHighlight);

  const isStreaming = useSessionStore((state) => state.isStreaming);
  const phase = useSessionStore((state) => state.phase);
  const responseAnalysis = useSessionStore((state) => state.responseAnalysis);
  const messages = useSessionStore((state) => state.messages);
  const activeRunId = useSessionStore((state) => state.activeRunId);

  const timersRef = useRef<number[]>([]);
  const structureBeatDone = useRef(false);
  const focusBeatDone = useRef(false);
  const improvedBeatDone = useRef(false);
  const seenAssistantCount = useRef(0);

  const apiRef = useRef({
    setStoryStep,
    setSpotlightAssertionId,
    setEvidenceDemandHighlight,
    judgeModeActive,
  });
  apiRef.current = {
    setStoryStep,
    setSpotlightAssertionId,
    setEvidenceDemandHighlight,
    judgeModeActive,
  };

  const clearTimers = () => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  };

  const resetBeats = () => {
    structureBeatDone.current = false;
    focusBeatDone.current = false;
    improvedBeatDone.current = false;
    seenAssistantCount.current = 0;
  };

  const go = (step: StoryStepId, delayMs = 0, then?: () => void) => {
    const id = window.setTimeout(() => {
      apiRef.current.setStoryStep(step);
      then?.();
    }, delayMs);
    timersRef.current.push(id);
  };

  // Reset story beats when a new demo / showcase run starts.
  useEffect(() => {
    resetBeats();
    clearTimers();
  }, [showcaseRunId]);

  // Story exit — cancel all pending guide timers.
  useEffect(() => {
    if (storyModeEnabled) return;
    clearTimers();
    resetBeats();
    setSpotlightAssertionId(null);
    setEvidenceDemandHighlight(false);
  }, [setEvidenceDemandHighlight, setSpotlightAssertionId, storyModeEnabled]);

  // New chat.send / response start — never let prior timers hijack the next run.
  useEffect(() => {
    if (!(isStreaming || phase === "started" || phase === "streaming")) return;
    clearTimers();
    if (storyModeEnabled) {
      structureBeatDone.current = false;
      focusBeatDone.current = false;
    }
  }, [activeRunId, isStreaming, phase, storyModeEnabled]);

  // Replay — cancel Story timers so guide steps cannot fire mid-replay.
  useEffect(() => {
    if (!isReplaying) return;
    clearTimers();
  }, [isReplaying]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  // Streaming / complete / structure cascade (first finished analysis only)
  useEffect(() => {
    if (!storyModeEnabled || isReplaying) return;

    if (isStreaming || phase === "started" || phase === "streaming") {
      if (!structureBeatDone.current) {
        setStoryStep("streaming");
      }
      return;
    }

    if (phase === "finished" && responseAnalysis && graphSurface !== "structure") {
      if (!structureBeatDone.current) {
        setStoryStep("response_complete");
      }
      return;
    }

    // Advance when structure surface is ready, OR when finished text has nothing
    // classifiable (varied OpenAI outputs) so Judge Mode never stalls.
    const thinStructure =
      phase === "finished" &&
      responseAnalysis !== null &&
      responseAnalysis.score.claimCount === 0 &&
      responseAnalysis.score.evidenceCount === 0;

    const emptyGraphReady =
      phase === "finished" &&
      responseAnalysis !== null &&
      graphSurface === "structure";

    if (
      phase === "finished" &&
      responseAnalysis &&
      !structureBeatDone.current &&
      (emptyGraphReady || thinStructure)
    ) {
      structureBeatDone.current = true;
      clearTimers();

      const hasEvidence = responseAnalysis.score.evidenceCount > 0;
      const unsupportedId = primaryUnsupportedAssertionId(responseAnalysis);

      setStoryStep("analyzing_structure");

      go("evidence_found", hasEvidence ? 650 : 350, () => {
        if (!unsupportedId) {
          // Varied / empty structure — keep guide honest and never stall.
          go("inspect_claim", 600, () => {
            if (apiRef.current.judgeModeActive) {
              go("ask_for_evidence", 900);
            }
          });
          return;
        }
        go("unsupported_claim", 850, () => {
          apiRef.current.setSpotlightAssertionId(unsupportedId);
          go("inspect_claim", 1000, () => {
            if (apiRef.current.judgeModeActive) {
              apiRef.current.setEvidenceDemandHighlight(true);
            }
          });
        });
      });
    }
  }, [
    graphSurface,
    isReplaying,
    isStreaming,
    phase,
    responseAnalysis,
    setStoryStep,
    storyModeEnabled,
  ]);

  // Claim Focus → ask for evidence
  useEffect(() => {
    if (!storyModeEnabled || isReplaying || !focusedAssertionId || focusBeatDone.current) return;
    focusBeatDone.current = true;
    setStoryStep("inspect_claim");
    if (judgeModeActive) {
      setEvidenceDemandHighlight(true);
      go("ask_for_evidence", 600);
    }
  }, [
    focusedAssertionId,
    isReplaying,
    judgeModeActive,
    setEvidenceDemandHighlight,
    setStoryStep,
    storyModeEnabled,
  ]);

  // Prefill evidence demand
  useEffect(() => {
    if (!storyModeEnabled || isReplaying || !composerPrefill) return;
    setStoryStep("ask_for_evidence");
  }, [composerPrefill, isReplaying, setStoryStep, storyModeEnabled]);

  // Second+ assistant turn → improved answer (do not rewind structure story)
  useEffect(() => {
    if (!storyModeEnabled || isReplaying) return;
    const assistantCount = messages.filter((message) => message.role === "assistant").length;

    if (
      phase === "finished" &&
      !isStreaming &&
      assistantCount >= 2 &&
      assistantCount > seenAssistantCount.current &&
      !improvedBeatDone.current
    ) {
      improvedBeatDone.current = true;
      setStoryStep("improved_answer");
      setEvidenceDemandHighlight(false);
    }

    if (phase === "finished" && !isStreaming) {
      seenAssistantCount.current = assistantCount;
    }
  }, [
    isReplaying,
    isStreaming,
    messages,
    phase,
    setEvidenceDemandHighlight,
    setStoryStep,
    storyModeEnabled,
  ]);
}
