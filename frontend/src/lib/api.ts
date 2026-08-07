import { apiUrl } from "@/lib/env";

export interface ChatModelsResponse {
  provider: string;
  default_model: string;
  environment: string;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${String(response.status)}) for ${path}`);
  }
  return (await response.json()) as T;
}

export function fetchChatModels(): Promise<ChatModelsResponse> {
  return getJson<ChatModelsResponse>("/api/v1/chat/models");
}
