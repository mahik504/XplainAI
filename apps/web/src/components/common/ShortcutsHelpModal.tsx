import React from "react";
import { Keyboard, Command as CommandIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUIStore } from "@/stores/ui-store";

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  items: ShortcutItem[];
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: "Navigation & Menus",
    items: [
      { keys: ["Ctrl", "K"], description: "Open Command Palette" },
      { keys: ["Ctrl", "B"], description: "Toggle History Sidebar" },
      { keys: ["Ctrl", "I"], description: "Toggle Explainability Cockpit" },
    ],
  },
  {
    title: "Views & Visualizers",
    items: [
      { keys: ["Ctrl", "G"], description: "Toggle Pipeline ↔ Topology Graph" },
      { keys: ["Escape"], description: "Dismiss modal / Exit claim focus mode" },
    ],
  },
  {
    title: "Composer & Interaction",
    items: [
      { keys: ["Enter"], description: "Submit inquiry / message" },
      { keys: ["Shift", "Enter"], description: "Insert new line in composer" },
    ],
  },
  {
    title: "System & Audio",
    items: [
      { keys: ["?"], description: "Open keyboard shortcuts help" },
      { keys: ["Ctrl", "/"], description: "Open keyboard shortcuts help (alt)" },
      { keys: ["Ctrl", "Shift", "M"], description: "Toggle procedural audio SFX" },
    ],
  },
];

export function ShortcutsHelpModal() {
  const shortcutsModalOpen = useUIStore((state) => state.shortcutsModalOpen);
  const setShortcutsModalOpen = useUIStore((state) => state.setShortcutsModalOpen);

  return (
    <Dialog open={shortcutsModalOpen} onOpenChange={setShortcutsModalOpen}>
      <DialogContent className="max-w-lg border-white/10 bg-[#0a0f1d]/98 p-6 shadow-2xl backdrop-blur-2xl">
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-2.5 text-cyan-400">
            <div className="flex size-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10">
              <Keyboard className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-white">
                Keyboard Shortcuts
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-mono">
                Global hotkeys & navigation commands
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 font-mono">
          {SHORTCUT_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-2">
              <h4 className="text-[11px] font-semibold tracking-wider text-cyan-400/80 uppercase">
                {section.title}
              </h4>
              <div className="space-y-1.5 rounded-xl border border-white/[0.06] bg-black/40 p-2.5">
                {section.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-slate-300 font-sans text-xs">{item.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, idx) => (
                        <React.Fragment key={idx}>
                          <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-white/15 bg-white/[0.08] px-1.5 text-[10px] font-semibold text-cyan-200 shadow-sm">
                            {k === "Ctrl" ? (
                              <span className="flex items-center gap-0.5">
                                <CommandIcon className="size-2.5 opacity-70" />
                                <span>/Ctrl</span>
                              </span>
                            ) : (
                              k
                            )}
                          </kbd>
                          {idx < item.keys.length - 1 && (
                            <span className="text-[10px] text-slate-500">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
