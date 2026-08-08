import { MessageSquarePlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { renameConversation } from "@/lib/conversations-api";
import { getRunModeMeta, type RunMode } from "@/lib/run-mode";
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
  return new Date(then).toLocaleDateString();
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
  const conversationModes = useConversationStore((state) => state.conversationModes);
  const setMobileNavOpen = useUIStore((state) => state.setMobileNavOpen);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameCommitLock = useRef(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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

  return (
    <aside
      className={cn(
        "glass-panel flex h-full min-h-0 flex-col border border-border/50",
        compact ? "w-[240px]" : "w-[260px]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-3">
        <div>
          <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">History</p>
          <p className="text-sm font-medium text-foreground">Conversations</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          disabled={loading}
          onClick={() => {
            void newChat().then(() => {
              setMobileNavOpen(false);
            });
          }}
        >
          <MessageSquarePlus className="size-3.5" />
          New
        </Button>
      </div>

      {error ? (
        <p className="border-b border-border/40 px-3 py-2 text-[11px] text-destructive">{error}</p>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <ul className="flex flex-col gap-1 p-2">
          {conversations.length === 0 ? (
            <li className="rounded-lg px-3 py-6 text-center text-xs text-muted-foreground">
              {loading ? "Loading…" : "No chats yet. Start a new conversation."}
            </li>
          ) : (
            conversations.map((conversation) => {
              const active = conversation.id === activeConversationId;
              const mode: RunMode | undefined = conversationModes[conversation.id];
              const modeLabel = mode ? getRunModeMeta(mode).label : null;
              return (
                <li key={conversation.id} className="relative">
                  <div
                    className={cn(
                      "group flex items-center gap-1 rounded-xl border px-2 py-2 transition",
                      active
                        ? "border-primary/30 bg-white/[0.07] shadow-[inset_0_0_0_1px_oklch(1_0_0_/_4%)]"
                        : "border-transparent hover:bg-white/[0.03]",
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
                          className="w-full rounded-md border border-border/60 bg-black/30 px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        <p className="truncate text-sm text-foreground">{conversation.title}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {relativeTime(conversation.updated_at)}
                          {modeLabel ? ` · ${modeLabel}` : ""}
                        </p>
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`More actions for ${conversation.title}`}
                      className="rounded-md p-1.5 text-muted-foreground opacity-80 transition hover:bg-white/[0.06] hover:text-foreground hover:opacity-100"
                      onClick={() => {
                        setMenuId((current) =>
                          current === conversation.id ? null : conversation.id,
                        );
                      }}
                    >
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  </div>

                  {menuId === conversation.id ? (
                    <div
                      ref={menuRef}
                      className="absolute top-full right-2 z-30 mt-1 w-36 overflow-hidden rounded-lg border border-border/60 bg-[#12121A]/96 py-1 shadow-xl backdrop-blur-xl"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/[0.05]"
                        onClick={() => {
                          setMenuId(null);
                          setRenamingId(conversation.id);
                          setRenameDraft(conversation.title);
                        }}
                      >
                        <Pencil className="size-3.5" />
                        Rename
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-destructive hover:bg-white/[0.05]"
                        onClick={() => {
                          setMenuId(null);
                          void removeConversation(conversation.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </ScrollArea>
    </aside>
  );
}
