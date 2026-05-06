import { supabase } from "./supabase";

function resolveApiBase() {
  const configuredBase = import.meta.env.VITE_API_URL || "";

  if (!configuredBase || typeof window === "undefined") {
    return configuredBase;
  }

  try {
    const configuredUrl = new URL(configuredBase);
    const currentHost = window.location.hostname;
    const isConfiguredLocalhost =
      configuredUrl.hostname === "localhost" ||
      configuredUrl.hostname === "127.0.0.1";
    const isCurrentLocalhost =
      currentHost === "localhost" || currentHost === "127.0.0.1";

    if (isConfiguredLocalhost && !isCurrentLocalhost) {
      configuredUrl.hostname = currentHost;
      return configuredUrl.toString().replace(/\/$/, "");
    }

    return configuredBase;
  } catch {
    return configuredBase;
  }
}

const API_BASE = resolveApiBase();

class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? null;
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = undefined;
    }
    throw new ApiError(
      (data as { error?: string })?.error || `HTTP ${res.status}`,
      res.status,
      data,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export { ApiError };
