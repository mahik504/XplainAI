import { useEffect } from "react";

import { fetchChatModels } from "@/lib/api";
import { getWsChatUrl } from "@/lib/env";
import { createWsClient } from "@/lib/ws-client";
import { useSessionStore } from "@/stores/session-store";

export function useSessionConnection(): void {
  useEffect(() => {
    let cancelled = false;
    const { bindClient, setConnection, applyFrame, setModelCatalog } =
      useSessionStore.getState();

    void fetchChatModels()
      .then((models) => {
        if (cancelled) return;
        setModelCatalog({
          provider: models.provider,
          defaultModel: models.default_model,
          models: Array.isArray(models.models) ? models.models : [],
        });
      })
      .catch(() => {
        // REST catalog is optional; WS chat remains the primary path.
      });

    const client = createWsClient({
      url: getWsChatUrl(),
      onStatus: setConnection,
      onFrame: applyFrame,
    });

    bindClient(client);
    client.connect();

    return () => {
      cancelled = true;
      client.disconnect();
      bindClient(null);
    };
  }, []);
}
