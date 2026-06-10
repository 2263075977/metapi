import React from "react";

import type { ProxyLogsSummary, ProxyLogStatusFilter } from "../../api.js";
import ModernSelect from "../../components/ModernSelect.js";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.js";
import { tr } from "../../i18n.js";

type SelectOptions = React.ComponentProps<typeof ModernSelect>["options"];

type ProxyLogControlsSurfaceProps = {
  isMobile: boolean;
  mobileOpen: boolean;
  activeSiteLabel: string;
  summary: ProxyLogsSummary;
  autoRefresh: boolean;
  loading: boolean;
  statusFilter: ProxyLogStatusFilter;
  clientFilter: string;
  siteFilter: number | null;
  fromInput: string;
  toInput: string;
  searchInput: string;
  clientOptions: SelectOptions;
  siteOptions: SelectOptions;
  onMobileOpen: () => void;
  onMobileClose: () => void;
  onToggleAutoRefresh: () => void;
  onRefresh: () => Promise<void> | void;
  onStatusFilterChange: (status: ProxyLogStatusFilter) => void;
  onClientFilterChange: (client: string) => void;
  onSiteFilterChange: (siteId: number | null) => void;
  onFromInputChange: (value: string) => void;
  onToInputChange: (value: string) => void;
  onSearchInputChange: (value: string) => void;
  onResetFilters: () => void;
};

type ProxyLogPaginationControlsProps = {
  total: number;
  displayedStart: number;
  displayedEnd: number;
  safePage: number;
  totalPages: number;
  pageNumbers: number[];
  pageSize: number;
  pageSizeOptions: number[];
  onPreviousPage: () => void;
  onSelectPage: (page: number) => void;
  onNextPage: () => void;
  onPageSizeChange: (pageSize: number) => void;
};

function ProxyLogFilterControls({
  summary,
  statusFilter,
  clientFilter,
  siteFilter,
  fromInput,
  toInput,
  searchInput,
  clientOptions,
  siteOptions,
  onStatusFilterChange,
  onClientFilterChange,
  onSiteFilterChange,
  onFromInputChange,
  onToInputChange,
  onSearchInputChange,
  onResetFilters,
}: Pick<
  ProxyLogControlsSurfaceProps,
  | "summary"
  | "statusFilter"
  | "clientFilter"
  | "siteFilter"
  | "fromInput"
  | "toInput"
  | "searchInput"
  | "clientOptions"
  | "siteOptions"
  | "onStatusFilterChange"
  | "onClientFilterChange"
  | "onSiteFilterChange"
  | "onFromInputChange"
  | "onToInputChange"
  | "onSearchInputChange"
  | "onResetFilters"
>) {
  const statusTabs: Array<{
    key: ProxyLogStatusFilter;
    label: string;
    count: number;
  }> = [
    { key: "all", label: "全部", count: summary.totalCount },
    { key: "success", label: "成功", count: summary.successCount },
    { key: "failed", label: "失败", count: summary.failedCount },
  ];

  return (
    <>
      <div className="pill-tabs">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`pill-tab ${statusFilter === tab.key ? "active" : ""}`}
            onClick={() => onStatusFilterChange(tab.key)}
          >
            {tab.label}{" "}
            <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.7 }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>
      <div className="proxy-logs-filter-select">
        <ModernSelect
          size="sm"
          value={clientFilter}
          onChange={onClientFilterChange}
          options={clientOptions}
          placeholder="全部客户端"
        />
      </div>
      <div className="proxy-logs-filter-select">
        <ModernSelect
          size="sm"
          value={siteFilter ? String(siteFilter) : ""}
          onChange={(nextValue) =>
            onSiteFilterChange(nextValue ? Number(nextValue) : null)
          }
          options={siteOptions}
          placeholder="全部站点"
        />
      </div>
      <label className="proxy-logs-time-field">
        <span>开始</span>
        <input
          type="datetime-local"
          value={fromInput}
          max={toInput || undefined}
          onChange={(e) => onFromInputChange(e.target.value)}
        />
      </label>
      <label className="proxy-logs-time-field">
        <span>结束</span>
        <input
          type="datetime-local"
          value={toInput}
          min={fromInput || undefined}
          onChange={(e) => onToInputChange(e.target.value)}
        />
      </label>
      <div className="toolbar-search" style={{ maxWidth: 280 }}>
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
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          placeholder="搜索模型、下游 Key、主分组、标签..."
        />
      </div>
      <button
        type="button"
        className="btn btn-ghost proxy-logs-filter-reset"
        onClick={onResetFilters}
      >
        清空筛选
      </button>
    </>
  );
}

export default function ProxyLogControlsSurface({
  isMobile,
  mobileOpen,
  activeSiteLabel,
  summary,
  autoRefresh,
  loading,
  statusFilter,
  clientFilter,
  siteFilter,
  fromInput,
  toInput,
  searchInput,
  clientOptions,
  siteOptions,
  onMobileOpen,
  onMobileClose,
  onToggleAutoRefresh,
  onRefresh,
  onStatusFilterChange,
  onClientFilterChange,
  onSiteFilterChange,
  onFromInputChange,
  onToInputChange,
  onSearchInputChange,
  onResetFilters,
}: ProxyLogControlsSurfaceProps) {
  const filterControls = (
    <ProxyLogFilterControls
      summary={summary}
      statusFilter={statusFilter}
      clientFilter={clientFilter}
      siteFilter={siteFilter}
      fromInput={fromInput}
      toInput={toInput}
      searchInput={searchInput}
      clientOptions={clientOptions}
      siteOptions={siteOptions}
      onStatusFilterChange={onStatusFilterChange}
      onClientFilterChange={onClientFilterChange}
      onSiteFilterChange={onSiteFilterChange}
      onFromInputChange={onFromInputChange}
      onToInputChange={onToInputChange}
      onSearchInputChange={onSearchInputChange}
      onResetFilters={onResetFilters}
    />
  );

  return (
    <>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="page-title">{tr("使用日志")}</h2>
          <div className="page-subtitle">
            按站点、客户端和时间筛选代理请求，并在需要时查看最近调试追踪。
          </div>
        </div>
        <div
          className="page-actions"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <span className="kpi-chip">{activeSiteLabel}</span>
          <span className="kpi-chip kpi-chip-success">
            消耗总额 ${summary.totalCost.toFixed(4)}
          </span>
          <span className="kpi-chip kpi-chip-warning">
            {summary.totalTokensAll.toLocaleString()} tokens
          </span>
          <button
            type="button"
            onClick={onToggleAutoRefresh}
            className={`btn btn-ghost${autoRefresh ? " btn-ghost-active" : ""}`}
            style={{
              border: "1px solid var(--color-border)",
              padding: "6px 14px",
            }}
            title={autoRefresh ? "关闭自动刷新" : "开启自动刷新（每2秒）"}
          >
            <svg
              width="14"
              height="14"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{
                animation: autoRefresh ? "spin 1s linear infinite" : "none",
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {autoRefresh ? "自动刷新中" : "自动刷新"}
          </button>
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={loading}
            className="btn btn-ghost"
            style={{
              border: "1px solid var(--color-border)",
              padding: "6px 14px",
            }}
          >
            <svg
              width="14"
              height="14"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{
                animation: loading ? "spin 1s linear infinite" : "none",
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {loading ? "加载中..." : "刷新"}
          </button>
        </div>
      </div>

      <ResponsiveFilterPanel
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onMobileOpen={onMobileOpen}
        onMobileClose={onMobileClose}
        mobileTitle={tr("筛选日志")}
        mobileContent={filterControls}
        desktopContent={
          <div className="toolbar" style={{ marginBottom: 12 }}>
            {filterControls}
          </div>
        }
      />
    </>
  );
}

export function ProxyLogInvalidTimeRangeAlert({
  visible,
}: {
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="alert alert-error" style={{ marginBottom: 12 }}>
      结束时间必须晚于开始时间
    </div>
  );
}

export function ProxyLogPaginationControls({
  total,
  displayedStart,
  displayedEnd,
  safePage,
  totalPages,
  pageNumbers,
  pageSize,
  pageSizeOptions,
  onPreviousPage,
  onSelectPage,
  onNextPage,
  onPageSizeChange,
}: ProxyLogPaginationControlsProps) {
  if (total <= 0) return null;

  return (
    <div className="pagination">
      <div
        style={{
          fontSize: 12,
          color: "var(--color-text-muted)",
          marginRight: "auto",
        }}
      >
        显示第 {displayedStart} - {displayedEnd} 条，共 {total} 条
      </div>
      <button
        type="button"
        className="pagination-btn"
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
      {pageNumbers.map((num) => (
        <button
          key={num}
          type="button"
          className={`pagination-btn ${safePage === num ? "active" : ""}`}
          onClick={() => onSelectPage(num)}
        >
          {num}
        </button>
      ))}
      <button
        type="button"
        className="pagination-btn"
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
      <div className="pagination-size">
        每页条数:
        <div style={{ minWidth: 86 }}>
          <ModernSelect
            size="sm"
            value={String(pageSize)}
            onChange={(nextValue) => onPageSizeChange(Number(nextValue))}
            options={pageSizeOptions.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            placeholder={String(pageSize)}
          />
        </div>
      </div>
    </div>
  );
}
