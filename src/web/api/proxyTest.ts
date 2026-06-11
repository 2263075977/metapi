import { clearAuthSession, getAuthToken } from "../authSession.js";
import {
  extractResponseErrorMessage,
  fetchAuthenticatedResponse,
  request,
  type RequestOptions,
} from "./client.js";

type BufferLike = {
  from(data: ArrayBuffer): { toString(encoding: "base64"): string };
};

const nodeBuffer = (globalThis as typeof globalThis & { Buffer?: BufferLike })
  .Buffer;

type TestChatRequestPayload = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  targetFormat?: "openai" | "claude" | "responses" | "gemini";
  stream?: boolean;
  forcedChannelId?: number | null;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  seed?: number;
};

export type ProxyTestMethod = "POST" | "GET" | "DELETE";
export type ProxyTestRequestKind = "json" | "multipart" | "empty";

export type ProxyTestMultipartFile = {
  field: string;
  name: string;
  mimeType: string;
  dataUrl: string;
};

export type ProxyTestRequestEnvelope = {
  method: ProxyTestMethod;
  path: string;
  requestKind: ProxyTestRequestKind;
  stream?: boolean;
  jobMode?: boolean;
  rawMode?: boolean;
  forcedChannelId?: number | null;
  jsonBody?: unknown;
  rawJsonText?: string;
  multipartFields?: Record<string, string>;
  multipartFiles?: ProxyTestMultipartFile[];
};

export type ProxyTestJobResponse = {
  jobId: string;
  status: "pending" | "succeeded" | "failed" | "cancelled";
  result?: unknown;
  error?: unknown;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
};

const DEFAULT_PROXY_TEST_TIMEOUT_MS = 30_000;
const LONG_RUNNING_PROXY_TEST_TIMEOUT_MS = 150_000;

function resolveProxyTestTimeoutMs(data: ProxyTestRequestEnvelope) {
  if (data.jobMode) return LONG_RUNNING_PROXY_TEST_TIMEOUT_MS;
  if (data.path === "/v1/images/generations")
    return LONG_RUNNING_PROXY_TEST_TIMEOUT_MS;
  if (data.path === "/v1/images/edits")
    return LONG_RUNNING_PROXY_TEST_TIMEOUT_MS;
  if (data.path === "/v1/videos" && data.method === "POST")
    return LONG_RUNNING_PROXY_TEST_TIMEOUT_MS;
  return DEFAULT_PROXY_TEST_TIMEOUT_MS;
}

function proxyTestRequest(data: ProxyTestRequestEnvelope) {
  return request("/api/test/proxy", {
    method: "POST",
    body: JSON.stringify(data),
    timeoutMs: resolveProxyTestTimeoutMs(data),
  });
}

async function proxyTestStreamRequest(
  data: ProxyTestRequestEnvelope,
  signal?: AbortSignal,
) {
  return fetchAuthenticatedResponse("/api/test/proxy/stream", {
    method: "POST",
    signal,
    body: JSON.stringify(data),
    timeoutMs: resolveProxyTestTimeoutMs(data),
  });
}

function parseContentDispositionFilename(
  headerValue: string | null,
): string | null {
  if (!headerValue) return null;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(headerValue);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const quotedMatch = /filename="([^"]+)"/i.exec(headerValue);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const bareMatch = /filename=([^;]+)/i.exec(headerValue);
  return bareMatch?.[1]?.trim() || null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (nodeBuffer) {
    return nodeBuffer.from(buffer).toString("base64");
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export const proxyTestApi = {
  startTestChatJob: (data: TestChatRequestPayload) =>
    request("/api/test/chat/jobs", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getTestChatJob: (jobId: string) =>
    request(`/api/test/chat/jobs/${encodeURIComponent(jobId)}`),
  deleteTestChatJob: (jobId: string) =>
    request(`/api/test/chat/jobs/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    }),
  startProxyTestJob: (data: ProxyTestRequestEnvelope) =>
    request("/api/test/proxy/jobs", {
      method: "POST",
      body: JSON.stringify(data),
      timeoutMs: resolveProxyTestTimeoutMs(data),
    }) as Promise<ProxyTestJobResponse>,
  getProxyTestJob: (jobId: string) =>
    request(`/api/test/proxy/jobs/${encodeURIComponent(jobId)}`),
  deleteProxyTestJob: (jobId: string) =>
    request(`/api/test/proxy/jobs/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    }),
  getProxyFileContentDataUrl: async (
    fileId: string,
    options: Pick<RequestOptions, "signal" | "timeoutMs"> = {},
  ) => {
    const response = await fetchAuthenticatedResponse(
      `/v1/files/${encodeURIComponent(fileId)}/content`,
      {
        method: "GET",
        ...options,
      },
    );
    if (!response.ok) {
      throw new Error(await extractResponseErrorMessage(response));
    }

    const mimeType =
      (response.headers.get("content-type") || "application/octet-stream")
        .split(";")[0]
        .trim() || "application/octet-stream";
    const filename = parseContentDispositionFilename(
      response.headers.get("content-disposition"),
    );
    const base64 = arrayBufferToBase64(await response.arrayBuffer());
    return {
      filename,
      mimeType,
      data: `data:${mimeType};base64,${base64}`,
    };
  },
  testProxy: proxyTestRequest,
  proxyTest: proxyTestRequest,
  testChat: (data: TestChatRequestPayload) =>
    request("/api/test/chat", { method: "POST", body: JSON.stringify(data) }),
  testProxyStream: proxyTestStreamRequest,
  proxyTestStream: proxyTestStreamRequest,
  testChatStream: async (
    data: TestChatRequestPayload,
    signal?: AbortSignal,
  ) => {
    const token = getAuthToken(localStorage);
    if (!token) {
      clearAuthSession(localStorage);
      throw new Error("Session expired");
    }
    return fetch("/api/test/chat/stream", {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  },
};
