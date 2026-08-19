import { useState, type CSSProperties } from "react";
import { Outlet } from "react-router-dom";

import { AmbientBackground } from "@/components/common/AmbientBackground";
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

  const [voiceOpen, setVoiceOpen] = useState(false);
  const [visionOpen, setVisionOpen] = useState(false);

  const glassStrength = useUIStore((state) => state.glassStrength);
  const mobileNavOpen = useUIStore((state) => state.mobileNavOpen);
  const setMobileNavOpen = useUIStore((state) => state.setMobileNavOpen);
  const setComposerPrefill = useUIStore((state) => state.setComposerPrefill);
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
      className="relative flex h-dvh w-full overflow-hidden bg-[#060206] text-foreground"
    >
      <AmbientBackground />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopNav
          connection={connection}
          onOpenVoice={() => setVoiceOpen(true)}
          onOpenVision={() => setVisionOpen(true)}
        />
        <main className="relative min-h-0 flex-1 px-2 pt-2 pb-2 sm:px-3 sm:pb-3">
          <Outlet />
        </main>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(20rem,88vw)] border-border/50 bg-[#060206] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Conversation history</SheetTitle>
          </SheetHeader>
          <HistorySidebar className="h-full w-full border-0" />
        </SheetContent>
      </Sheet>

      <SettingsDrawer />

      <VoiceInputModal
        isOpen={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onTranscribed={handleVoiceTranscribed}
      />

      <HolographicVisionScanner
        isOpen={visionOpen}
        onClose={() => setVisionOpen(false)}
        onCapture={handleVisionCaptured}
      />
    </div>
  );
}
