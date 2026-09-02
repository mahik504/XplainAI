import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect } from "react";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ResearchCanvas } from "@/features/workspace";
import { StoryGuide } from "@/features/demo";
import { HistorySidebar } from "@/features/history";
import { useStoryOrchestration } from "@/hooks/use-story-orchestration";
import { useConversationStore } from "@/stores/conversation-store";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

export function WorkspacePage() {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const storyModeEnabled = useUIStore((state) => state.storyModeEnabled);
  const storyStep = useUIStore((state) => state.storyStep);
  const judgeModeActive = useUIStore((state) => state.judgeModeActive);
  const setStoryModeEnabled = useUIStore((state) => state.setStoryModeEnabled);
  const setStoryStep = useUIStore((state) => state.setStoryStep);
  const stopJudgeMode = useUIStore((state) => state.stopJudgeMode);

  const sendMessage = useSessionStore((state) => state.sendMessage);
  const retryLast = useSessionStore((state) => state.retryLast);
  const stop = useSessionStore((state) => state.stop);
  const runMode = useSessionStore((state) => state.runMode);

  const ensureActiveConversation = useConversationStore((state) => state.ensureActiveConversation);
  const setConversationMode = useConversationStore((state) => state.setConversationMode);
  const hydrateConversations = useConversationStore((state) => state.hydrate);

  useStoryOrchestration();

  useEffect(() => {
    void hydrateConversations();
  }, [hydrateConversations]);

  const handleManualSend = useCallback(
    (text: string) => {
      setStoryModeEnabled(false);
      stopJudgeMode();
      setStoryStep(null);
      void (async () => {
        const conversationId = await ensureActiveConversation();
        if (conversationId) {
          setConversationMode(conversationId, runMode);
          const shortTitle = text.slice(0, 48) + (text.length > 48 ? "…" : "");
          useConversationStore.getState().updateConversationTitle(conversationId, shortTitle);
        }
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
    <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-transparent">
      {/* Collapsible History Sidebar */}
      <AnimatePresence initial={false}>
        {!sidebarCollapsed && (
          <motion.div
            key="history-sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="h-full shrink-0 overflow-hidden"
          >
            <HistorySidebar className="h-full w-[260px]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Spacious Research Workspace Canvas */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ErrorBoundary fallbackType="panel" title="Research Canvas Error">
          <ResearchCanvas
            className="size-full"
            onSend={handleManualSend}
            onStop={stop}
            onRetry={handleRetry}
          />
        </ErrorBoundary>
        {storyGuide}
      </main>
    </div>
  );
}

