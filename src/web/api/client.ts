import { clearAuthSession, getAuthToken } from "../authSession.js";

export type RequestOptions = RequestInit & {
  timeoutMs?: number;
};

function requireAuthToken(): string {
  const token = getAuthToken(localStorage);
  if (!token) {
    const hadToken = !!localStorage.getItem("auth_token");
    clearAuthSession(localStorage);
    if (
      hadToken &&
      typeof window !== "undefined" &&
      typeof window.location?.reload === "function"
    ) {
      window.location.reload();
    }
    throw new Error("Session expired");
  }
  return token;
}

export async function extractResponseErrorMessage(
  res: Response,
): Promise<string> {
  let message = `HTTP ${res.status}`;
  try {
    const text = await res.text();
    if (text) {
      try {
        const json = JSON.parse(text);
        if (json?.message && typeof json.message === "string") {
          message = json.message;
        } else if (json?.error && typeof json.error === "string") {
          message = json.error;
        } else if (
          json?.error?.message &&
          typeof json.error.message === "string"
        ) {
          message = json.error.message;
        } else {
          message = `${message}: ${text.slice(0, 120)}`;
        }
      } catch {
        message = `${message}: ${text.slice(0, 120)}`;
      }
    }
  } catch {}
  return message;
}

export async function fetchAuthenticatedResponse(
  url: string,
  options: RequestOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 30_000,
    signal: externalSignal,
    ...fetchOptions
  } = options;
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  let cleanupExternalSignal = () => {};

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      const abortHandler = () => controller.abort();
      externalSignal.addEventListener("abort", abortHandler, { once: true });
      cleanupExternalSignal = () =>
        externalSignal.removeEventListener("abort", abortHandler);
    }
  }

  const token = requireAuthToken();
  const headers = new Headers(fetchOptions.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);
  if (fetchOptions.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers,
    });
    if (res.status === 401 || res.status === 403) {
      const hadToken = !!getAuthToken(localStorage);
      clearAuthSession(localStorage);
      if (
        hadToken &&
        typeof window !== "undefined" &&
        typeof window.location?.reload === "function"
      ) {
        window.location.reload();
      }
      throw new Error("Session expired");
    }
    return res;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      if (externalSignal?.aborted) throw error;
      throw new Error(
        `请求超时（${Math.max(1, Math.round(timeoutMs / 1000))}s）`,
      );
    }
    throw error;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    cleanupExternalSignal();
  }
}

export async function request<T = any>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const res = await fetchAuthenticatedResponse(url, options);
  if (!res.ok) {
    throw new Error(await extractResponseErrorMessage(res));
  }
  return res.json() as Promise<T>;
}

export async function streamSse(
  url: string,
  handlers: {
    onLog?: (entry: any) => void;
    onDone?: (payload: any) => void;
    signal?: AbortSignal;
  },
) {
  const response = await fetchAuthenticatedResponse(url, {
    method: "GET",
    signal: handlers.signal,
    headers: {
      Accept: "text/event-stream",
    },
    timeoutMs: 120_000,
  });

  if (!response.ok) {
    throw new Error(await extractResponseErrorMessage(response));
  }
  if (!response.body) {
    throw new Error("响应未返回流式内容");
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";

  const flushBuffer = (final = false) => {
    const chunks = final ? [...buffer.split("\n\n"), ""] : buffer.split("\n\n");
    if (!final) buffer = chunks.pop() || "";
    else buffer = "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      let eventName = "message";
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventName = line.slice("event:".length).trim() || "message";
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice("data:".length).trim());
        }
      }

      if (dataLines.length <= 0) continue;
      let payload: any = dataLines.join("\n");
      try {
        payload = JSON.parse(payload);
      } catch {
        // keep string payload
      }

      if (eventName === "log") {
        handlers.onLog?.(payload);
      } else if (eventName === "done") {
        handlers.onDone?.(payload);
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flushBuffer(false);
  }

  if (buffer.trim()) {
    flushBuffer(true);
  }
}

export function buildQueryString(
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  if (!params) return "";
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(key, String(value));
  }
  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
}
