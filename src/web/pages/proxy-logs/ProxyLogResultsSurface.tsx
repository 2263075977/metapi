import React from "react";
import type { ProxyLogListItem, ProxyLogUsageSource } from "../../api.js";
import { ModelBadge } from "../../components/BrandIcon.js";
import { MobileCard, MobileField } from "../../components/MobileCard.js";
import SiteBadgeLink from "../../components/SiteBadgeLink.js";
import { tr } from "../../i18n.js";
import { formatDateTimeLocal } from "../helpers/checkinLogTime.js";
import { parseProxyLogPathMeta } from "../helpers/proxyLogPathMeta.js";
import type { ProxyLogDetailState, ProxyLogRenderItem } from "./types.js";

const PROXY_LOG_CLIENT_FAMILY_LABELS: Record<string, string> = {
  codex: "Codex",
  claude_code: "Claude Code",
  gemini_cli: "Gemini CLI",
  generic: "通用",
};

type ProxyLogResultsSurfaceProps = {
  logs: ProxyLogListItem[];
  loading: boolean;
  isMobile: boolean;
  expandedLogId: number | null;
  detailById: Record<number, ProxyLogDetailState>;
  siteIdByName: Map<string, number>;
  onToggleExpand: (id: number) => void;
};

type ProxyLogResultItemProps = {
  log: ProxyLogListItem;
  detailState: ProxyLogDetailState | undefined;
  isExpanded: boolean;
  siteIdByName: Map<string, number>;
  onToggleExpand: (id: number) => void;
};

function formatLatency(ms: number) {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s`;
  }
  return `${ms}ms`;
}

function latencyColor(ms: number) {
  if (ms >= 3000) return "var(--color-danger)";
  if (ms >= 2000)
    return "color-mix(in srgb, var(--color-warning) 30%, var(--color-danger))";
  if (ms >= 1500)
    return "color-mix(in srgb, var(--color-warning) 60%, var(--color-danger))";
  if (ms >= 1000) return "var(--color-warning)";
  if (ms > 500)
    return "color-mix(in srgb, var(--color-success) 60%, var(--color-warning))";
  return "var(--color-success)";
}

function latencyBgColor(ms: number) {
  if (ms >= 3000)
    return "color-mix(in srgb, var(--color-danger) 12%, transparent)";
  if (ms >= 1000)
    return "color-mix(in srgb, var(--color-warning) 12%, transparent)";
  return "color-mix(in srgb, var(--color-success) 12%, transparent)";
}

function firstByteColor(ms: number) {
  if (ms >= 3000) return "var(--color-danger)";
  if (ms >= 1000) return "var(--color-warning)";
  return "var(--color-primary)";
}

function firstByteBgColor(ms: number) {
  if (ms >= 3000)
    return "color-mix(in srgb, var(--color-danger) 12%, transparent)";
  if (ms >= 1000)
    return "color-mix(in srgb, var(--color-warning) 12%, transparent)";
  return "color-mix(in srgb, var(--color-primary) 12%, transparent)";
}

function formatStreamModeLabel(isStream: boolean | null | undefined) {
  if (isStream == null) return null;
  return isStream ? "流式" : "非流";
}

function formatFirstByteLabel(ms: number | null | undefined) {
  if (!Number.isFinite(ms) || typeof ms !== "number" || ms < 0) return null;
  return `首字 ${formatLatency(ms)}`;
}

function formatCompactNumber(value: number, digits = 6) {
  if (!Number.isFinite(value)) return "0";
  const formatted = value.toFixed(digits).replace(/\.?0+$/, "");
  return formatted || "0";
}

function formatPerMillionPrice(value: number) {
  return `$${formatCompactNumber(value)} / 1M tokens`;
}

function formatBillingDetailSummary(log: ProxyLogRenderItem) {
  const detail = log.billingDetails;
  if (!detail) return null;
  return `模型倍率 ${formatCompactNumber(detail.pricing.modelRatio)}，输出倍率 ${formatCompactNumber(detail.pricing.completionRatio)}，缓存倍率 ${formatCompactNumber(detail.pricing.cacheRatio)}，缓存创建倍率 ${formatCompactNumber(detail.pricing.cacheCreationRatio)}，分组倍率 ${formatCompactNumber(detail.pricing.groupRatio)}`;
}

function formatProxyLogUsageSource(
  source: ProxyLogUsageSource | undefined,
): string | null {
  if (source === "upstream") return "上游返回";
  if (source === "self-log") return "站点日志回填";
  if (source === "unknown") return "未知";
  return null;
}

function formatProxyLogTokenValue(value: number | null | undefined): string {
  return typeof value === "number" ? value.toLocaleString() : "--";
}

function renderDownstreamKeySummary(log: ProxyLogRenderItem) {
  const parts = [
    log.downstreamKeyName ? `下游 Key: ${log.downstreamKeyName}` : null,
    log.downstreamKeyGroupName ? `主分组: ${log.downstreamKeyGroupName}` : null,
    Array.isArray(log.downstreamKeyTags) && log.downstreamKeyTags.length > 0
      ? `标签: ${log.downstreamKeyTags.join(" / ")}`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("，") : null;
}

function buildBillingProcessLines(log: ProxyLogRenderItem) {
  const detail = log.billingDetails;
  if (!detail) return [];

  const lines = [
    `提示价格：${formatPerMillionPrice(detail.breakdown.inputPerMillion)}`,
    `补全价格：${formatPerMillionPrice(detail.breakdown.outputPerMillion)}`,
  ];

  if (detail.usage.cacheReadTokens > 0) {
    lines.push(
      `缓存价格：${formatPerMillionPrice(detail.breakdown.cacheReadPerMillion)} (缓存倍率: ${formatCompactNumber(detail.pricing.cacheRatio)})`,
    );
  }

  if (detail.usage.cacheCreationTokens > 0) {
    lines.push(
      `缓存创建价格：${formatPerMillionPrice(detail.breakdown.cacheCreationPerMillion)} (缓存创建倍率: ${formatCompactNumber(detail.pricing.cacheCreationRatio)})`,
    );
  }

  const parts = [
    `提示 ${detail.usage.billablePromptTokens.toLocaleString()} tokens / 1M tokens * $${formatCompactNumber(detail.breakdown.inputPerMillion)}`,
  ];

  if (detail.usage.cacheReadTokens > 0) {
    parts.push(
      `缓存 ${detail.usage.cacheReadTokens.toLocaleString()} tokens / 1M tokens * $${formatCompactNumber(detail.breakdown.cacheReadPerMillion)}`,
    );
  }

  if (detail.usage.cacheCreationTokens > 0) {
    parts.push(
      `缓存创建 ${detail.usage.cacheCreationTokens.toLocaleString()} tokens / 1M tokens * $${formatCompactNumber(detail.breakdown.cacheCreationPerMillion)}`,
    );
  }

  parts.push(
    `补全 ${detail.usage.completionTokens.toLocaleString()} tokens / 1M tokens * $${formatCompactNumber(detail.breakdown.outputPerMillion)} = $${detail.breakdown.totalCost.toFixed(6)}`,
  );
  lines.push(parts.join(" + "));

  return lines;
}

function formatProxyLogClientFamilyLabel(
  clientFamily?: string | null,
  options?: { includeGeneric?: boolean },
) {
  const normalized =
    typeof clientFamily === "string" ? clientFamily.trim().toLowerCase() : "";
  if (!normalized) return null;
  if (!options?.includeGeneric && normalized === "generic") return null;
  return PROXY_LOG_CLIENT_FAMILY_LABELS[normalized] || clientFamily || null;
}

function resolveProxyLogClientDisplay(
  log: Pick<
    ProxyLogRenderItem,
    "clientFamily" | "clientAppName" | "clientConfidence"
  >,
  options?: { includeGeneric?: boolean },
) {
  const familyLabel = formatProxyLogClientFamilyLabel(
    log.clientFamily,
    options,
  );
  const appName =
    typeof log.clientAppName === "string" ? log.clientAppName.trim() : "";
  if (appName) {
    return {
      primary: appName,
      secondary: familyLabel,
      heuristic: log.clientConfidence === "heuristic",
    };
  }
  return {
    primary: familyLabel,
    secondary: null,
    heuristic: false,
  };
}

function renderProxyLogClientCell(
  log: Pick<
    ProxyLogRenderItem,
    "clientFamily" | "clientAppName" | "clientConfidence"
  >,
  options?: { includeGeneric?: boolean },
) {
  const display = resolveProxyLogClientDisplay(log, options);
  if (!display.primary) {
    return <span style={{ color: "var(--color-text-muted)" }}>-</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <span>{display.primary}</span>
        {display.heuristic ? (
          <span
            className="badge"
            style={{
              fontSize: 10,
              color: "var(--color-text-muted)",
              borderColor: "var(--color-border)",
            }}
          >
            推测
          </span>
        ) : null}
      </div>
      {display.secondary ? (
        <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
          {display.secondary}
        </span>
      ) : null}
    </div>
  );
}

function ResultsLoadingSkeleton() {
  return (
    <div
      style={{
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{ display: "flex", gap: 16 }}>
          <div className="skeleton" style={{ width: 140, height: 16 }} />
          <div className="skeleton" style={{ width: 200, height: 16 }} />
          <div className="skeleton" style={{ width: 50, height: 16 }} />
          <div className="skeleton" style={{ width: 50, height: 16 }} />
          <div className="skeleton" style={{ width: 50, height: 16 }} />
          <div className="skeleton" style={{ width: 70, height: 16 }} />
        </div>
      ))}
    </div>
  );
}

function ProxyLogMobileCard({
  log,
  detailState,
  isExpanded,
  siteIdByName,
  onToggleExpand,
}: ProxyLogResultItemProps) {
  const detail = detailState?.data;
  const detailLog: ProxyLogRenderItem = detail ? { ...log, ...detail } : log;
  const pathMeta = parseProxyLogPathMeta(
    detailLog.errorMessage ?? undefined,
  );
  const billingDetailSummary = detail
    ? formatBillingDetailSummary(detailLog)
    : null;
  const billingProcessLines = detail ? buildBillingProcessLines(detailLog) : [];
  const downstreamKeySummary = renderDownstreamKeySummary(detailLog);
  const clientDisplay = resolveProxyLogClientDisplay(detailLog);
  const streamModeLabel = formatStreamModeLabel(detailLog.isStream);
  const firstByteLabel = formatFirstByteLabel(detailLog.firstByteLatencyMs);

  return (
    <MobileCard
      title={detailLog.modelRequested || "unknown"}
      subtitle={formatDateTimeLocal(log.createdAt)}
      compact
      headerActions={
        <span
          className={`badge ${log.status === "success" ? "badge-success" : "badge-error"}`}
          style={{ fontSize: 10 }}
        >
          {log.status === "success" ? "成功" : "失败"}
        </span>
      }
      footerActions={
        <button
          type="button"
          className="btn btn-link"
          onClick={() => onToggleExpand(log.id)}
        >
          {isExpanded ? "收起详情" : "详情"}
        </button>
      }
    >
      <div className="mobile-inline-meta-row">
        <SiteBadgeLink
          siteId={siteIdByName.get(String(log.siteName || "").trim())}
          siteName={log.siteName}
          badgeStyle={{ fontSize: 11 }}
        />
        {clientDisplay.primary ? (
          <span className="badge badge-muted" style={{ fontSize: 10 }}>
            {clientDisplay.primary}
          </span>
        ) : null}
        {clientDisplay.secondary ? (
          <span className="badge badge-muted" style={{ fontSize: 10 }}>
            {clientDisplay.secondary}
          </span>
        ) : null}
        {streamModeLabel ? (
          <span className="badge badge-muted" style={{ fontSize: 10 }}>
            {streamModeLabel}
          </span>
        ) : null}
        {firstByteLabel ? (
          <span
            className="badge"
            style={{
              fontSize: 10,
              color: firstByteColor(detailLog.firstByteLatencyMs ?? 0),
              background: firstByteBgColor(detailLog.firstByteLatencyMs ?? 0),
              borderColor: "transparent",
            }}
          >
            {firstByteLabel}
          </span>
        ) : null}
      </div>
      <div className="mobile-summary-grid">
        <div className="mobile-summary-metric">
          <div className="mobile-summary-metric-label">用时</div>
          <div className="mobile-summary-metric-value">
            {formatLatency(log.latencyMs)}
          </div>
        </div>
        <div className="mobile-summary-metric">
          <div className="mobile-summary-metric-label">输入</div>
          <div className="mobile-summary-metric-value">
            {formatProxyLogTokenValue(log.promptTokens)}
          </div>
        </div>
        <div className="mobile-summary-metric">
          <div className="mobile-summary-metric-label">输出</div>
          <div className="mobile-summary-metric-value">
            {formatProxyLogTokenValue(log.completionTokens)}
          </div>
        </div>
        <div className="mobile-summary-metric">
          <div className="mobile-summary-metric-label">花费</div>
          <div className="mobile-summary-metric-value">
            {typeof log.estimatedCost === "number"
              ? `$${log.estimatedCost.toFixed(6)}`
              : "-"}
          </div>
        </div>
      </div>
      {isExpanded ? (
        <div className="mobile-card-extra">
          <MobileField label="时间" value={formatDateTimeLocal(log.createdAt)} />
          <MobileField
            label="站点"
            value={
              <SiteBadgeLink
                siteId={siteIdByName.get(String(log.siteName || "").trim())}
                siteName={log.siteName}
                badgeStyle={{ fontSize: 11 }}
              />
            }
          />
          {streamModeLabel ? (
            <MobileField label="模式" value={streamModeLabel} />
          ) : null}
          {firstByteLabel ? (
            <MobileField
              label="首字"
              value={firstByteLabel.replace(/^首字\s*/, "")}
            />
          ) : null}
          <MobileField label="重试" value={log.retryCount > 0 ? log.retryCount : 0} />
          <MobileField
            label="用量来源"
            value={
              formatProxyLogUsageSource(
                detailLog.usageSource ?? pathMeta.usageSource,
              ) || "--"
            }
          />
          {detailState?.loading && (
            <div style={{ color: "var(--color-text-muted)" }}>
              加载详情中...
            </div>
          )}
          {detailState?.error && (
            <div style={{ color: "var(--color-danger)" }}>
              {detailState.error}
            </div>
          )}
          {billingDetailSummary && (
            <div style={{ color: "var(--color-text-muted)" }}>
              {billingDetailSummary}
            </div>
          )}
          <MobileField
            label="客户端详情"
            value={renderProxyLogClientCell(detailLog, {
              includeGeneric: true,
            })}
          />
          {downstreamKeySummary && (
            <div style={{ color: "var(--color-text-muted)" }}>
              {downstreamKeySummary}
            </div>
          )}
          {billingProcessLines.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {billingProcessLines.map((line, index) => (
                <span key={`${log.id}-billing-mobile-${index}`}>{line}</span>
              ))}
            </div>
          )}
          {detail && pathMeta.errorMessage.trim().length > 0 && (
            <div style={{ color: "var(--color-danger)" }}>
              {pathMeta.errorMessage}
            </div>
          )}
        </div>
      ) : null}
    </MobileCard>
  );
}

function ProxyLogDesktopRows({
  log,
  detailState,
  isExpanded,
  siteIdByName,
  onToggleExpand,
}: ProxyLogResultItemProps) {
  const detail = detailState?.data;
  const detailLog: ProxyLogRenderItem = detail ? { ...log, ...detail } : log;
  const pathMeta = parseProxyLogPathMeta(
    detailLog.errorMessage ?? undefined,
  );
  const billingDetailSummary = detail
    ? formatBillingDetailSummary(detailLog)
    : null;
  const billingProcessLines = detail ? buildBillingProcessLines(detailLog) : [];
  const downstreamKeySummary = renderDownstreamKeySummary(detailLog);
  const streamModeLabel = formatStreamModeLabel(detailLog.isStream);
  const firstByteLabel = formatFirstByteLabel(detailLog.firstByteLatencyMs);

  return (
    <React.Fragment>
      <tr
        data-testid={`proxy-log-row-${log.id}`}
        onClick={() => onToggleExpand(log.id)}
        style={{
          cursor: "pointer",
          background: isExpanded ? "var(--color-primary-light)" : undefined,
          transition: "background 0.15s",
        }}
      >
        <td style={{ padding: "8px 4px 8px 12px" }}>
          <svg
            width="10"
            height="10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{
              transform: isExpanded ? "rotate(90deg)" : "none",
              transition: "transform 0.2s",
              color: "var(--color-text-muted)",
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </td>
        <td
          style={{
            fontSize: 12,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
            color: "var(--color-text-secondary)",
          }}
        >
          {formatDateTimeLocal(log.createdAt)}
        </td>
        <td>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <ModelBadge
              model={log.modelRequested}
              style={{ alignSelf: "flex-start" }}
            />
            {downstreamKeySummary ? (
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.45,
                  color: "var(--color-text-muted)",
                }}
              >
                {downstreamKeySummary}
              </div>
            ) : null}
            {streamModeLabel || firstByteLabel ? (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                {streamModeLabel ? (
                  <span className="badge badge-muted" style={{ fontSize: 10 }}>
                    {streamModeLabel}
                  </span>
                ) : null}
                {firstByteLabel ? (
                  <span
                    className="badge"
                    style={{
                      fontSize: 10,
                      color: firstByteColor(detailLog.firstByteLatencyMs ?? 0),
                      background: firstByteBgColor(
                        detailLog.firstByteLatencyMs ?? 0,
                      ),
                      borderColor: "transparent",
                    }}
                  >
                    {firstByteLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </td>
        <td
          style={{
            fontSize: 12,
            color: "var(--color-text-secondary)",
          }}
        >
          <SiteBadgeLink
            siteId={siteIdByName.get(String(log.siteName || "").trim())}
            siteName={log.siteName}
            badgeStyle={{ fontSize: 11 }}
          />
        </td>
        <td
          style={{
            fontSize: 12,
            color: "var(--color-text-secondary)",
          }}
        >
          {renderProxyLogClientCell(detailLog)}
        </td>
        <td>
          <span
            className={`badge ${log.status === "success" ? "badge-success" : "badge-error"}`}
            style={{ fontSize: 11, fontWeight: 600 }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background:
                  log.status === "success"
                    ? "var(--color-success)"
                    : "var(--color-danger)",
              }}
            />
            {log.status === "success" ? "成功" : "失败"}
          </span>
        </td>
        <td style={{ textAlign: "center" }}>
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              fontSize: 12,
              fontWeight: 600,
              color: latencyColor(log.latencyMs),
              background: latencyBgColor(log.latencyMs),
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            {formatLatency(log.latencyMs)}
          </span>
        </td>
        <td
          style={{
            textAlign: "right",
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
            color: "var(--color-text-secondary)",
          }}
        >
          {formatProxyLogTokenValue(log.promptTokens)}
        </td>
        <td
          style={{
            textAlign: "right",
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
            color: "var(--color-text-secondary)",
          }}
        >
          {formatProxyLogTokenValue(log.completionTokens)}
        </td>
        <td
          style={{
            textAlign: "right",
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
          }}
        >
          {typeof log.estimatedCost === "number"
            ? `$${log.estimatedCost.toFixed(6)}`
            : "-"}
        </td>
        <td style={{ textAlign: "center" }}>
          {log.retryCount > 0 ? (
            <span className="badge badge-warning" style={{ fontSize: 11 }}>
              {log.retryCount}
            </span>
          ) : (
            <span
              style={{
                color: "var(--color-text-muted)",
                fontSize: 12,
              }}
            >
              0
            </span>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr style={{ background: "var(--color-bg)" }}>
          <td colSpan={11} style={{ padding: 0 }}>
            <div className="anim-collapse is-open">
              <div className="anim-collapse-inner">
                <div
                  className="animate-fade-in"
                  style={{
                    padding: "14px 20px 14px 40px",
                    borderTop: "1px solid var(--color-border-light)",
                    borderBottom: "1px solid var(--color-border-light)",
                    fontSize: 12,
                    lineHeight: 1.9,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <div style={{ display: "flex", gap: 6 }}>
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--color-warning)",
                        flexShrink: 0,
                      }}
                    >
                      日志详情
                    </span>
                    <div>
                      <div>
                        请求模型:{" "}
                        <strong style={{ color: "var(--color-text-primary)" }}>
                          {detailLog.modelRequested}
                        </strong>
                        {detailLog.modelActual &&
                          detailLog.modelActual !== detailLog.modelRequested && (
                            <>
                              {" -> "}实际模型:{" "}
                              <strong
                                style={{ color: "var(--color-text-primary)" }}
                              >
                                {detailLog.modelActual}
                              </strong>
                            </>
                          )}
                        ，状态:{" "}
                        <strong
                          style={{
                            color:
                              detailLog.status === "success"
                                ? "var(--color-success)"
                                : "var(--color-danger)",
                          }}
                        >
                          {detailLog.status === "success" ? "成功" : "失败"}
                        </strong>
                        {streamModeLabel && (
                          <>
                            ，模式:{" "}
                            <strong
                              style={{ color: "var(--color-text-primary)" }}
                            >
                              {streamModeLabel}
                            </strong>
                          </>
                        )}
                        {firstByteLabel && (
                          <>
                            ，首字:{" "}
                            <strong
                              style={{
                                color: firstByteColor(
                                  detailLog.firstByteLatencyMs ?? 0,
                                ),
                              }}
                            >
                              {formatLatency(
                                detailLog.firstByteLatencyMs ?? 0,
                              )}
                            </strong>
                          </>
                        )}
                        ，用时:{" "}
                        <strong
                          style={{ color: latencyColor(detailLog.latencyMs) }}
                        >
                          {formatLatency(detailLog.latencyMs)}
                        </strong>
                        {detail && (
                          <>
                            ，站点:{" "}
                            <strong
                              style={{ color: "var(--color-text-primary)" }}
                            >
                              {detailLog.siteName || "未知站点"}
                            </strong>
                            ，账号:{" "}
                            <strong
                              style={{ color: "var(--color-text-primary)" }}
                            >
                              {detailLog.username || "未知账号"}
                            </strong>
                          </>
                        )}
                      </div>
                      {detailState?.loading && (
                        <div style={{ color: "var(--color-text-muted)" }}>
                          加载详情中...
                        </div>
                      )}
                      {detailState?.error && (
                        <div style={{ color: "var(--color-danger)" }}>
                          {detailState.error}
                        </div>
                      )}
                      {billingDetailSummary && (
                        <div style={{ color: "var(--color-text-muted)" }}>
                          {billingDetailSummary}
                        </div>
                      )}
                      <div style={{ color: "var(--color-text-muted)" }}>
                        用量来源：
                        {formatProxyLogUsageSource(
                          detailLog.usageSource ?? pathMeta.usageSource,
                        ) || "未知"}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--color-text-muted)",
                            flexShrink: 0,
                          }}
                        >
                          客户端
                        </span>
                        <div style={{ minWidth: 0 }}>
                          {renderProxyLogClientCell(detailLog, {
                            includeGeneric: true,
                          })}
                        </div>
                      </div>
                      {downstreamKeySummary && (
                        <div style={{ color: "var(--color-text-muted)" }}>
                          {downstreamKeySummary}
                        </div>
                      )}
                    </div>
                  </div>

                  {detailLog.billingDetails &&
                    detailLog.billingDetails.usage.cacheReadTokens > 0 && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: "var(--color-warning)",
                            flexShrink: 0,
                          }}
                        >
                          缓存 Tokens
                        </span>
                        <span>
                          {detailLog.billingDetails.usage.cacheReadTokens.toLocaleString()}
                        </span>
                      </div>
                    )}

                  {detailLog.billingDetails &&
                    detailLog.billingDetails.usage.cacheCreationTokens > 0 && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: "var(--color-warning)",
                            flexShrink: 0,
                          }}
                        >
                          缓存创建 Tokens
                        </span>
                        <span>
                          {detailLog.billingDetails.usage.cacheCreationTokens.toLocaleString()}
                        </span>
                      </div>
                    )}

                  <div style={{ display: "flex", gap: 6 }}>
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--color-info)",
                        flexShrink: 0,
                      }}
                    >
                      计费过程
                    </span>
                    {billingProcessLines.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        {billingProcessLines.map((line, index) => (
                          <span key={`${log.id}-billing-${index}`}>{line}</span>
                        ))}
                        <span style={{ color: "var(--color-text-muted)" }}>
                          仅供参考，以实际扣费为准
                        </span>
                      </div>
                    ) : (
                      <span>
                        输入 {formatProxyLogTokenValue(detailLog.promptTokens)}{" "}
                        tokens{" + "}输出{" "}
                        {formatProxyLogTokenValue(detailLog.completionTokens)}{" "}
                        tokens{" = "}总计{" "}
                        {formatProxyLogTokenValue(detailLog.totalTokens)} tokens
                        {typeof detailLog.estimatedCost === "number" && (
                          <>
                            ，预估费用{" "}
                            <strong
                              style={{ color: "var(--color-text-primary)" }}
                            >
                              ${detailLog.estimatedCost.toFixed(6)}
                            </strong>
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--color-primary)",
                        flexShrink: 0,
                      }}
                    >
                      下游请求路径
                    </span>
                    {detail && pathMeta.downstreamPath ? (
                      <code
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          background: "var(--color-bg-card)",
                          padding: "1px 8px",
                          borderRadius: 4,
                          border: "1px solid var(--color-border-light)",
                        }}
                      >
                        {pathMeta.downstreamPath}
                      </code>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>
                        未记录
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--color-primary)",
                        flexShrink: 0,
                      }}
                    >
                      上游请求路径
                    </span>
                    {detail && pathMeta.upstreamPath ? (
                      <code
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          background: "var(--color-bg-card)",
                          padding: "1px 8px",
                          borderRadius: 4,
                          border: "1px solid var(--color-border-light)",
                        }}
                      >
                        {pathMeta.upstreamPath}
                      </code>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>
                        未记录
                      </span>
                    )}
                  </div>

                  {detail && pathMeta.errorMessage.trim().length > 0 && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--color-danger)",
                          flexShrink: 0,
                        }}
                      >
                        错误信息
                      </span>
                      <span
                        style={{
                          color: "var(--color-danger)",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {pathMeta.errorMessage}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

function ProxyLogDesktopTable({
  logs,
  expandedLogId,
  detailById,
  siteIdByName,
  onToggleExpand,
}: Omit<ProxyLogResultsSurfaceProps, "loading" | "isMobile">) {
  return (
    <table className="data-table" style={{ width: "100%" }}>
      <thead>
        <tr>
          <th style={{ width: 28 }} />
          <th>时间</th>
          <th>模型</th>
          <th>站点</th>
          <th>客户端</th>
          <th>{tr("状态")}</th>
          <th style={{ textAlign: "center" }}>用时</th>
          <th style={{ textAlign: "right" }}>输入</th>
          <th style={{ textAlign: "right" }}>输出</th>
          <th style={{ textAlign: "right" }}>花费</th>
          <th style={{ textAlign: "center" }}>重试</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <ProxyLogDesktopRows
            key={log.id}
            log={log}
            detailState={detailById[log.id]}
            isExpanded={expandedLogId === log.id}
            siteIdByName={siteIdByName}
            onToggleExpand={onToggleExpand}
          />
        ))}
      </tbody>
    </table>
  );
}

function ProxyLogMobileList({
  logs,
  expandedLogId,
  detailById,
  siteIdByName,
  onToggleExpand,
}: Omit<ProxyLogResultsSurfaceProps, "loading" | "isMobile">) {
  return (
    <div className="mobile-card-list">
      {logs.map((log) => (
        <ProxyLogMobileCard
          key={log.id}
          log={log}
          detailState={detailById[log.id]}
          isExpanded={expandedLogId === log.id}
          siteIdByName={siteIdByName}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  );
}

function EmptyProxyLogResults() {
  return (
    <div className="empty-state">
      <svg
        className="empty-state-icon"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
      <div className="empty-state-title">{tr("暂无使用日志")}</div>
      <div className="empty-state-desc">当请求通过代理时，日志将显示在这里</div>
    </div>
  );
}

export default function ProxyLogResultsSurface({
  logs,
  loading,
  isMobile,
  expandedLogId,
  detailById,
  siteIdByName,
  onToggleExpand,
}: ProxyLogResultsSurfaceProps) {
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      {loading ? (
        <ResultsLoadingSkeleton />
      ) : isMobile ? (
        <ProxyLogMobileList
          logs={logs}
          expandedLogId={expandedLogId}
          detailById={detailById}
          siteIdByName={siteIdByName}
          onToggleExpand={onToggleExpand}
        />
      ) : (
        <ProxyLogDesktopTable
          logs={logs}
          expandedLogId={expandedLogId}
          detailById={detailById}
          siteIdByName={siteIdByName}
          onToggleExpand={onToggleExpand}
        />
      )}
      {!loading && logs.length === 0 && <EmptyProxyLogResults />}
    </div>
  );
}
