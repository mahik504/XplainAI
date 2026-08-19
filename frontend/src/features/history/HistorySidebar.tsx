import {
  ChevronLeft,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { renameConversation } from "@/lib/conversations-api";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/stores/conversation-store";
import { useUIStore } from "@/stores/ui-store";

interface HistorySidebarProps {
  className?: string;
  compact?: boolean;
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

  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const setMobileNavOpen = useUIStore((state) => state.setMobileNavOpen);
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen);
  const saveHistoryEnabled = useUIStore((state) => state.saveHistoryEnabled);

  const [searchQuery, setSearchQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameCommitLock = useRef(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Global shortcut: Cmd/Ctrl + B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  useEffect(() => {
    if (!menuId) return;
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuId(null);
    };
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("mousedown", onPointer);
    };
  }, [menuId]);

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

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const groupedConversations = useMemo(() => {
    const groups: Record<string, typeof conversations> = {};
    for (const c of filteredConversations) {
      const key = getGroupKey(c.updated_at);
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return groups;
  }, [filteredConversations]);

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col bg-[#0f0f11] border-r border-border/40 transition-all duration-200",
        compact ? "w-[240px]" : "w-[260px]",
        className,
      )}
    >
      {/* Top action header: New Chat + Collapse */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 flex-1 justify-start gap-2 rounded-lg border-border/60 bg-white/[0.02] text-xs font-medium text-foreground hover:bg-white/[0.06] hover:text-white"
          disabled={loading}
          onClick={() => {
            void newChat().then(() => {
              setMobileNavOpen(false);
            });
          }}
        >
          <Plus className="size-4 text-primary" />
          <span>New inquiry</span>
        </Button>
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
          title="Toggle sidebar (Ctrl+B)"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      {/* Search Input */}
      {conversations.length > 4 ? (
        <div className="px-3 py-1.5">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search history…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-md border border-border/40 bg-black/20 pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="border-b border-border/40 px-3 py-2 text-[11px] text-destructive">{error}</p>
      ) : null}

      {/* Conversation list grouped chronologically */}
      <ScrollArea className="min-h-0 flex-1 px-2">
        {filteredConversations.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            {loading ? "Loading…" : searchQuery ? "No matching conversations" : "No previous research sessions."}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {Object.entries(groupedConversations).map(([groupTitle, items]) => (
              <div key={groupTitle} className="space-y-1">
                <div className="px-2 py-1 text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase">
                  {groupTitle}
                </div>
                <ul className="space-y-0.5">
                  {items.map((conversation) => {
                    const active = conversation.id === activeConversationId;
                    return (
                      <li key={conversation.id} className="relative">
                        <div
                          className={cn(
                            "group flex items-center justify-between gap-1 rounded-lg px-2.5 py-2 text-xs transition-colors",
                            active
                              ? "bg-white/[0.08] text-foreground font-medium"
                              : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
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
                                className="w-full rounded border border-primary/50 bg-black/40 px-1.5 py-0.5 text-xs text-foreground outline-none"
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
                              <p className="truncate text-xs">{conversation.title}</p>
                              <p className="text-[10px] text-muted-foreground/60">
                                {relativeTime(conversation.updated_at)}
                              </p>
                            </button>
                          )}

                          <button
                            type="button"
                            aria-label={`Actions for ${conversation.title}`}
                            className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground transition hover:bg-white/[0.1] hover:text-foreground"
                            onClick={() => {
                              setMenuId((current) =>
                                current === conversation.id ? null : conversation.id,
                              );
                            }}
                          >
                            <MoreHorizontal className="size-3.5" />
                          </button>
                        </div>

                        {/* Dropdown Menu */}
                        {menuId === conversation.id ? (
                          <div
                            ref={menuRef}
                            className="absolute top-full right-2 z-30 mt-1 w-32 overflow-hidden rounded-lg border border-border/80 bg-[#16161a] py-1 shadow-xl"
                          >
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-white/[0.08]"
                              onClick={() => {
                                setMenuId(null);
                                setRenamingId(conversation.id);
                                setRenameDraft(conversation.title);
                              }}
                            >
                              <Pencil className="size-3 text-muted-foreground" />
                              Rename
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setMenuId(null);
                                setDeleteConfirmId(conversation.id);
                              }}
                            >
                              <Trash2 className="size-3" />
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId ? (
        <div className="border-t border-border/40 bg-black/40 p-3">
          <p className="text-xs font-medium text-foreground mb-1.5">Delete conversation?</p>
          <p className="text-[11px] text-muted-foreground mb-2.5">
            This will permanently remove this research history.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-7 flex-1 text-xs"
              onClick={() => {
                const id = deleteConfirmId;
                setDeleteConfirmId(null);
                void removeConversation(id);
              }}
            >
              Delete
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 flex-1 text-xs"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {/* Footer Area: Settings & Save History Status */}
      <div className="border-t border-border/40 p-2.5">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
        >
          <div className="flex items-center gap-2">
            <Settings className="size-3.5" />
            <span>Settings & Models</span>
          </div>
          <span className="text-[10px] text-muted-foreground/60">
            {saveHistoryEnabled ? "History on" : "History off"}
          </span>
        </button>
      </div>
    </aside>
  );
}
