import { Eye, PanelLeft, Settings } from "lucide-react";

import { ModelSelector } from "@/components/brand/ModelSelector";
import { XplainAiLogo } from "@/components/brand/XplainAiLogo";
import { Button } from "@/components/ui/button";
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

  const link = connection === "offline" ? storeConnection : connection;
  const conversationTitle =
    conversations.find((item) => item.id === activeConversationId)?.title ?? "New inquiry";

  const totalClaims = responseAnalysis?.sentences?.filter((s) => s.category === "claim").length ?? 0;
  const totalSources = retrievedSources.length;
  const hasAnalysis = totalClaims > 0 || totalSources > 0;

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center justify-between border-b border-border/40 bg-[#09090b]/90 px-3 backdrop-blur-md sm:px-4">
      {/* Left section: Sidebar toggle & Logo */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            if (window.innerWidth < 1024) {
              setMobileNavOpen(true);
            } else {
              toggleSidebar();
            }
          }}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
          title="Toggle sidebar (Ctrl+B)"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => void newChat()}
          className="group flex items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/[0.04]"
        >
          <XplainAiLogo size={24} />
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            XplainAI
          </span>
          <span
            className={cn(
              "size-1.5 rounded-full",
              link === "live"
                ? "bg-emerald-500"
                : link === "connecting"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-zinc-600",
            )}
            title={`Connection: ${link}`}
          />
        </button>
      </div>

      {/* Center: Conversation Title */}
      <div className="hidden max-w-sm truncate text-center md:block">
        <span className="text-xs font-medium text-muted-foreground/80">{conversationTitle}</span>
      </div>

      {/* Right section: Model selector, Inspector toggle, Settings */}
      <div className="flex items-center gap-2">
        {hasAnalysis ? (
          <button
            type="button"
            onClick={toggleInspector}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition",
              inspectorOpen
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/60 bg-white/[0.02] text-muted-foreground hover:border-border hover:bg-white/[0.05] hover:text-foreground",
            )}
            title="Inspect Claims & 3D Knowledge Graph"
          >
            <Eye className="size-3.5" />
            <span className="hidden sm:inline">Analysis</span>
            <span className="rounded-full bg-white/[0.08] px-1.5 py-0.2 text-[10px] font-mono">
              {totalSources > 0 ? `${totalSources} sources` : `${totalClaims} claims`}
            </span>
          </button>
        ) : null}

        <ModelSelector />

        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8 rounded-lg text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          <Settings className="size-4" />
          <span className="sr-only">Open settings</span>
        </Button>
      </div>
    </header>
  );
}

