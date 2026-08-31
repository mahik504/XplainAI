import { type CSSProperties } from "react";
import { Outlet } from "react-router-dom";

import { AsciiTerrainBackground } from "@/components/common/AsciiTerrainBackground";
import { AmbientShaderBackground } from "@/components/common/AmbientShaderBackground";
import { CommandPalette } from "@/components/common/CommandPalette";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ShortcutsHelpModal } from "@/components/common/ShortcutsHelpModal";
import { HistorySidebar } from "@/features/history";
import { VoiceInputModal } from "@/features/voice/VoiceInputModal";
import { HolographicVisionScanner } from "@/features/vision/HolographicVisionScanner";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useSessionConnection } from "@/hooks/use-session-connection";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

import { SettingsDrawer } from "./SettingsDrawer";
import { TopNav } from "./TopNav";

export function AppShell() {
  useSessionConnection();
  useKeyboardShortcuts();

  const glassStrength = useUIStore((state) => state.glassStrength);
  const mobileNavOpen = useUIStore((state) => state.mobileNavOpen);
  const setMobileNavOpen = useUIStore((state) => state.setMobileNavOpen);
  const setComposerPrefill = useUIStore((state) => state.setComposerPrefill);
  const voiceModalOpen = useUIStore((state) => state.voiceModalOpen);
  const visionModalOpen = useUIStore((state) => state.visionModalOpen);
  const setVoiceModalOpen = useUIStore((state) => state.setVoiceModalOpen);
  const setVisionModalOpen = useUIStore((state) => state.setVisionModalOpen);
  const connection = useSessionStore((state) => state.connection);

  const handleVoiceTranscribed = (text: string) => {
    setComposerPrefill(text);
  };

  const handleVisionCaptured = (_imgUrl: string, promptText: string) => {
    setComposerPrefill(promptText);
  };

  return (
    <ErrorBoundary fallbackType="full">
      <div
        style={{ "--glass-strength": glassStrength } as CSSProperties}
        className="relative flex h-dvh w-full overflow-hidden bg-[#05070D] text-foreground font-sans"
      >
        <AsciiTerrainBackground />
        <AmbientShaderBackground />

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <TopNav connection={connection} />
          <main className="relative min-h-0 flex-1 overflow-hidden p-0">
            <ErrorBoundary fallbackType="full">
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-[min(20rem,88vw)] border-white/10 bg-[#070b16] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Conversation history</SheetTitle>
            </SheetHeader>
            <HistorySidebar className="h-full w-full border-0" />
          </SheetContent>
        </Sheet>

        <SettingsDrawer />

        <CommandPalette />
        <ShortcutsHelpModal />

        <VoiceInputModal
          isOpen={voiceModalOpen}
          onClose={() => setVoiceModalOpen(false)}
          onTranscribed={handleVoiceTranscribed}
        />

        <HolographicVisionScanner
          isOpen={visionModalOpen}
          onClose={() => setVisionModalOpen(false)}
          onCapture={handleVisionCaptured}
        />
      </div>
    </ErrorBoundary>
  );
}
