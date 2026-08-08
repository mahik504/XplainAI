import { create } from "zustand";

import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  type ConversationSummary,
} from "@/lib/conversations-api";
import type { RunMode } from "@/lib/run-mode";
import { useSessionStore } from "@/stores/session-store";
import { useUIStore } from "@/stores/ui-store";

interface ConversationState {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  conversationModes: Record<string, RunMode>;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  newChat: () => Promise<void>;
  openConversation: (id: string) => Promise<void>;
  removeConversation: (id: string) => Promise<void>;
  ensureActiveConversation: () => Promise<string | null>;
  setConversationMode: (id: string, mode: RunMode) => void;
}

export const useConversationStore = create<ConversationState>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  conversationModes: {},
  loading: false,
  error: null,

  setConversationMode: (id, mode) => {
    set((state) => ({
      conversationModes: { ...state.conversationModes, [id]: mode },
    }));
  },

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const items = await listConversations();
      set({ conversations: items, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load conversations",
      });
    }
  },

  newChat: async () => {
    set({ loading: true, error: null });
    // Clear derived UI immediately so New Chat never leaves stale claim/composer state.
    useUIStore.getState().exitClaimFocus();
    useUIStore.getState().clearComposerPrefill();
    useUIStore.getState().setEvidenceDemandHighlight(false);
    useSessionStore.getState().resetConversation();
    try {
      const created = await createConversation();
      set((state) => ({
        conversations: [created, ...state.conversations.filter((item) => item.id !== created.id)],
        activeConversationId: created.id,
        loading: false,
      }));
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to create conversation",
      });
    }
  },

  openConversation: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const detail = await getConversation(id);
      useUIStore.getState().exitClaimFocus();
      useUIStore.getState().clearComposerPrefill();
      useUIStore.getState().setEvidenceDemandHighlight(false);
      useSessionStore.getState().loadConversationMessages(
        detail.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          timestamp: message.created_at,
        })),
      );
      set({ activeConversationId: id, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to open conversation",
      });
    }
  },

  removeConversation: async (id: string) => {
    try {
      await deleteConversation(id);
      const wasActive = get().activeConversationId === id;
      set((state) => ({
        conversations: state.conversations.filter((item) => item.id !== id),
        activeConversationId: wasActive ? null : state.activeConversationId,
      }));
      if (wasActive) {
        useUIStore.getState().exitClaimFocus();
        useUIStore.getState().clearComposerPrefill();
        useUIStore.getState().setEvidenceDemandHighlight(false);
        useSessionStore.getState().resetConversation();
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to delete conversation",
      });
    }
  },

  ensureActiveConversation: async () => {
    const current = get().activeConversationId;
    if (current) return current;
    try {
      const created = await createConversation();
      set((state) => ({
        conversations: [created, ...state.conversations],
        activeConversationId: created.id,
      }));
      return created.id;
    } catch {
      return null;
    }
  },
}));
