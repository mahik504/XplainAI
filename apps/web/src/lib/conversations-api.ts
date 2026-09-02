import { apiUrl } from "@/lib/env";

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  pipeline_state?: Record<string, unknown> | null;
  created_at: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: StoredMessage[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(`/api/v1${path}`), {
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    ...init,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${String(response.status)})`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const payload = await request<{ items: ConversationSummary[] }>("/conversations");
  return payload.items;
}

export async function createConversation(title?: string): Promise<ConversationSummary> {
  return request<ConversationSummary>("/conversations", {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  });
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  return request<ConversationDetail>(`/conversations/${id}`);
}

export async function deleteConversation(id: string): Promise<void> {
  await request<undefined>(`/conversations/${id}`, { method: "DELETE" });
}

export async function renameConversation(id: string, title: string): Promise<ConversationSummary> {
  return request<ConversationSummary>(`/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}
