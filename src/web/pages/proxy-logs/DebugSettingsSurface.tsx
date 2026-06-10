import React from "react";

import CenteredModal from "../../components/CenteredModal.js";
import MobileDrawer from "../../components/MobileDrawer.js";
import ResponsiveFormGrid from "../../components/ResponsiveFormGrid.js";
import {
  debugCheckboxRowStyle,
  formInputStyle,
  formSectionLabelStyle,
  formSectionStyle,
} from "./debugSurfaceStyles.js";
import type { ProxyDebugSettingsState } from "./types.js";

type DebugSettingsSurfaceProps = {
  isMobile: boolean;
  open: boolean;
  draftSettings: ProxyDebugSettingsState;
  saving: boolean;
  onClose: () => void;
  onReset: () => void;
  onSave: () => Promise<void> | void;
  onDraftSettingsChange: React.Dispatch<
    React.SetStateAction<ProxyDebugSettingsState>
  >;
};

export default function DebugSettingsSurface({
  isMobile,
  open,
  draftSettings,
  saving,
  onClose,
  onReset,
  onSave,
  onDraftSettingsChange,
}: DebugSettingsSurfaceProps) {
  const footer = (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      <button type="button" className="btn btn-ghost" onClick={onReset}>
        重置为默认值
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => void onSave()}
        disabled={saving}
      >
        {saving ? "保存中..." : "保存调试设置"}
      </button>
    </div>
  );

  const form = (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="info-tip" style={{ marginBottom: 0 }}>
        只记录开启后的新请求。需要更精确定位时，再按
        Session、客户端或模型定向过滤。
      </div>

      <div style={formSectionStyle}>
        <div style={formSectionLabelStyle}>记录内容</div>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <label style={debugCheckboxRowStyle}>
              <input
                type="checkbox"
                checked={draftSettings.proxyDebugTraceEnabled}
                data-debug-setting="trace-enabled"
                onChange={(e) =>
                  onDraftSettingsChange((current) => ({
                    ...current,
                    proxyDebugTraceEnabled: !!e.target.checked,
                  }))
                }
              />
              开启调试追踪
            </label>
            <div
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                marginLeft: 24,
              }}
            >
              后续新请求会写入调试追踪，不会回补旧请求。
            </div>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <label style={debugCheckboxRowStyle}>
              <input
                type="checkbox"
                checked={draftSettings.proxyDebugCaptureHeaders}
                data-debug-setting="capture-headers"
                onChange={(e) =>
                  onDraftSettingsChange((current) => ({
                    ...current,
                    proxyDebugCaptureHeaders: !!e.target.checked,
                  }))
                }
              />
              采集原始请求/响应头
            </label>
            <div
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                marginLeft: 24,
              }}
            >
              保留下游原始头和上游响应头，方便直接对照。
            </div>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <label style={debugCheckboxRowStyle}>
              <input
                type="checkbox"
                checked={draftSettings.proxyDebugCaptureBodies}
                data-debug-setting="capture-bodies"
                onChange={(e) =>
                  onDraftSettingsChange((current) => ({
                    ...current,
                    proxyDebugCaptureBodies: !!e.target.checked,
                  }))
                }
              />
              采集请求体和响应体
            </label>
            <div
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                marginLeft: 24,
              }}
            >
              默认不抓 body，只有显式开启后才记录。
            </div>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <label style={debugCheckboxRowStyle}>
              <input
                type="checkbox"
                checked={draftSettings.proxyDebugCaptureStreamChunks}
                data-debug-setting="capture-stream-chunks"
                onChange={(e) =>
                  onDraftSettingsChange((current) => ({
                    ...current,
                    proxyDebugCaptureStreamChunks: !!e.target.checked,
                  }))
                }
              />
              采集流式原始分片
            </label>
            <div
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                marginLeft: 24,
              }}
            >
              适合定位 SSE / streaming 过程中的兼容问题。
            </div>
          </div>
        </div>
      </div>

      <ResponsiveFormGrid columns={2}>
        <div style={formSectionStyle}>
          <div style={formSectionLabelStyle}>定向过滤</div>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              目标 Session ID
            </span>
            <input
              type="text"
              value={draftSettings.proxyDebugTargetSessionId}
              data-debug-setting="target-session-id"
              onChange={(e) =>
                onDraftSettingsChange((current) => ({
                  ...current,
                  proxyDebugTargetSessionId: e.target.value,
                }))
              }
              placeholder="留空表示不过滤"
              style={formInputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              目标客户端
            </span>
            <input
              type="text"
              value={draftSettings.proxyDebugTargetClientKind}
              data-debug-setting="target-client-kind"
              onChange={(e) =>
                onDraftSettingsChange((current) => ({
                  ...current,
                  proxyDebugTargetClientKind: e.target.value,
                }))
              }
              placeholder="如 codex / claude_code"
              style={formInputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              目标模型
            </span>
            <input
              type="text"
              value={draftSettings.proxyDebugTargetModel}
              data-debug-setting="target-model"
              onChange={(e) =>
                onDraftSettingsChange((current) => ({
                  ...current,
                  proxyDebugTargetModel: e.target.value,
                }))
              }
              placeholder="如 gpt-4o"
              style={formInputStyle}
            />
          </label>
        </div>

        <div style={formSectionStyle}>
          <div style={formSectionLabelStyle}>保留策略</div>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              保留时长（小时）
            </span>
            <input
              type="number"
              min={1}
              value={draftSettings.proxyDebugRetentionHours}
              data-debug-setting="retention-hours"
              onChange={(e) =>
                onDraftSettingsChange((current) => ({
                  ...current,
                  proxyDebugRetentionHours: Number(e.target.value || 1),
                }))
              }
              style={formInputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              抓取体积上限（字节）
            </span>
            <input
              type="number"
              min={1024}
              value={draftSettings.proxyDebugMaxBodyBytes}
              data-debug-setting="max-body-bytes"
              onChange={(e) =>
                onDraftSettingsChange((current) => ({
                  ...current,
                  proxyDebugMaxBodyBytes: Number(e.target.value || 1024),
                }))
              }
              style={formInputStyle}
            />
          </label>
        </div>
      </ResponsiveFormGrid>

      {isMobile ? footer : null}
    </div>
  );

  if (isMobile) {
    return (
      <MobileDrawer
        open={open}
        onClose={onClose}
        title="调试设置"
        closeLabel="关闭调试设置"
        side="right"
      >
        <div style={{ padding: 16, display: "grid", gap: 16 }}>{form}</div>
      </MobileDrawer>
    );
  }

  return (
    <CenteredModal
      open={open}
      onClose={onClose}
      title="调试设置"
      footer={footer}
      maxWidth={880}
      closeOnBackdrop
      closeOnEscape
    >
      {form}
    </CenteredModal>
  );
}
