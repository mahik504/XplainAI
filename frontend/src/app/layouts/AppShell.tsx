import { type CSSProperties } from "react";
import { Outlet } from "react-router-dom";

import { AmbientShaderBackground } from "@/components/common/AmbientShaderBackground";
import { HistorySidebar } from "@/features/history";
import { VoiceInputModal } from "@/features/voice/VoiceInputModal";
import { HolographicVisionScanner } from "@/features/vision/HolographicVisionScanner";
import { useSessionConnection } from "@/hooks/use-session-connection";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

import { SettingsDrawer } from "./SettingsDrawer";
import { TopNav } from "./TopNav";

export function AppShell() {
  useSessionConnection();

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
    <div
      style={{ "--glass-strength": glassStrength } as CSSProperties}
      className="relative flex h-dvh w-full overflow-hidden bg-[#030712] text-foreground"
    >
      <AmbientShaderBackground />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopNav connection={connection} />
        <main className="relative min-h-0 flex-1 px-2 pt-2 pb-2 sm:px-3 sm:pb-3">
          <Outlet />
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
  );
}
