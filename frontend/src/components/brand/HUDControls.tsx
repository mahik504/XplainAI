import { Camera, Mic, Volume2, VolumeX } from "lucide-react";
import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { hudAudio } from "@/features/audio/audio-sfx";
import { cn } from "@/lib/utils";

interface HUDControlsProps {
  onOpenVoice: () => void;
  onOpenVision: () => void;
  className?: string;
}

export type HUDTheme = "ultron" | "jarvis" | "stark";

export const HUDControls: React.FC<HUDControlsProps> = ({
  onOpenVoice,
  onOpenVision,
  className,
}) => {
  const [muted, setMuted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<HUDTheme>("ultron");

  useEffect(() => {
    setMuted(hudAudio.isMuted());
    const savedTheme = (localStorage.getItem("xplainai_hud_theme") as HUDTheme) || "ultron";
    setCurrentTheme(savedTheme);
    document.documentElement.setAttribute("data-hud-theme", savedTheme);
  }, []);

  const handleToggleMute = () => {
    const next = hudAudio.toggleMute();
    setMuted(next);
    if (!next) {
      hudAudio.playChirp();
    }
  };

  const handleThemeChange = (theme: HUDTheme) => {
    hudAudio.playClick(1600);
    setCurrentTheme(theme);
    localStorage.setItem("xplainai_hud_theme", theme);
    document.documentElement.setAttribute("data-hud-theme", theme);
  };

  return (
    <div className={cn("flex items-center gap-1.5 font-mono", className)}>
      {/* Theme Matrix Pill */}
      <div className="flex items-center rounded-lg border border-rose-950/80 bg-black/50 p-0.5">
        <button
          type="button"
          title="Jarvis Holographic Cyan"
          onClick={() => handleThemeChange("jarvis")}
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-bold transition",
            currentTheme === "jarvis"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_8px_rgba(6,182,212,0.4)]"
              : "text-zinc-500 hover:text-cyan-300",
          )}
        >
          JARVIS
        </button>
        <button
          type="button"
          title="Ultron Laser Crimson"
          onClick={() => handleThemeChange("ultron")}
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-bold transition",
            currentTheme === "ultron"
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-[0_0_8px_rgba(225,29,72,0.4)]"
              : "text-zinc-500 hover:text-rose-300",
          )}
        >
          ULTRON
        </button>
        <button
          type="button"
          title="Stark Tactical Gold"
          onClick={() => handleThemeChange("stark")}
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-bold transition",
            currentTheme === "stark"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
              : "text-zinc-500 hover:text-amber-300",
          )}
        >
          STARK
        </button>
      </div>

      {/* Voice Trigger */}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          hudAudio.playSweep();
          onOpenVoice();
        }}
        className="size-8 p-0 text-zinc-400 hover:border-rose-500/50 hover:bg-rose-950/40 hover:text-rose-200"
        title="Voice Telemetry Cockpit"
      >
        <Mic className="size-3.5 text-rose-400" />
      </Button>

      {/* Vision Scanner Trigger */}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          hudAudio.playSweep();
          onOpenVision();
        }}
        className="size-8 p-0 text-zinc-400 hover:border-rose-500/50 hover:bg-rose-950/40 hover:text-rose-200"
        title="Holographic Camera Vision Scanner"
      >
        <Camera className="size-3.5 text-cyan-400" />
      </Button>

      {/* Audio SFX Toggle */}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={handleToggleMute}
        className={cn(
          "size-8 p-0 transition",
          muted
            ? "text-zinc-600 hover:text-zinc-400"
            : "text-rose-400 hover:bg-rose-950/40 hover:text-rose-200",
        )}
        title={muted ? "Unmute HUD Audio SFX" : "Mute HUD Audio SFX"}
      >
        {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5 animate-pulse" />}
      </Button>
    </div>
  );
};
