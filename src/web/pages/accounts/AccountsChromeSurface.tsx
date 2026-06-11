import type React from "react";
import ResponsiveBatchActionBar from "../../components/ResponsiveBatchActionBar.js";
import ResponsiveFilterPanel from "../../components/ResponsiveFilterPanel.js";
import DeleteConfirmModal from "../../components/DeleteConfirmModal.js";
import ModernSelect from "../../components/ModernSelect.js";
import { tr } from "../../i18n.js";
import type { SortMode } from "../helpers/listSorting.js";

export type ConnectionsSegment = "session" | "apikey" | "tokens";

export type AccountDeleteConfirmState = null | {
  mode: "single" | "batch";
  accountId?: number;
  accountName?: string;
  count?: number;
};

type BatchAccountAction = "refreshBalance" | "enable" | "disable" | "delete";

const ACCOUNT_SEGMENTS: Array<{
  value: ConnectionsSegment;
  label: string;
  tooltip: string;
  tooltipSide: "top" | "bottom";
  tooltipAlign: "start" | "center" | "end";
}> = [
  {
    value: "session",
    label: "账号管理",
    tooltip: "用于签到、余额、状态维护",
    tooltipSide: "bottom",
    tooltipAlign: "start",
  },
  {
    value: "apikey",
    label: "API Key管理",
    tooltip: "只有 Base URL + Key 时使用，只负责代理调用",
    tooltipSide: "bottom",
    tooltipAlign: "center",
  },
  {
    value: "tokens",
    label: "账号令牌管理",
    tooltip: "从账号同步或手动维护，供路由实际调用",
    tooltipSide: "bottom",
    tooltipAlign: "end",
  },
];

interface AccountsChromeSurfaceProps {
  activeSegment: ConnectionsSegment;
  embeddedTokenActions: React.ReactNode;
  isMobile: boolean;
  showMobileTools: boolean;
  sortMode: SortMode;
  showAdd: boolean;
  allVisibleAccountsSelected: boolean;
  selectedAccountCount: number;
  checkinAllLoading: boolean;
  healthRefreshLoading: boolean;
  batchActionLoading: boolean;
  deleteConfirm: AccountDeleteConfirmState;
  deleteLoading: boolean;
  onOpenMobileTools: () => void;
  onCloseMobileTools: () => void;
  onSortModeChange: (mode: SortMode) => void;
  onToggleSelectAllVisibleAccounts: (checked: boolean) => void;
  onCheckinAll: () => Promise<void> | void;
  onRefreshRuntimeHealth: () => Promise<void> | void;
  onToggleAdd: () => void;
  onSegmentChange: (segment: ConnectionsSegment) => void;
  onBatchAction: (action: BatchAccountAction) => Promise<void> | void;
  onCloseDeleteConfirm: () => void;
  onConfirmDelete: () => Promise<void> | void;
}

const SORT_OPTIONS = [
  { value: "custom", label: "自定义排序" },
  { value: "balance-desc", label: "余额高到低" },
  { value: "balance-asc", label: "余额低到高" },
];

export default function AccountsChromeSurface({
  activeSegment,
  embeddedTokenActions,
  isMobile,
  showMobileTools,
  sortMode,
  showAdd,
  allVisibleAccountsSelected,
  selectedAccountCount,
  checkinAllLoading,
  healthRefreshLoading,
  batchActionLoading,
  deleteConfirm,
  deleteLoading,
  onOpenMobileTools,
  onCloseMobileTools,
  onSortModeChange,
  onToggleSelectAllVisibleAccounts,
  onCheckinAll,
  onRefreshRuntimeHealth,
  onToggleAdd,
  onSegmentChange,
  onBatchAction,
  onCloseDeleteConfirm,
  onConfirmDelete,
}: AccountsChromeSurfaceProps) {
  return (
    <>
      <div className="page-header">
        <h2 className="page-title">{tr("连接管理")}</h2>
        {activeSegment !== "tokens" && (
          <div className="page-actions accounts-page-actions">
            {isMobile ? (
              <>
                <button
                  type="button"
                  onClick={onOpenMobileTools}
                  className="btn btn-ghost"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  排序与操作
                </button>
                <button
                  type="button"
                  data-testid="accounts-mobile-select-all"
                  onClick={() =>
                    onToggleSelectAllVisibleAccounts(
                      !allVisibleAccountsSelected,
                    )
                  }
                  className="btn btn-ghost"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  {allVisibleAccountsSelected ? "取消全选" : "全选可见项"}
                </button>
              </>
            ) : (
              <>
                <div
                  className="accounts-sort-select"
                  style={{ minWidth: 156, position: "relative", zIndex: 20 }}
                >
                  <ModernSelect
                    size="sm"
                    value={sortMode}
                    onChange={(nextValue) =>
                      onSortModeChange(nextValue as SortMode)
                    }
                    options={SORT_OPTIONS}
                    placeholder="自定义排序"
                  />
                </div>
                {activeSegment === "session" && (
                  <button
                    onClick={onCheckinAll}
                    disabled={checkinAllLoading}
                    className="btn btn-soft-primary"
                  >
                    {checkinAllLoading ? (
                      <>
                        <span className="spinner spinner-sm" />
                        {tr("签到中...")}
                      </>
                    ) : (
                      tr("全部签到")
                    )}
                  </button>
                )}
                <button
                  onClick={onRefreshRuntimeHealth}
                  disabled={healthRefreshLoading}
                  className="btn btn-soft-primary"
                >
                  {healthRefreshLoading ? (
                    <>
                      <span className="spinner spinner-sm" />
                      {tr("刷新状态中...")}
                    </>
                  ) : (
                    tr("刷新账户状态")
                  )}
                </button>
              </>
            )}
            <button onClick={onToggleAdd} className="btn btn-primary">
              {showAdd ? tr("取消") : tr("+ 添加连接")}
            </button>
          </div>
        )}
        {activeSegment === "tokens" && embeddedTokenActions}
      </div>

      <ResponsiveFilterPanel
        isMobile={isMobile}
        mobileOpen={showMobileTools}
        onMobileClose={onCloseMobileTools}
        mobileTitle="连接排序与操作"
        mobileContent={
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                排序方式
              </div>
              <ModernSelect
                value={sortMode}
                onChange={(nextValue) =>
                  onSortModeChange(nextValue as SortMode)
                }
                options={SORT_OPTIONS}
                placeholder="自定义排序"
              />
            </div>
            {activeSegment === "session" && (
              <button
                onClick={async () => {
                  onCloseMobileTools();
                  await onCheckinAll();
                }}
                disabled={checkinAllLoading}
                className="btn btn-ghost"
                style={{ border: "1px solid var(--color-border)" }}
              >
                {checkinAllLoading ? (
                  <>
                    <span className="spinner spinner-sm" />
                    {tr("签到中...")}
                  </>
                ) : (
                  tr("全部签到")
                )}
              </button>
            )}
            <button
              onClick={async () => {
                onCloseMobileTools();
                await onRefreshRuntimeHealth();
              }}
              disabled={healthRefreshLoading}
              className="btn btn-ghost"
              style={{ border: "1px solid var(--color-border)" }}
            >
              {healthRefreshLoading ? (
                <>
                  <span className="spinner spinner-sm" />
                  {tr("刷新状态中...")}
                </>
              ) : (
                tr("刷新账户状态")
              )}
            </button>
          </div>
        }
      />

      <div
        style={{
          display: "inline-flex",
          gap: 4,
          padding: 4,
          marginBottom: 16,
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border-light)",
          borderRadius: "var(--radius-md)",
        }}
      >
        {ACCOUNT_SEGMENTS.map((segment) => (
          <button
            key={segment.value}
            type="button"
            onClick={() => onSegmentChange(segment.value)}
            data-tooltip={segment.tooltip}
            data-tooltip-side={segment.tooltipSide}
            data-tooltip-align={segment.tooltipAlign}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              background:
                activeSegment === segment.value
                  ? "var(--color-bg)"
                  : "transparent",
              color:
                activeSegment === segment.value
                  ? "var(--color-primary)"
                  : "var(--color-text-secondary)",
              boxShadow:
                activeSegment === segment.value ? "var(--shadow-sm)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            {segment.label}
          </button>
        ))}
      </div>

      <DeleteConfirmModal
        open={Boolean(deleteConfirm)}
        onClose={onCloseDeleteConfirm}
        onConfirm={onConfirmDelete}
        title="确认删除连接"
        confirmText="确认删除"
        loading={deleteLoading}
        description={
          deleteConfirm?.mode === "single" ? (
            <>
              确定要删除连接{" "}
              <strong>
                {deleteConfirm.accountName || `#${deleteConfirm.accountId}`}
              </strong>{" "}
              吗？
            </>
          ) : (
            <>
              确定要删除选中的 <strong>{deleteConfirm?.count || 0}</strong>{" "}
              个连接吗？
            </>
          )
        }
      />

      {activeSegment !== "tokens" && selectedAccountCount > 0 && (
        <ResponsiveBatchActionBar
          isMobile={isMobile}
          info={`已选 ${selectedAccountCount} 项`}
          desktopStyle={{ marginBottom: 12 }}
        >
          <button
            data-testid="accounts-batch-refresh-balance"
            onClick={() => onBatchAction("refreshBalance")}
            disabled={batchActionLoading}
            className="btn btn-ghost"
            style={{ border: "1px solid var(--color-border)" }}
          >
            批量刷新余额
          </button>
          <button
            onClick={() => onBatchAction("enable")}
            disabled={batchActionLoading}
            className="btn btn-ghost"
            style={{ border: "1px solid var(--color-border)" }}
          >
            批量启用
          </button>
          <button
            onClick={() => onBatchAction("disable")}
            disabled={batchActionLoading}
            className="btn btn-ghost"
            style={{ border: "1px solid var(--color-border)" }}
          >
            批量禁用
          </button>
          <button
            onClick={() => onBatchAction("delete")}
            disabled={batchActionLoading}
            className="btn btn-link btn-link-danger"
          >
            批量删除
          </button>
        </ResponsiveBatchActionBar>
      )}
    </>
  );
}
