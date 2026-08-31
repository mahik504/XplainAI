import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  Download,
  FileText,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { hudAudio } from "@/features/audio/audio-sfx";
import {
  exportConversationAsJson,
  exportConversationAsMarkdown,
} from "@/lib/conversation-export";
import { renameConversation } from "@/lib/conversations-api";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/stores/conversation-store";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

interface HistorySidebarProps {
  className?: string;
  compact?: boolean;
}

const ARCHIVED_STORAGE_KEY = "xplainai_archived_conversations";

function getArchivedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(ARCHIVED_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveArchivedSet(set: Set<string>) {
  try {
    localStorage.setItem(ARCHIVED_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage quota
  }
}

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const deltaSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (deltaSec < 60) return "just now";
  if (deltaSec < 3600) return `${String(Math.floor(deltaSec / 60))}m ago`;
  if (deltaSec < 86400) return `${String(Math.floor(deltaSec / 3600))}h ago`;
  if (deltaSec < 86400 * 7) return `${String(Math.floor(deltaSec / 86400))}d ago`;
  return new Date(then).toLocaleDateString([], { month: "short", day: "numeric" });
}

function getGroupKey(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "Previous";
  const now = Date.now();
  const diffDays = Math.floor((now - then) / (86400 * 1000));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "Previous 7 Days";
  if (diffDays < 30) return "Previous 30 Days";
  return "Older";
}

export function HistorySidebar({ className, compact = false }: HistorySidebarProps) {
  const conversations = useConversationStore((state) => state.conversations);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const loading = useConversationStore((state) => state.loading);
  const error = useConversationStore((state) => state.error);
  const hydrate = useConversationStore((state) => state.hydrate);
  const newChat = useConversationStore((state) => state.newChat);
  const openConversation = useConversationStore((state) => state.openConversation);
  const removeConversation = useConversationStore((state) => state.removeConversation);
  const clearAllConversations = useConversationStore((state) => state.clearAllConversations);

  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const setMobileNavOpen = useUIStore((state) => state.setMobileNavOpen);
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen);
  const saveHistoryEnabled = useUIStore((state) => state.saveHistoryEnabled);

  // Active session data for export
  const activeModel = useSessionStore((state) => state.activeModel);
  const runMode = useSessionStore((state) => state.runMode);
  const messages = useSessionStore((state) => state.messages);
  const responseAnalysis = useSessionStore((state) => state.responseAnalysis);
  const retrievedSources = useSessionStore((state) => state.retrievedSources);
  const missingContext = useSessionStore((state) => state.missingContext);
  const counterPerspective = useSessionStore((state) => state.counterPerspective);
  const graphNodes = useSessionStore((state) => state.graphNodes);
  const graphEdges = useSessionStore((state) => state.graphEdges);

  const [searchQuery, setSearchQuery] = useState("");
  const [historyTab, setHistoryTab] = useState<"active" | "archived">("active");
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => getArchivedSet());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [exportModalConv, setExportModalConv] = useState<{ id: string; title: string } | null>(null);
  const renameCommitLock = useRef(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const toggleArchive = (id: string) => {
    hudAudio.playClick(1400);
    setArchivedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveArchivedSet(next);
      return next;
    });
  };

  const commitRename = async (conversationId: string, nextTitle?: string) => {
    if (renameCommitLock.current) return;
    const title = (nextTitle ?? renameDraft).trim();
    if (!title) {
      setRenamingId(null);
      return;
    }
    renameCommitLock.current = true;
    try {
      await renameConversation(conversationId, title);
      setRenamingId(null);
      await hydrate();
    } finally {
      renameCommitLock.current = false;
    }
  };

  const displayedList = useMemo(() => {
    const isArchived = historyTab === "archived";
    const subset = conversations.filter((c) => (isArchived ? archivedIds.has(c.id) : !archivedIds.has(c.id)));
    if (!searchQuery.trim()) return subset;
    const q = searchQuery.toLowerCase();
    return subset.filter((c) => c.title.toLowerCase().includes(q));
  }, [archivedIds, conversations, historyTab, searchQuery]);

  const groupedConversations = useMemo(() => {
    const groups: Record<string, typeof displayedList> = {};
    for (const c of displayedList) {
      const key = getGroupKey(c.updated_at);
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return groups;
  }, [displayedList]);

  const activeCount = conversations.filter((c) => !archivedIds.has(c.id)).length;
  const archivedCount = conversations.filter((c) => archivedIds.has(c.id)).length;

  const conversationToDelete = conversations.find((c) => c.id === deleteConfirmId);

  const handleExport = (format: "json" | "markdown") => {
    if (!exportModalConv) return;
    hudAudio.playChirp();
    const isCurrentActive = exportModalConv.id === activeConversationId;
    const payload = {
      id: exportModalConv.id,
      title: exportModalConv.title,
      modelId: activeModel,
      runMode,
      messages: isCurrentActive ? messages : [],
      responseAnalysis: isCurrentActive ? responseAnalysis : null,
      retrievedSources: isCurrentActive ? retrievedSources : [],
      missingContext: isCurrentActive ? missingContext : [],
      counterPerspective: isCurrentActive ? counterPerspective : null,
      graphNodes: isCurrentActive ? graphNodes : [],
      graphEdges: isCurrentActive ? graphEdges : [],
    };

    if (format === "json") {
      exportConversationAsJson(payload);
    } else {
      exportConversationAsMarkdown(payload);
    }
    setExportModalConv(null);
  };

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col bg-[#070b16]/80 backdrop-blur-2xl border-r border-white/[0.08] transition-all duration-200",
        compact ? "w-[240px]" : "w-[260px]",
        className,
      )}
    >
      {/* Top action header: New Chat + Clear + Collapse */}
      <div className="flex items-center justify-between gap-1.5 px-3 pt-3 pb-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 flex-1 justify-start gap-2 rounded-lg border-cyan-500/30 bg-cyan-500/10 text-xs font-mono text-cyan-200 hover:bg-cyan-500/20 hover:border-cyan-500/50 hover:text-white"
          disabled={loading}
          onClick={() => {
            hudAudio.playChirp();
            void newChat().then(() => {
              setMobileNavOpen(false);
            });
          }}
        >
          <Plus className="size-4 text-cyan-400" />
          <span>New inquiry</span>
        </Button>

        {conversations.length > 0 && (
          <button
            type="button"
            onClick={() => {
              hudAudio.playClick(1100);
              setClearAllConfirm(true);
            }}
            className="flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
            title="Clear all research history"
            aria-label="Clear all research history"
          >
            <Trash2 className="size-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            hudAudio.playClick();
            toggleSidebar();
          }}
          className="flex size-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          title="Toggle sidebar (Ctrl+B)"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      {/* Active vs Archived Sub-Tab Bar */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={() => {
            hudAudio.playClick(1300);
            setHistoryTab("active");
          }}
          className={cn(
            "flex-1 py-1 text-[11px] font-mono rounded transition text-center",
            historyTab === "active"
              ? "bg-cyan-500/20 text-cyan-200 font-semibold border border-cyan-500/40"
              : "text-slate-400 hover:text-white",
          )}
        >
          Active ({activeCount})
        </button>

        <button
          type="button"
          onClick={() => {
            hudAudio.playClick(1300);
            setHistoryTab("archived");
          }}
          className={cn(
            "flex-1 py-1 text-[11px] font-mono rounded transition text-center",
            historyTab === "archived"
              ? "bg-cyan-500/20 text-cyan-200 font-semibold border border-cyan-500/40"
              : "text-slate-400 hover:text-white",
          )}
        >
          Archived ({archivedCount})
        </button>
      </div>

      {/* Search Input */}
      {conversations.length > 1 ? (
        <div className="px-3 py-1.5">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search history…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-md border border-white/10 bg-black/40 pl-8 pr-2 text-xs font-mono text-foreground placeholder:text-slate-500 outline-none focus:border-cyan-500/60"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-slate-500 hover:text-white"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="border-b border-white/[0.08] px-3 py-2 text-[11px] text-destructive">{error}</p>
      ) : null}

      {/* Conversation list grouped chronologically */}
      <ScrollArea className="min-h-0 flex-1 px-2">
        {displayedList.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs font-mono text-slate-500">
            {loading
              ? "Loading…"
              : searchQuery
                ? "No matching inquiries."
                : historyTab === "archived"
                  ? "No archived sessions."
                  : "No previous research sessions."}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {Object.entries(groupedConversations).map(([groupTitle, items]) => (
              <div key={groupTitle} className="space-y-1">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] font-mono tracking-wider text-slate-500 uppercase">
                    {groupTitle}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {items.map((conversation) => {
                    const active = conversation.id === activeConversationId;
                    const isArchived = archivedIds.has(conversation.id);

                    return (
                      <li key={conversation.id} className="relative group">
                        <div
                          className={cn(
                            "flex items-center justify-between gap-1 rounded-lg px-2.5 py-2 text-xs transition-colors",
                            active
                              ? "bg-cyan-500/15 text-cyan-100 font-medium border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                              : "text-slate-400 hover:bg-white/[0.04] hover:text-white",
                          )}
                        >
                          {renamingId === conversation.id ? (
                            <form
                              className="min-w-0 flex-1"
                              onSubmit={(event) => {
                                event.preventDefault();
                                const form = event.currentTarget;
                                const input = form.elements.namedItem("rename") as HTMLInputElement | null;
                                void commitRename(conversation.id, input?.value ?? renameDraft);
                              }}
                            >
                              <input
                                name="rename"
                                aria-label="Rename conversation"
                                value={renameDraft}
                                onChange={(event) => {
                                  setRenameDraft(event.target.value);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    setRenamingId(null);
                                  }
                                }}
                                onBlur={(event) => {
                                  void commitRename(conversation.id, event.currentTarget.value);
                                }}
                                className="w-full rounded border border-cyan-500/60 bg-black/50 px-1.5 py-0.5 text-xs text-foreground outline-none font-mono"
                                autoFocus
                              />
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left"
                              onClick={() => {
                                void openConversation(conversation.id).then(() => {
                                  setMobileNavOpen(false);
                                });
                              }}
                            >
                              <p className="truncate text-xs font-medium">{conversation.title}</p>
                              <p className="text-[10px] font-mono text-slate-500">
                                {relativeTime(conversation.updated_at)}
                              </p>
                            </button>
                          )}

                          {/* Action icons: Rename, Export, Archive/Restore & Delete */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              aria-label={`Export ${conversation.title}`}
                              className="rounded p-1 text-slate-500 transition hover:bg-emerald-500/20 hover:text-emerald-300 opacity-60 group-hover:opacity-100"
                              onClick={() => {
                                hudAudio.playClick(1500);
                                setExportModalConv({ id: conversation.id, title: conversation.title });
                              }}
                              title="Export inquiry session"
                            >
                              <Download className="size-3.5" />
                            </button>

                            <button
                              type="button"
                              aria-label={`Rename ${conversation.title}`}
                              className="rounded p-1 text-slate-500 transition hover:bg-white/[0.08] hover:text-cyan-300 opacity-60 group-hover:opacity-100"
                              onClick={() => {
                                setRenamingId(conversation.id);
                                setRenameDraft(conversation.title);
                              }}
                              title="Rename inquiry"
                            >
                              <Pencil className="size-3.5" />
                            </button>

                            <button
                              type="button"
                              aria-label={isArchived ? `Unarchive ${conversation.title}` : `Archive ${conversation.title}`}
                              className="rounded p-1 text-slate-500 transition hover:bg-cyan-500/20 hover:text-cyan-300 opacity-60 group-hover:opacity-100"
                              onClick={() => toggleArchive(conversation.id)}
                              title={isArchived ? "Restore inquiry to active" : "Archive inquiry"}
                            >

                              {isArchived ? (
                                <ArchiveRestore className="size-3.5 text-cyan-400" />
                              ) : (
                                <Archive className="size-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              aria-label={`Delete ${conversation.title}`}
                              className="rounded p-1 text-slate-500 transition hover:bg-red-500/20 hover:text-red-400 opacity-60 group-hover:opacity-100"
                              onClick={() => setDeleteConfirmId(conversation.id)}
                              title="Delete inquiry"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Accessible Radix Dialog: Delete Single Conversation */}
      <Dialog
        open={Boolean(deleteConfirmId)}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <DialogContent className="max-w-md border-red-500/30 bg-[#0a0f1d]/98 p-6 font-mono shadow-2xl backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-white font-sans">
              Delete Inquiry Session?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 mt-1.5">
              Permanently remove{" "}
              <span className="text-cyan-300 font-semibold">
                "{conversationToDelete?.title ?? "this session"}"
              </span>{" "}
              from your research history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 sm:justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs border-white/10 font-mono"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-8 text-xs font-mono gap-1.5"
              onClick={() => {
                const id = deleteConfirmId;
                setDeleteConfirmId(null);
                if (id) void removeConversation(id);
              }}
            >
              <Trash2 className="size-3.5" />
              <span>Delete Session</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accessible Radix Dialog: Clear All History */}
      <Dialog open={clearAllConfirm} onOpenChange={setClearAllConfirm}>
        <DialogContent className="max-w-md border-red-500/30 bg-[#0a0f1d]/98 p-6 font-mono shadow-2xl backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-red-400 font-sans">
              Clear All Research History?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 mt-1.5">
              Permanently erase all {conversations.length} stored inquiry sessions, epistemic graphs, and
              citation links.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 sm:justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs border-white/10 font-mono"
              onClick={() => setClearAllConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-8 text-xs font-mono gap-1.5"
              onClick={() => {
                setClearAllConfirm(false);
                void clearAllConversations();
              }}
            >
              <Trash2 className="size-3.5" />
              <span>Clear All Sessions</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accessible Radix Dialog: Export Session */}
      <Dialog
        open={Boolean(exportModalConv)}
        onOpenChange={(open) => {
          if (!open) setExportModalConv(null);
        }}
      >
        <DialogContent className="max-w-md border-cyan-500/30 bg-[#0a0f1d]/98 p-6 font-mono shadow-2xl backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-white font-sans">
              Export Research Inquiry
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 mt-1.5">
              Download session data for{" "}
              <span className="text-cyan-300 font-semibold">"{exportModalConv?.title}"</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 grid grid-cols-2 gap-3 font-mono">
            <button
              type="button"
              onClick={() => handleExport("markdown")}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center transition hover:border-emerald-500/50 hover:bg-emerald-500/10 cursor-pointer"
            >
              <FileText className="size-6 text-emerald-400" />
              <span className="text-xs font-semibold text-white">Markdown Report</span>
              <span className="text-[10px] text-slate-400">Formatted epistemic doc (.md)</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport("json")}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center transition hover:border-cyan-500/50 hover:bg-cyan-500/10 cursor-pointer"
            >
              <Download className="size-6 text-cyan-400" />
              <span className="text-xs font-semibold text-white">JSON Data</span>
              <span className="text-[10px] text-slate-400">Raw graph & claims payload (.json)</span>
            </button>
          </div>
          <DialogFooter>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs border-white/10 font-mono w-full"
              onClick={() => setExportModalConv(null)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer Area: Settings & Save History Status */}
      <div className="border-t border-white/[0.08] p-2.5">
        <button
          type="button"
          onClick={() => {
            hudAudio.playClick();
            setSettingsOpen(true);
          }}
          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs text-slate-400 transition hover:bg-white/[0.06] hover:text-white font-mono"
        >
          <div className="flex items-center gap-2">
            <Settings className="size-3.5 text-cyan-400" />
            <span>Preferences & BYOK</span>
          </div>
          <span className={cn("text-[10px]", saveHistoryEnabled ? "text-cyan-400" : "text-amber-400")}>
            {saveHistoryEnabled ? "History ON" : "Ephemeral"}
          </span>
        </button>
      </div>
    </aside>
  );
}
