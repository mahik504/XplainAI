import {
  Bot,
  Download,
  FileText,
  Folder,
  Keyboard,
  Layers,
  Plus,
  Settings,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { hudAudio } from "@/features/audio/audio-sfx";
import {
  exportConversationAsJson,
  exportConversationAsMarkdown,
} from "@/lib/conversation-export";
import type { RunMode } from "@/lib/run-mode";
import { useConversationStore } from "@/stores/conversation-store";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

export function CommandPalette() {
  const commandPaletteOpen = useUIStore((state) => state.commandPaletteOpen);
  const setCommandPaletteOpen = useUIStore((state) => state.setCommandPaletteOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const toggleInspector = useUIStore((state) => state.toggleInspector);
  const graphSurface = useUIStore((state) => state.graphSurface);
  const setGraphSurface = useUIStore((state) => state.setGraphSurface);
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen);
  const setShortcutsModalOpen = useUIStore((state) => state.setShortcutsModalOpen);
  const soundMuted = useUIStore((state) => state.soundMuted);
  const toggleSoundMuted = useUIStore((state) => state.toggleSoundMuted);

  const newChat = useConversationStore((state) => state.newChat);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const conversations = useConversationStore((state) => state.conversations);

  const activeModel = useSessionStore((state) => state.activeModel);
  const setActiveModel = useSessionStore((state) => state.setActiveModel);
  const runMode = useSessionStore((state) => state.runMode);
  const setRunMode = useSessionStore((state) => state.setRunMode);
  const messages = useSessionStore((state) => state.messages);
  const responseAnalysis = useSessionStore((state) => state.responseAnalysis);
  const retrievedSources = useSessionStore((state) => state.retrievedSources);
  const missingContext = useSessionStore((state) => state.missingContext);
  const counterPerspective = useSessionStore((state) => state.counterPerspective);
  const graphNodes = useSessionStore((state) => state.graphNodes);
  const graphEdges = useSessionStore((state) => state.graphEdges);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const sessionTitle = activeConversation?.title || (messages[0]?.content.slice(0, 32) ?? "Active Research Session");

  const runAction = (fn: () => void) => {
    hudAudio.playChirp();
    setCommandPaletteOpen(false);
    fn();
  };

  const handleExportMarkdown = () => {
    runAction(() => {
      exportConversationAsMarkdown({
        id: activeConversationId ?? undefined,
        title: sessionTitle,
        modelId: activeModel,
        runMode,
        messages,
        responseAnalysis,
        retrievedSources,
        missingContext,
        counterPerspective,
        graphNodes,
        graphEdges,
      });
    });
  };

  const handleExportJson = () => {
    runAction(() => {
      exportConversationAsJson({
        id: activeConversationId ?? undefined,
        title: sessionTitle,
        modelId: activeModel,
        runMode,
        messages,
        responseAnalysis,
        retrievedSources,
        missingContext,
        counterPerspective,
        graphNodes,
        graphEdges,
      });
    });
  };

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
      title="XplainAI Command Center"
      description="Quick actions, AI model routing, and workspace controls"
    >
      <CommandInput placeholder="Search commands, switch models, export sessions..." />
      <CommandList>
        <CommandEmpty>No matching command found.</CommandEmpty>

        {/* 1. Quick Inquiries & Navigation */}
        <CommandGroup heading="Actions & Navigation">
          <CommandItem onSelect={() => runAction(() => void newChat())}>
            <Plus className="mr-2 size-4 text-cyan-400" />
            <span>New Research Inquiry</span>
            <CommandShortcut>New</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runAction(toggleSidebar)}>
            <Folder className="mr-2 size-4 text-cyan-400" />
            <span>Toggle History Sidebar</span>
            <CommandShortcut>Ctrl+B</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runAction(toggleInspector)}>
            <Sparkles className="mr-2 size-4 text-cyan-400" />
            <span>Toggle Explainability Cockpit</span>
            <CommandShortcut>Ctrl+I</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() =>
              runAction(() =>
                setGraphSurface(graphSurface === "pipeline" ? "structure" : "pipeline")
              )
            }
          >
            <Layers className="mr-2 size-4 text-cyan-400" />
            <span>Toggle Pipeline ↔ Topology Graph</span>
            <CommandShortcut>Ctrl+G</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={handleExportMarkdown}>
            <FileText className="mr-2 size-4 text-emerald-400" />
            <span>Export Session as Markdown Report</span>
            <CommandShortcut>.md</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={handleExportJson}>
            <Download className="mr-2 size-4 text-emerald-400" />
            <span>Export Session as JSON Data</span>
            <CommandShortcut>.json</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* 2. Research Modes */}
        <CommandGroup heading="Research Modes">
          {(
            [
              { id: "deep_research", label: "Deep Research", icon: Zap, desc: "Full web grounding & citation mapping" },
              { id: "quick_synthesis", label: "Quick Synthesis", icon: Bot, desc: "Fast direct model synthesis" },
              { id: "epistemic_audit", label: "Epistemic Audit", icon: Sparkles, desc: "Rigorous claim verification" },
            ] as const
          ).map((mode) => (
            <CommandItem
              key={mode.id}
              selected={runMode === mode.id}
              onSelect={() => runAction(() => setRunMode(mode.id as RunMode))}
            >
              <mode.icon className="mr-2 size-4 text-cyan-400" />
              <div className="flex flex-col">
                <span className="font-semibold text-white">{mode.label}</span>
                <span className="text-[10px] text-slate-400">{mode.desc}</span>
              </div>
              {runMode === mode.id && <CommandShortcut>Active</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* 3. AI Models */}
        <CommandGroup heading="AI Models">
          {[
            { id: "deepseek-r1", name: "DeepSeek R1 (Reasoning)", tier: "Primary" },
            { id: "gpt-4o", name: "GPT-4o (Omni)", tier: "OpenAI" },
            { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", tier: "Anthropic" },
            { id: "llama-3.3-70b", name: "Llama 3.3 70B (Instruct)", tier: "Meta" },
            { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", tier: "Google" },
          ].map((m) => (
            <CommandItem
              key={m.id}
              selected={activeModel === m.id}
              onSelect={() => runAction(() => setActiveModel(m.id))}
            >
              <Bot className="mr-2 size-4 text-violet-400" />
              <span>{m.name}</span>
              <CommandShortcut>{m.tier}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* 4. Preferences & System */}
        <CommandGroup heading="System & Help">
          <CommandItem onSelect={() => runAction(() => setSettingsOpen(true))}>
            <Settings className="mr-2 size-4 text-slate-300" />
            <span>Preferences & BYOK API Keys</span>
          </CommandItem>

          <CommandItem onSelect={() => runAction(toggleSoundMuted)}>
            {soundMuted ? (
              <VolumeX className="mr-2 size-4 text-amber-400" />
            ) : (
              <Volume2 className="mr-2 size-4 text-cyan-400" />
            )}
            <span>{soundMuted ? "Unmute Audio SFX" : "Mute Audio SFX"}</span>
            <CommandShortcut>Ctrl+Shift+M</CommandShortcut>
          </CommandItem>

          <CommandItem onSelect={() => runAction(() => setShortcutsModalOpen(true))}>
            <Keyboard className="mr-2 size-4 text-cyan-400" />
            <span>Keyboard Shortcuts Cheat Sheet</span>
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
