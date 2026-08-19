import { Eye, PanelLeft, Settings } from "lucide-react";

import { HUDControls } from "@/components/brand/HUDControls";
import { ModelSelector } from "@/components/brand/ModelSelector";
import { XplainAiLogo } from "@/components/brand/XplainAiLogo";
import { Button } from "@/components/ui/button";
import { hudAudio } from "@/features/audio/audio-sfx";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/stores/conversation-store";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

export type ConnectionState = "offline" | "connecting" | "live";

interface TopNavProps {
  connection?: ConnectionState;
  onOpenVoice?: () => void;
  onOpenVision?: () => void;
}

export function TopNav({
  connection = "offline",
  onOpenVoice = () => {},
  onOpenVision = () => {},
}: TopNavProps) {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const setMobileNavOpen = useUIStore((state) => state.setMobileNavOpen);
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen);
  const inspectorOpen = useUIStore((state) => state.inspectorOpen);
  const toggleInspector = useUIStore((state) => state.toggleInspector);

  const storeConnection = useSessionStore((state) => state.connection);
  const retrievedSources = useSessionStore((state) => state.retrievedSources);
  const responseAnalysis = useSessionStore((state) => state.responseAnalysis);

  const conversations = useConversationStore((state) => state.conversations);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const newChat = useConversationStore((state) => state.newChat);

  const link = connection === "offline" ? storeConnection : connection;
  const conversationTitle =
    conversations.find((item) => item.id === activeConversationId)?.title ?? "New inquiry";

  const totalClaims = responseAnalysis?.sentences?.filter((s) => s.category === "claim").length ?? 0;
  const totalSources = retrievedSources.length;
  const hasAnalysis = totalClaims > 0 || totalSources > 0;

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center justify-between border-b border-rose-950/60 bg-[#060408]/95 px-3 backdrop-blur-xl sm:px-4 font-mono">
      {/* Left section: Sidebar toggle & Logo */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            hudAudio.playClick();
            if (window.innerWidth < 1024) {
              setMobileNavOpen(true);
            } else {
              toggleSidebar();
            }
          }}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-rose-950/40 hover:text-rose-300"
          title="Toggle sidebar (Ctrl+B)"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            hudAudio.playChirp();
            void newChat();
          }}
          className="group flex items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-rose-950/30"
        >
          <XplainAiLogo size={24} />
          <span className="font-display text-sm font-semibold tracking-tight text-foreground group-hover:text-rose-200">
            XplainAI
          </span>
          <span
            className={cn(
              "size-1.5 rounded-full",
              link === "live"
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                : link === "connecting"
                  ? "bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                  : "bg-zinc-600",
            )}
            title={`Connection: ${link}`}
          />
        </button>
      </div>

      {/* Center: Conversation Title */}
      <div className="hidden max-w-sm truncate text-center md:block">
        <span className="text-xs font-medium text-muted-foreground/80 font-mono tracking-wide">
          {conversationTitle}
        </span>
      </div>

      {/* Right section: HUD Controls, Model selector, Inspector toggle, Settings */}
      <div className="flex items-center gap-2">
        <HUDControls onOpenVoice={onOpenVoice} onOpenVision={onOpenVision} />

        {hasAnalysis ? (
          <button
            type="button"
            onClick={() => {
              hudAudio.playSweep();
              toggleInspector();
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition font-mono",
              inspectorOpen
                ? "border-rose-500/60 bg-rose-500/15 text-rose-300 shadow-[0_0_12px_rgba(225,29,72,0.3)]"
                : "border-rose-950/70 bg-rose-950/20 text-rose-300/80 hover:border-rose-500/40 hover:bg-rose-950/40 hover:text-rose-200",
            )}
            title="Inspect Claims & 3D Knowledge Graph"
          >
            <Eye className="size-3.5 text-rose-400" />
            <span>Analysis</span>
            <span className="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] text-rose-300 border border-rose-500/30">
              {totalSources > 0 ? `${totalSources} sources` : `${totalClaims} claims`}
            </span>
          </button>
        ) : null}

        <ModelSelector />

        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8 text-muted-foreground hover:bg-rose-950/40 hover:text-rose-200"
          onClick={() => {
            hudAudio.playClick();
            setSettingsOpen(true);
          }}
          aria-label="Open settings"
        >
          <Settings className="size-4" />
        </Button>
      </div>
    </header>
  );
}
