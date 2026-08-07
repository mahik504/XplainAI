import { isServerFrame, type ClientFrame, type ServerFrame } from "@/lib/protocol";

export type WsStatus = "offline" | "connecting" | "live";

export interface WsClientOptions {
  url: string;
  onStatus: (status: WsStatus) => void;
  onFrame: (frame: ServerFrame) => void;
  onError?: (error: Event) => void;
  minBackoffMs?: number;
  maxBackoffMs?: number;
}

export interface WsClient {
  connect: () => void;
  disconnect: () => void;
  send: (frame: ClientFrame) => boolean;
  getStatus: () => WsStatus;
}

export function createWsClient(options: WsClientOptions): WsClient {
  const minBackoff = options.minBackoffMs ?? 500;
  const maxBackoff = options.maxBackoffMs ?? 15_000;

  let socket: WebSocket | null = null;
  let status: WsStatus = "offline";
  let intentionalClose = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  let backoffMs = minBackoff;
  let heartbeatSeconds = 20;

  const setStatus = (next: WsStatus) => {
    if (status === next) return;
    status = next;
    options.onStatus(next);
  };

  const clearReconnect = () => {
    if (reconnectTimer === null) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const clearHeartbeat = () => {
    if (pingTimer !== null) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    if (watchdogTimer !== null) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
  };

  const sendRaw = (frame: ClientFrame): boolean => {
    // chat.send / run.cancel wait for connection.ready; ping may go once TCP is open.
    const requiresReady = frame.type !== "ping";
    if (
      socket === null ||
      socket.readyState !== WebSocket.OPEN ||
      (requiresReady && status !== "live")
    ) {
      return false;
    }
    socket.send(JSON.stringify(frame));
    return true;
  };

  const armWatchdog = () => {
    if (watchdogTimer !== null) {
      clearTimeout(watchdogTimer);
    }
    const timeoutMs = Math.max(8_000, heartbeatSeconds * 2.5 * 1000);
    watchdogTimer = setTimeout(() => {
      if (intentionalClose) return;
      const current = socket;
      if (current && current.readyState === WebSocket.OPEN) {
        current.close(4000, "heartbeat timeout");
      }
    }, timeoutMs);
  };

  const armHeartbeat = (intervalSeconds: number) => {
    clearHeartbeat();
    heartbeatSeconds = intervalSeconds > 0 ? intervalSeconds : 20;
    armWatchdog();

    pingTimer = setInterval(() => {
      if (socket !== null && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" } satisfies ClientFrame));
      }
    }, Math.max(5_000, heartbeatSeconds * 1000));
  };

  const noteServerBeat = () => {
    armWatchdog();
  };

  const scheduleReconnect = () => {
    if (intentionalClose || reconnectTimer !== null) return;
    const delay = backoffMs;
    backoffMs = Math.min(maxBackoff, Math.round(backoffMs * 1.7));
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, delay);
  };

  const open = () => {
    clearReconnect();
    clearHeartbeat();
    intentionalClose = false;

    if (
      socket !== null &&
      (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setStatus("connecting");

    const next = new WebSocket(options.url);
    socket = next;

    next.addEventListener("open", () => {
      if (socket !== next) return;
      backoffMs = minBackoff;
    });

    next.addEventListener("message", (event) => {
      if (socket !== next) return;
      if (typeof event.data !== "string") return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data) as unknown;
      } catch {
        return;
      }

      if (!isServerFrame(parsed)) return;

      if (parsed.type === "connection.ready") {
        setStatus("live");
        armHeartbeat(parsed.heartbeat_interval_seconds);
      }

      // Any server frame proves the link is alive (including run.* during streams).
      noteServerBeat();
      options.onFrame(parsed);
    });

    next.addEventListener("error", (event) => {
      options.onError?.(event);
    });

    next.addEventListener("close", () => {
      if (socket === next) {
        socket = null;
      }
      clearHeartbeat();
      setStatus("offline");
      if (!intentionalClose) {
        scheduleReconnect();
      }
    });
  };

  return {
    connect: () => {
      intentionalClose = false;
      open();
    },
    disconnect: () => {
      intentionalClose = true;
      clearReconnect();
      clearHeartbeat();
      const current = socket;
      socket = null;
      if (current && current.readyState < WebSocket.CLOSING) {
        current.close(1000, "client disconnect");
      }
      setStatus("offline");
    },
    send: sendRaw,
    getStatus: () => status,
  };
}
