import type { CSSProperties } from "react";
import { Outlet } from "react-router-dom";

import { AmbientBackground } from "@/components/common/AmbientBackground";
import { HistorySidebar } from "@/features/history";
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
  const connection = useSessionStore((state) => state.connection);

  return (
    <div
      style={{ "--glass-strength": glassStrength } as CSSProperties}
      className="relative flex h-dvh w-full overflow-hidden bg-[#0A0A0F] text-foreground"
    >
      <AmbientBackground />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopNav connection={connection} />
        <main className="relative min-h-0 flex-1 px-2 pt-2 pb-2 sm:px-3 sm:pb-3">
          <Outlet />
        </main>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(20rem,88vw)] border-border/50 bg-[#0A0A0F] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Conversation history</SheetTitle>
          </SheetHeader>
          <HistorySidebar className="h-full w-full border-0" />
        </SheetContent>
      </Sheet>

      <SettingsDrawer />
    </div>
  );
}
