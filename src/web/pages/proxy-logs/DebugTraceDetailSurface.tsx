import React, { useState } from "react";

import CenteredModal from "../../components/CenteredModal.js";
import MobileDrawer from "../../components/MobileDrawer.js";
import {
  debugCodeBlockStyle,
  detailInfoGridStyle,
  detailInfoItemStyle,
  detailInfoLabelStyle,
  detailInfoValueStyle,
  detailSectionTitleStyle,
  formSectionStyle,
} from "./debugSurfaceStyles.js";
import {
  parseStoredDebugPreview,
  stringifyStoredDebugValue,
} from "./debugStoredValue.js";
import type {
  ProxyDebugTraceAttempt,
  ProxyDebugTraceDetailState,
} from "./types.js";

type DebugTraceDetailSurfaceProps = {
  isMobile: boolean;
  open: boolean;
  title: string;
  selectedTraceId: number | null;
  detail?: ProxyDebugTraceDetailState;
  onClose: () => void;
  onCopyStoredValue: (label: string, value: unknown) => Promise<void> | void;
};

type DetailDisclosureCardProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

const detailExpandableCardStyle: React.CSSProperties = {
  border: "1px solid var(--color-border-light)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-bg-card)",
  overflow: "hidden",
};

const detailExpandableSummaryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  width: "100%",
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-text-primary)",
  borderBottom: "1px solid var(--color-border-light)",
  background:
    "color-mix(in srgb, var(--color-bg-card) 86%, var(--color-bg) 14%)",
};

function DetailDisclosureCard({
  title,
  defaultOpen = false,
  children,
}: DetailDisclosureCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={detailExpandableCardStyle}>
      <button
        type="button"
        aria-label={`${open ? "收起" : "展开"}${title}`}
        style={{
          ...detailExpandableSummaryStyle,
          border: "none",
          cursor: "pointer",
        }}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{title}</span>
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-muted)",
            flexShrink: 0,
          }}
        >
          {open ? "收起" : "展开"}
        </span>
      </button>
      {open ? children : null}
    </div>
  );
}

function renderAttemptDetail(attempt: ProxyDebugTraceAttempt) {
  const serializedAttempt = [
    `targetUrl: ${attempt.targetUrl}`,
    `runtimeExecutor: ${attempt.runtimeExecutor || "-"}`,
    `recoverApplied: ${attempt.recoverApplied ? "true" : "false"}`,
    `downgradeDecision: ${attempt.downgradeDecision ? "true" : "false"}`,
    `downgradeReason: ${attempt.downgradeReason || "-"}`,
    "",
    "requestHeaders:",
    stringifyStoredDebugValue(attempt.requestHeadersJson) || "-",
    "",
    "requestBody:",
    stringifyStoredDebugValue(attempt.requestBodyJson) || "-",
    "",
    "responseHeaders:",
    stringifyStoredDebugValue(attempt.responseHeadersJson) || "-",
    "",
    "responseBody:",
    stringifyStoredDebugValue(attempt.responseBodyJson) || "-",
    "",
    "rawErrorText:",
    attempt.rawErrorText || "-",
    "",
    "memoryWrite:",
    stringifyStoredDebugValue(attempt.memoryWriteJson) || "-",
  ].join("\n");

  return (
    <DetailDisclosureCard
      key={attempt.id}
      title={`#${attempt.attemptIndex + 1} · ${attempt.endpoint} · ${attempt.responseStatus ?? "-"} · ${attempt.requestPath}`}
    >
      <div style={{ padding: 12, display: "grid", gap: 12 }}>
        <div style={detailInfoGridStyle}>
          <div style={detailInfoItemStyle}>
            <div style={detailInfoLabelStyle}>目标地址</div>
            <div
              style={{
                ...detailInfoValueStyle,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
            >
              {attempt.targetUrl || "-"}
            </div>
          </div>
          <div style={detailInfoItemStyle}>
            <div style={detailInfoLabelStyle}>执行器</div>
            <div style={detailInfoValueStyle}>
              {attempt.runtimeExecutor || "-"}
            </div>
          </div>
          <div style={detailInfoItemStyle}>
            <div style={detailInfoLabelStyle}>恢复逻辑</div>
            <div style={detailInfoValueStyle}>
              {attempt.recoverApplied ? "已应用" : "未应用"}
            </div>
          </div>
          <div style={detailInfoItemStyle}>
            <div style={detailInfoLabelStyle}>降级决策</div>
            <div style={detailInfoValueStyle}>
              {attempt.downgradeDecision ? "已触发" : "未触发"}
            </div>
          </div>
        </div>
        {attempt.downgradeReason ? (
          <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            降级原因：{attempt.downgradeReason}
          </div>
        ) : null}
        <pre style={debugCodeBlockStyle}>{serializedAttempt}</pre>
      </div>
    </DetailDisclosureCard>
  );
}

function renderStoredDebugDetails(
  title: string,
  value: unknown,
  onCopyStoredValue: DebugTraceDetailSurfaceProps["onCopyStoredValue"],
  options?: { defaultOpen?: boolean; copyLabel?: string },
) {
  const normalized = parseStoredDebugPreview(value);
  const copyLabel = options?.copyLabel || title;

  return (
    <DetailDisclosureCard title={title} defaultOpen={options?.defaultOpen}>
      <div style={{ padding: 12, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              border: "1px solid var(--color-border)",
              padding: "6px 12px",
            }}
            aria-label={`复制${copyLabel}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void onCopyStoredValue(copyLabel, value);
            }}
          >
            复制当前保存内容
          </button>
        </div>
        {normalized.note ? (
          <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {normalized.note}
          </div>
        ) : null}
        <pre style={debugCodeBlockStyle}>{normalized.displayText}</pre>
      </div>
    </DetailDisclosureCard>
  );
}

function renderDebugTraceDetailContent({
  selectedTraceId,
  detail,
  onCopyStoredValue,
}: {
  selectedTraceId: number | null;
  detail?: ProxyDebugTraceDetailState;
  onCopyStoredValue: DebugTraceDetailSurfaceProps["onCopyStoredValue"];
}) {
  if (!selectedTraceId) {
    return (
      <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
        暂无追踪详情。请选择一条最近追踪后再查看。
      </div>
    );
  }

  if (detail?.loading) {
    return (
      <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
        加载追踪详情中...
      </div>
    );
  }

  if (detail?.error) {
    return (
      <div style={{ color: "var(--color-danger)", fontSize: 13 }}>
        {detail.error}
      </div>
    );
  }

  if (!detail?.data) {
    return (
      <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
        暂无追踪详情。
      </div>
    );
  }

  const traceDetail = detail.data.trace;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ ...formSectionStyle, gap: 10 }}>
        <div style={detailSectionTitleStyle}>基础信息</div>
        <div style={detailInfoGridStyle}>
          <div style={detailInfoItemStyle}>
            <div style={detailInfoLabelStyle}>下游路径</div>
            <div style={detailInfoValueStyle}>
              {traceDetail.downstreamPath || "-"}
            </div>
          </div>
          <div style={detailInfoItemStyle}>
            <div style={detailInfoLabelStyle}>Session</div>
            <div style={detailInfoValueStyle}>{traceDetail.sessionId || "-"}</div>
          </div>
          <div style={detailInfoItemStyle}>
            <div style={detailInfoLabelStyle}>模型</div>
            <div style={detailInfoValueStyle}>
              {traceDetail.requestedModel || "-"}
            </div>
          </div>
          <div style={detailInfoItemStyle}>
            <div style={detailInfoLabelStyle}>最终上游路径</div>
            <div style={detailInfoValueStyle}>
              {traceDetail.finalUpstreamPath || "-"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {renderStoredDebugDetails(
          "候选 endpoint",
          traceDetail.endpointCandidatesJson,
          onCopyStoredValue,
          {
            copyLabel: "候选 endpoint",
          },
        )}
        {renderStoredDebugDetails(
          "原始下游请求头",
          traceDetail.requestHeadersJson,
          onCopyStoredValue,
          {
            copyLabel: "原始下游请求头",
          },
        )}
        {renderStoredDebugDetails(
          "原始下游请求体",
          traceDetail.requestBodyJson,
          onCopyStoredValue,
          {
            copyLabel: "原始下游请求体",
          },
        )}
        {renderStoredDebugDetails(
          "最终响应",
          traceDetail.finalResponseBodyJson,
          onCopyStoredValue,
          {
            copyLabel: "最终响应",
          },
        )}
      </div>

      <DetailDisclosureCard title={`Attempt 记录 (${detail.data.attempts.length})`}>
        <div style={{ padding: 12, display: "grid", gap: 8 }}>
          {detail.data.attempts.length === 0 ? (
            <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
              暂无 attempt 记录
            </div>
          ) : (
            detail.data.attempts.map(renderAttemptDetail)
          )}
        </div>
      </DetailDisclosureCard>
    </div>
  );
}

export default function DebugTraceDetailSurface({
  isMobile,
  open,
  title,
  selectedTraceId,
  detail,
  onClose,
  onCopyStoredValue,
}: DebugTraceDetailSurfaceProps) {
  const content = renderDebugTraceDetailContent({
    selectedTraceId,
    detail,
    onCopyStoredValue,
  });

  if (isMobile) {
    return (
      <MobileDrawer
        open={open}
        onClose={onClose}
        title={title}
        closeLabel="关闭追踪详情"
        side="right"
      >
        <div style={{ padding: 16, display: "grid", gap: 16 }}>{content}</div>
      </MobileDrawer>
    );
  }

  return (
    <CenteredModal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth={920}
      closeOnBackdrop
      closeOnEscape
    >
      {content}
    </CenteredModal>
  );
}
