import { useEffect, useCallback } from "react";
import { hudAudio } from "@/features/audio/audio-sfx";
import { useUIStore } from "@/stores/ui-store";

export interface ShortcutDefinition {
  id: string;
  key: string;
  ctrlOrMeta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: "Navigation" | "Cockpit & Views" | "Actions" | "System";
  allowInInput?: boolean;
  action: () => void;
}

export const SHORTCUT_CATEGORIES = [
  "Navigation",
  "Cockpit & Views",
  "Actions",
  "System",
] as const;

export function useKeyboardShortcuts(customShortcuts: ShortcutDefinition[] = []) {
  const toggleCommandPalette = useUIStore((state) => state.toggleCommandPalette);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const toggleInspector = useUIStore((state) => state.toggleInspector);
  const toggleShortcutsModal = useUIStore((state) => state.toggleShortcutsModal);
  const toggleSoundMuted = useUIStore((state) => state.toggleSoundMuted);
  const setCommandPaletteOpen = useUIStore((state) => state.setCommandPaletteOpen);
  const setShortcutsModalOpen = useUIStore((state) => state.setShortcutsModalOpen);
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen);
  const exitClaimFocus = useUIStore((state) => state.exitClaimFocus);
  const focusedAssertionId = useUIStore((state) => state.focusedAssertionId);
  const commandPaletteOpen = useUIStore((state) => state.commandPaletteOpen);
  const shortcutsModalOpen = useUIStore((state) => state.shortcutsModalOpen);
  const settingsOpen = useUIStore((state) => state.settingsOpen);
  const graphSurface = useUIStore((state) => state.graphSurface);
  const setGraphSurface = useUIStore((state) => state.setGraphSurface);

  const defaultShortcuts: ShortcutDefinition[] = [
    {
      id: "command-palette",
      key: "k",
      ctrlOrMeta: true,
      description: "Open Command Palette",
      category: "Navigation",
      allowInInput: true,
      action: () => {
        hudAudio.playSweep();
        toggleCommandPalette();
      },
    },
    {
      id: "toggle-sidebar",
      key: "b",
      ctrlOrMeta: true,
      description: "Toggle History Sidebar",
      category: "Navigation",
      allowInInput: true,
      action: () => {
        hudAudio.playClick(1000);
        toggleSidebar();
      },
    },
    {
      id: "toggle-inspector",
      key: "i",
      ctrlOrMeta: true,
      description: "Toggle Explainability Cockpit",
      category: "Cockpit & Views",
      allowInInput: true,
      action: () => {
        hudAudio.playClick(1100);
        toggleInspector();
      },
    },
    {
      id: "toggle-graph-surface",
      key: "g",
      ctrlOrMeta: true,
      description: "Toggle Pipeline ↔ Topology Graph",
      category: "Cockpit & Views",
      allowInInput: true,
      action: () => {
        hudAudio.playClick(1200);
        setGraphSurface(graphSurface === "pipeline" ? "structure" : "pipeline");
      },
    },
    {
      id: "shortcuts-help",
      key: "?",
      description: "Open Keyboard Shortcuts Help",
      category: "System",
      allowInInput: false,
      action: () => {
        hudAudio.playClick(1400);
        toggleShortcutsModal();
      },
    },
    {
      id: "shortcuts-help-alt",
      key: "/",
      ctrlOrMeta: true,
      description: "Open Keyboard Shortcuts Help",
      category: "System",
      allowInInput: true,
      action: () => {
        hudAudio.playClick(1400);
        toggleShortcutsModal();
      },
    },
    {
      id: "toggle-sound",
      key: "M",
      ctrlOrMeta: true,
      shift: true,
      description: "Toggle Cyber Audio SFX",
      category: "System",
      allowInInput: true,
      action: () => {
        toggleSoundMuted();
      },
    },
    {
      id: "dismiss-or-exit",
      key: "Escape",
      description: "Dismiss Modals / Exit Claim Focus",
      category: "Actions",
      allowInInput: true,
      action: () => {
        if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
          return;
        }
        if (shortcutsModalOpen) {
          setShortcutsModalOpen(false);
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        if (focusedAssertionId !== null) {
          exitClaimFocus();
        }
      },
    },
  ];

  const allShortcuts = [...defaultShortcuts, ...customShortcuts];

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      for (const shortcut of allShortcuts) {
        const keyMatch =
          shortcut.key.toLowerCase() === event.key.toLowerCase() ||
          (shortcut.key === "?" && (event.key === "?" || (event.key === "/" && event.shiftKey)));

        if (!keyMatch) continue;

        const ctrlOrMetaRequired = Boolean(shortcut.ctrlOrMeta);
        const ctrlOrMetaPressed = event.ctrlKey || event.metaKey;
        if (ctrlOrMetaRequired !== ctrlOrMetaPressed) continue;

        const shiftRequired = Boolean(shortcut.shift);
        // For '?', shiftKey may be naturally pressed; ignore shift requirement check if key is '?'
        if (shortcut.key !== "?" && shiftRequired !== event.shiftKey) continue;

        const altRequired = Boolean(shortcut.alt);
        if (altRequired !== event.altKey) continue;

        if (isInput && !shortcut.allowInInput) {
          continue;
        }

        event.preventDefault();
        shortcut.action();
        return;
      }
    },
    [allShortcuts],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return { shortcuts: allShortcuts };
}
