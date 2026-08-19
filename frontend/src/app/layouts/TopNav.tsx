import { Eye, PanelLeft, Settings, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

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
}

export function TopNav({ connection = "offline" }: TopNavProps) {
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

  const [isAudioMuted, setIsAudioMuted] = useState(false);

  useEffect(() => {
    setIsAudioMuted(hudAudio.isMuted());
  }, []);

  const handleToggleAudio = () => {
    const muted = hudAudio.toggleMute();
    setIsAudioMuted(muted);
    if (!muted) hudAudio.playClick(1500);
  };

  const link = connection === "offline" ? storeConnection : connection;
  const conversationTitle =
    conversations.find((item) => item.id === activeConversationId)?.title ?? "New research inquiry";

  const totalClaims = responseAnalysis?.sentences?.filter((s) => s.category === "claim").length ?? 0;
  const totalSources = retrievedSources.length;
  const hasAnalysis = totalClaims > 0 || totalSources > 0;

  return (
    <header className="relative z-30 flex h-13 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#070b16]/75 px-3 backdrop-blur-2xl sm:px-4">
      {/* Left: Sidebar Toggle & Brand */}
      <div className="flex items-center gap-2">
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
          className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          title="Toggle history (Ctrl+B)"
          aria-label="Toggle history"
        >
          <PanelLeft className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            hudAudio.playChirp();
            void newChat();
          }}
          className="group flex items-center gap-2.5 rounded-lg px-2 py-1 transition hover:bg-white/[0.04]"
        >
          <XplainAiLogo size={24} />
          <span className="font-display text-sm font-semibold tracking-tight text-white group-hover:text-cyan-300 transition-colors">
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
            title={`Telemetry connection: ${link}`}
          />
        </button>
      </div>

      {/* Center: Conversation Title */}
      <div className="hidden max-w-sm truncate text-center md:block">
        <span className="text-xs font-mono text-slate-400 tracking-wide">
          {conversationTitle}
        </span>
      </div>

      {/* Right: Quick Tools, Model Selector, Analysis Pill, Settings */}
      {/* Right: Audio SFX Toggle, Analysis Pill, Model Selector, Settings */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Audio SFX Toggle */}
        <button
          type="button"
          onClick={handleToggleAudio}
          className={cn(
            "flex size-8 items-center justify-center rounded-lg transition",
            isAudioMuted
              ? "text-zinc-600 hover:text-zinc-400"
              : "text-cyan-400/80 hover:bg-cyan-500/10 hover:text-cyan-300",
          )}
          title={isAudioMuted ? "Unmute audio SFX" : "Mute audio SFX"}
        >
          {isAudioMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>

        {/* Analysis Cockpit Toggle */}
        {hasAnalysis ? (
          <button
            type="button"
            onClick={() => {
              hudAudio.playSweep();
              toggleInspector();
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono transition",
              inspectorOpen
                ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200",
            )}
            title="Inspect 3D Knowledge Graph & Claims"
          >
            <Eye className="size-3.5 text-cyan-400" />
            <span>Analysis</span>
            <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.2 text-[10px] text-cyan-300 border border-cyan-500/30">
              {totalSources > 0 ? `${totalSources} sources` : `${totalClaims} claims`}
            </span>
          </button>
        ) : null}

        <ModelSelector />

        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8 text-slate-400 hover:bg-white/[0.06] hover:text-white"
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
