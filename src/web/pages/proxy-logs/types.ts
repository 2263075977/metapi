import type { ProxyDebugTraceDetail } from "../../api.js";

export type ProxyDebugSettingsState = {
  proxyDebugTraceEnabled: boolean;
  proxyDebugCaptureHeaders: boolean;
  proxyDebugCaptureBodies: boolean;
  proxyDebugCaptureStreamChunks: boolean;
  proxyDebugTargetSessionId: string;
  proxyDebugTargetClientKind: string;
  proxyDebugTargetModel: string;
  proxyDebugRetentionHours: number;
  proxyDebugMaxBodyBytes: number;
};

export type ProxyDebugTraceDetailState = {
  loading: boolean;
  data?: ProxyDebugTraceDetail;
  error?: string;
};

export type ProxyDebugTraceAttempt = ProxyDebugTraceDetail["attempts"][number];
