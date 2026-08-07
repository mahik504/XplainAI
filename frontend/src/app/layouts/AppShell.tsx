import type { CSSProperties } from "react";
import { Outlet } from "react-router-dom";

import { AmbientBackground } from "@/components/common/AmbientBackground";
import { useSessionConnection } from "@/hooks/use-session-connection";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

import { SettingsDrawer } from "./SettingsDrawer";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function AppShell() {
  useSessionConnection();

  const glassStrength = useUIStore((state) => state.glassStrength);
  const connection = useSessionStore((state) => state.connection);

  return (
    <div
      style={{ "--glass-strength": glassStrength } as CSSProperties}
      className="relative flex h-dvh w-full overflow-hidden bg-background text-foreground"
    >
      <AmbientBackground />
      <Sidebar />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopNav connection={connection} title="Explainability OS" />
        <main className="relative min-h-0 flex-1 px-3 pt-2 pb-3 sm:px-4 sm:pb-4">
          <Outlet />
        </main>
      </div>

      <SettingsDrawer />
    </div>
  );
}
