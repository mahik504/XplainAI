function readEnv(key: keyof ImportMetaEnv): string | undefined {
  const value: unknown = import.meta.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function rewriteLoopback(url: string): string {
  return url.replace("://localhost", "://127.0.0.1");
}

export function getApiBaseUrl(): string {
  const configured = readEnv("VITE_API_BASE_URL");
  return configured ? rewriteLoopback(configured).replace(/\/$/, "") : "";
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}

export function getWsToken(): string | undefined {
  return readEnv("VITE_WS_TOKEN");
}

export function getWsChatUrl(): string {
  const token = getWsToken();
  const configured = readEnv("VITE_WS_BASE_URL");

  let url: string;
  if (configured) {
    url = `${rewriteLoopback(configured).replace(/\/$/, "")}/chat`;
  } else {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    url = `${protocol}//${window.location.host}/ws/v1/chat`;
  }

  if (!token) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}
