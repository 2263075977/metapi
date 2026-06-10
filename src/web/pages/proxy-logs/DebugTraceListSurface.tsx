import React from "react";

import type { ProxyDebugTraceListItem } from "../../api.js";
import { MobileCard, MobileField } from "../../components/MobileCard.js";
import { tr } from "../../i18n.js";
import { formatDateTimeLocal } from "../helpers/checkinLogTime.js";
import type { ProxyDebugSettingsState } from "./types.js";

type DebugTraceListSurfaceProps = {
  isMobile: boolean;
  settings: ProxyDebugSettingsState;
  traces: ProxyDebugTraceListItem[];
  visibleTraces: ProxyDebugTraceListItem[];
  latestTrace: ProxyDebugTraceListItem | null;
  loading: boolean;
  saving: boolean;
  panelExpanded: boolean;
  safePage: number;
  totalPages: number;
  displayedStart: number;
  displayedEnd: number;
  onTogglePanel: () => void;
  onQuickToggleDebugTrace: () => Promise<void> | void;
  onOpenSettings: () => void;
  onRefresh: () => Promise<void> | void;
  onOpenTraceDetail: (traceId: number) => void;
  onPreviousPage: () => void;
  onSelectPage: (page: number) => void;
  onNextPage: () => void;
};

const compactSummaryMetricStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 112,
};

function formatProxyDebugCaptureSummary(settings: ProxyDebugSettingsState) {
  const parts = ["路由决策"];
  if (settings.proxyDebugCaptureHeaders) parts.push("请求/响应头");
  if (settings.proxyDebugCaptureBodies) parts.push("请求/响应体");
  if (settings.proxyDebugCaptureStreamChunks) parts.push("流式分片");
  return parts.join("、");
}

function formatProxyDebugTargetSummary(settings: ProxyDebugSettingsState) {
  const parts = [
    settings.proxyDebugTargetSessionId
      ? `Session ${settings.proxyDebugTargetSessionId}`
      : null,
    settings.proxyDebugTargetClientKind
      ? `客户端 ${settings.proxyDebugTargetClientKind}`
      : null,
    settings.proxyDebugTargetModel
      ? `模型 ${settings.proxyDebugTargetModel}`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("，") : "不过滤，记录所有命中的新请求";
}

function CompactSummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={compactSummaryMetricStyle}>
      <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
        {label}
      </span>
      <strong
        style={{
          fontSize: 14,
          color: "var(--color-text-primary)",
          fontWeight: 700,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function renderTraceStatusBadge(trace: ProxyDebugTraceListItem) {
  const failed = trace.finalStatus === "failed";
  return (
    <span
      className={`badge ${failed ? "badge-error" : "badge-success"}`}
      style={{ fontSize: 11 }}
    >
      {failed ? "失败" : "成功"}
    </span>
  );
}

export default function DebugTraceListSurface({
  isMobile,
  settings,
  traces,
  visibleTraces,
  latestTrace,
  loading,
  saving,
  panelExpanded,
  safePage,
  totalPages,
  displayedStart,
  displayedEnd,
  onTogglePanel,
  onQuickToggleDebugTrace,
  onOpenSettings,
  onRefresh,
  onOpenTraceDetail,
  onPreviousPage,
  onSelectPage,
  onNextPage,
}: DebugTraceListSurfaceProps) {
  return (
    <>
      <div
        className="card"
        style={{
          marginBottom: 12,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}
            >
              代理调试追踪
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                marginTop: 4,
              }}
            >
              未开启时不记录新追踪；追踪详情通过弹窗按需查看。
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ border: "1px solid var(--color-border)" }}
              aria-expanded={panelExpanded}
              data-debug-trace-panel-toggle
              onClick={onTogglePanel}
            >
              <svg
                width="14"
                height="14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                style={{
                  transform: panelExpanded
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              {panelExpanded ? "收起追踪面板" : "展开追踪面板"}
            </button>
            <button
              type="button"
              className={
                settings.proxyDebugTraceEnabled
                  ? "btn btn-ghost btn-ghost-active"
                  : "btn btn-ghost"
              }
              style={{ border: "1px solid var(--color-border)" }}
              onClick={() => void onQuickToggleDebugTrace()}
              disabled={saving}
            >
              {settings.proxyDebugTraceEnabled ? "关闭调试" : "开启调试"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ border: "1px solid var(--color-border)" }}
              onClick={onOpenSettings}
            >
              调试设置
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ border: "1px solid var(--color-border)" }}
              onClick={() => void onRefresh()}
              disabled={loading}
            >
              {loading ? "刷新中..." : "刷新追踪"}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px 18px",
            alignItems: "center",
          }}
        >
          <CompactSummaryMetric
            label="状态"
            value={settings.proxyDebugTraceEnabled ? "已开启" : "未开启"}
          />
          <CompactSummaryMetric label="最近追踪" value={`${traces.length} 条`} />
          <CompactSummaryMetric
            label="最新时间"
            value={
              latestTrace ? formatDateTimeLocal(latestTrace.createdAt) : "暂无"
            }
          />
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            记录内容：{formatProxyDebugCaptureSummary(settings)}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            过滤范围：{formatProxyDebugTargetSummary(settings)}
          </div>
        </div>
      </div>

      <div
        className={`anim-collapse ${panelExpanded ? "is-open" : ""}`.trim()}
        data-debug-trace-panel-body
        style={{ marginBottom: panelExpanded ? 12 : 0 }}
      >
        <div className="anim-collapse-inner">
          <div className="card" style={{ padding: 12, overflowX: "auto" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  最近调试追踪
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                    marginTop: 4,
                  }}
                >
                  最多抓最近 20 条，列表分页每页 5
                  条；打开详情后各段内容可按需展开和收起。
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {settings.proxyDebugTraceEnabled
                  ? "开启中，结果会自动刷新"
                  : "尚未开启"}
              </div>
            </div>

            {loading && traces.length === 0 ? (
              <div
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: 13,
                  paddingBottom: 12,
                }}
              >
                加载调试追踪中...
              </div>
            ) : traces.length === 0 ? (
              <div
                style={{
                  padding: 14,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border-light)",
                  background: "var(--color-bg)",
                  color: "var(--color-text-muted)",
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                {settings.proxyDebugTraceEnabled
                  ? "暂时还没有新追踪。这里只显示开启后产生的新请求，等下一次代理请求进入就会出现在这里。"
                  : "调试追踪尚未开启。点击上方“开启调试”或“调试设置”后，新的代理请求会出现在这里。"}
              </div>
            ) : isMobile ? (
              <div className="mobile-card-list">
                {visibleTraces.map((trace) => (
                  <MobileCard
                    key={trace.id}
                    title={trace.sessionId || `trace-${trace.id}`}
                    subtitle={formatDateTimeLocal(trace.createdAt)}
                    compact
                    headerActions={renderTraceStatusBadge(trace)}
                    footerActions={
                      <button
                        type="button"
                        className="btn btn-link"
                        onClick={() => onOpenTraceDetail(trace.id)}
                      >
                        查看详情
                      </button>
                    }
                  >
                    <MobileField
                      label="模型"
                      value={trace.requestedModel || "-"}
                    />
                    <MobileField
                      label="下游路径"
                      value={trace.downstreamPath || "-"}
                    />
                    <MobileField
                      label="上游路径"
                      value={trace.finalUpstreamPath || "-"}
                    />
                    <MobileField
                      label="客户端"
                      value={trace.clientKind || "-"}
                    />
                  </MobileCard>
                ))}
              </div>
            ) : (
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>Session</th>
                    <th>模型</th>
                    <th>下游路径</th>
                    <th>上游路径</th>
                    <th>客户端</th>
                    <th>{tr("状态")}</th>
                    <th style={{ textAlign: "right" }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTraces.map((trace) => (
                    <tr key={trace.id}>
                      <td
                        style={{
                          fontSize: 12,
                          whiteSpace: "nowrap",
                          fontVariantNumeric: "tabular-nums",
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {formatDateTimeLocal(trace.createdAt)}
                      </td>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>
                        {trace.sessionId || `trace-${trace.id}`}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {trace.requestedModel || "-"}
                      </td>
                      <td
                        style={{
                          fontSize: 12,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {trace.downstreamPath || "-"}
                      </td>
                      <td
                        style={{
                          fontSize: 12,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {trace.finalUpstreamPath || "-"}
                      </td>
                      <td
                        style={{
                          fontSize: 12,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {trace.clientKind || "-"}
                      </td>
                      <td>{renderTraceStatusBadge(trace)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-link"
                          onClick={() => onOpenTraceDetail(trace.id)}
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {traces.length > 0 ? (
              <div className="pagination" style={{ marginTop: 12 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                    marginRight: "auto",
                  }}
                >
                  显示第 {displayedStart} - {displayedEnd} 条，共{" "}
                  {traces.length} 条
                </div>
                <button
                  className="pagination-btn"
                  aria-label="调试追踪上一页"
                  disabled={safePage <= 1}
                  onClick={onPreviousPage}
                >
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                  (num) => (
                    <button
                      key={`debug-trace-page-${num}`}
                      className={`pagination-btn ${safePage === num ? "active" : ""}`}
                      onClick={() => onSelectPage(num)}
                    >
                      {num}
                    </button>
                  ),
                )}
                <button
                  className="pagination-btn"
                  aria-label="调试追踪下一页"
                  disabled={safePage >= totalPages}
                  onClick={onNextPage}
                >
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
