import { create } from "zustand";

import type { RunPhase } from "@/lib/run-graph";
import type { StoryStepId } from "@/lib/story-mode";
import type { ResponseStructureCategory } from "@/lib/xai";

export type WorkspacePanel = "chat" | "graph" | "trust" | "timeline";

/** Pipeline execution graph vs finished response-structure graph */
export type GraphSurface = "pipeline" | "structure";

interface FocusSnapshot {
  assertionId: string;
  evidenceIds: string[];
}

interface UIState {
  activePanel: WorkspacePanel;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  settingsOpen: boolean;
  ambientMotion: boolean;
  glassStrength: number;
  replayPhase: RunPhase | null;
  replayEventId: string | null;
  isReplaying: boolean;
  graphSurface: GraphSurface;
  /** Lightweight hover sync between structure graph ↔ annotated sentences */
  highlightCategory: ResponseStructureCategory | null;
  /** Claim Focus Mode — sentence ids from responseAnalysis only */
  focusedAssertionId: string | null;
  focusedEvidenceIds: string[];
  /** Suspended while replay runs; restored when replay ends */
  suspendedFocus: FocusSnapshot | null;
  /** Demo / Story / Judge Mode */
  storyModeEnabled: boolean;
  storyStep: StoryStepId | null;
  judgeModeActive: boolean;
  spotlightAssertionId: string | null;
  evidenceDemandHighlight: boolean;
  composerPrefill: string | null;
  showcaseRunId: number;
  /** User dismissed Demo Mode landing to use the composer freely */
  demoLandingDismissed: boolean;
  setActivePanel: (panel: WorkspacePanel) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setAmbientMotion: (enabled: boolean) => void;
  setGlassStrength: (strength: number) => void;
  setGraphSurface: (surface: GraphSurface) => void;
  setHighlightCategory: (category: ResponseStructureCategory | null) => void;
  enterClaimFocus: (assertionId: string, evidenceIds: string[]) => void;
  exitClaimFocus: () => void;
  setStoryModeEnabled: (enabled: boolean) => void;
  setStoryStep: (step: StoryStepId | null) => void;
  bumpDemoRun: () => void;
  startJudgeShowcase: () => void;
  stopJudgeMode: () => void;
  setSpotlightAssertionId: (id: string | null) => void;
  setEvidenceDemandHighlight: (on: boolean) => void;
  setComposerPrefill: (value: string | null) => void;
  clearComposerPrefill: () => void;
  dismissDemoLanding: () => void;
  setReplay: (input: {
    phase: RunPhase | null;
    eventId?: string | null;
    isReplaying?: boolean;
  }) => void;
  stopReplay: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  activePanel: "graph",
  sidebarCollapsed: true,
  mobileNavOpen: false,
  settingsOpen: false,
  ambientMotion: true,
  glassStrength: 1,
  replayPhase: null,
  replayEventId: null,
  isReplaying: false,
  graphSurface: "pipeline",
  highlightCategory: null,
  focusedAssertionId: null,
  focusedEvidenceIds: [],
  suspendedFocus: null,
  storyModeEnabled: false,
  storyStep: null,
  judgeModeActive: false,
  spotlightAssertionId: null,
  evidenceDemandHighlight: false,
  composerPrefill: null,
  showcaseRunId: 0,
  demoLandingDismissed: false,
  setActivePanel: (panel) => {
    set({ activePanel: panel, mobileNavOpen: false });
  },
  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },
  setSidebarCollapsed: (collapsed) => {
    set({ sidebarCollapsed: collapsed });
  },
  setMobileNavOpen: (open) => {
    set({ mobileNavOpen: open });
  },
  setSettingsOpen: (open) => {
    set({ settingsOpen: open });
  },
  setAmbientMotion: (enabled) => {
    set({ ambientMotion: enabled });
  },
  setGlassStrength: (strength) => {
    set({ glassStrength: strength });
  },
  setGraphSurface: (surface) => {
    set({
      graphSurface: surface,
      highlightCategory: null,
      ...(surface === "pipeline"
        ? {
            focusedAssertionId: null,
            focusedEvidenceIds: [],
            suspendedFocus: null,
          }
        : {}),
    });
  },
  setHighlightCategory: (category) => {
    set({ highlightCategory: category });
  },
  enterClaimFocus: (assertionId, evidenceIds) => {
    set({
      focusedAssertionId: assertionId,
      focusedEvidenceIds: evidenceIds,
      suspendedFocus: null,
      highlightCategory: null,
      spotlightAssertionId: assertionId,
    });
  },
  exitClaimFocus: () => {
    set({
      focusedAssertionId: null,
      focusedEvidenceIds: [],
      suspendedFocus: null,
      highlightCategory: null,
    });
  },
  setStoryModeEnabled: (enabled) => {
    set({
      storyModeEnabled: enabled,
      ...(enabled
        ? {}
        : {
            storyStep: null,
            spotlightAssertionId: null,
            evidenceDemandHighlight: false,
          }),
    });
  },
  setStoryStep: (step) => {
    set({ storyStep: step });
  },
  bumpDemoRun: () => {
    set((state) => ({
      showcaseRunId: state.showcaseRunId + 1,
      storyModeEnabled: true,
      storyStep: "streaming",
      spotlightAssertionId: null,
      evidenceDemandHighlight: false,
      composerPrefill: null,
      focusedAssertionId: null,
      focusedEvidenceIds: [],
      suspendedFocus: null,
    }));
  },
  startJudgeShowcase: () => {
    set((state) => ({
      judgeModeActive: true,
      storyModeEnabled: true,
      storyStep: "streaming",
      spotlightAssertionId: null,
      evidenceDemandHighlight: false,
      composerPrefill: null,
      focusedAssertionId: null,
      focusedEvidenceIds: [],
      suspendedFocus: null,
      showcaseRunId: state.showcaseRunId + 1,
    }));
  },
  stopJudgeMode: () => {
    set({
      judgeModeActive: false,
      spotlightAssertionId: null,
      evidenceDemandHighlight: false,
    });
  },
  setSpotlightAssertionId: (id) => {
    set({ spotlightAssertionId: id });
  },
  setEvidenceDemandHighlight: (on) => {
    set({ evidenceDemandHighlight: on });
  },
  setComposerPrefill: (value) => {
    set({
      composerPrefill: value,
      evidenceDemandHighlight: true,
      // Ensure the composer is visible on mobile when Evidence Demand fires.
      ...(value ? { activePanel: "chat" as const, mobileNavOpen: false } : {}),
    });
  },
  clearComposerPrefill: () => {
    set({ composerPrefill: null });
  },
  dismissDemoLanding: () => {
    set({ demoLandingDismissed: true });
  },
  setReplay: ({ phase, eventId = null, isReplaying = true }) => {
    set((state) => {
      const suspending =
        state.focusedAssertionId !== null
          ? {
              assertionId: state.focusedAssertionId,
              evidenceIds: state.focusedEvidenceIds,
            }
          : state.suspendedFocus;

      return {
        replayPhase: phase,
        replayEventId: eventId,
        isReplaying,
        focusedAssertionId: null,
        focusedEvidenceIds: [],
        suspendedFocus: suspending,
        highlightCategory: null,
        // Replay must not leave Story guide timers driving the UI.
        spotlightAssertionId: isReplaying ? null : state.spotlightAssertionId,
        evidenceDemandHighlight: isReplaying ? false : state.evidenceDemandHighlight,
      };
    });
  },
  stopReplay: () => {
    set((state) => {
      const restored = state.suspendedFocus;
      return {
        replayPhase: null,
        replayEventId: null,
        isReplaying: false,
        focusedAssertionId: restored?.assertionId ?? null,
        focusedEvidenceIds: restored?.evidenceIds ?? [],
        suspendedFocus: null,
      };
    });
  },
}));
