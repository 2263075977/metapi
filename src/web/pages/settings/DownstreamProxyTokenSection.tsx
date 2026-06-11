import type React from "react";

interface DownstreamProxyTokenSectionProps {
  prefix: string;
  currentMasked: string;
  suffix: string;
  inputStyle: React.CSSProperties;
  saving: boolean;
  onSuffixChange: (value: string) => void;
  onGenerate: () => void;
  onSave: () => void | Promise<void>;
}

export default function DownstreamProxyTokenSection({
  prefix,
  currentMasked,
  suffix,
  inputStyle,
  saving,
  onSuffixChange,
  onGenerate,
  onSave,
}: DownstreamProxyTokenSectionProps) {
  return (
    <div className="card animate-slide-up stagger-4" style={{ padding: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
        下游访问令牌（PROXY_TOKEN）
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--color-text-muted)",
          marginBottom: 12,
        }}
      >
        用于下游站点或客户端访问本服务代理接口。前缀 sk- 固定不可修改，只需填写后缀。
      </div>
      <code
        style={{
          display: "block",
          padding: "10px 14px",
          background: "var(--color-bg)",
          borderRadius: "var(--radius-sm)",
          fontSize: 13,
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-secondary)",
          border: "1px solid var(--color-border-light)",
          marginBottom: 10,
        }}
      >
        当前：{currentMasked || "未设置"}
      </code>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "stretch",
          marginBottom: 10,
          minWidth: 0,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            ...inputStyle,
            flex: 1,
            minWidth: 200,
            marginBottom: 0,
            padding: 0,
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              padding: "10px 12px",
              borderRight: "1px solid var(--color-border-light)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--color-text-secondary)",
              userSelect: "none",
              background:
                "color-mix(in srgb, var(--color-text-muted) 6%, transparent)",
            }}
          >
            {prefix}
          </span>
          <input
            type="text"
            value={suffix}
            onChange={(event) => onSuffixChange(event.target.value)}
            placeholder="请输入 sk- 后的令牌内容"
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              padding: "10px 12px",
            }}
          />
        </div>
        <button
          type="button"
          className="btn btn-soft-primary"
          aria-label="随机生成访问令牌后缀"
          title="生成高熵随机后缀（不会自动保存）"
          style={{
            flexShrink: 0,
            padding: "10px 18px",
            fontSize: 13,
            gap: 8,
            alignSelf: "stretch",
          }}
          onClick={onGenerate}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
          随机生成
        </button>
      </div>
      <button onClick={onSave} disabled={saving} className="btn btn-primary">
        {saving ? (
          <>
            <span
              className="spinner spinner-sm"
              style={{
                borderTopColor: "white",
                borderColor: "rgba(255,255,255,0.3)",
              }}
            />{" "}
            保存中...
          </>
        ) : (
          "更新下游访问令牌"
        )}
      </button>
    </div>
  );
}
