import type React from "react";

interface SystemProxyTestState {
  kind: "success" | "error";
  text: string;
}

interface SystemProxySectionProps {
  value: string;
  inputStyle: React.CSSProperties;
  saving: boolean;
  testing: boolean;
  testState: SystemProxyTestState | null;
  onChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  onTest: () => void | Promise<void>;
}

export default function SystemProxySection({
  value,
  inputStyle,
  saving,
  testing,
  testState,
  onChange,
  onSave,
  onTest,
}: SystemProxySectionProps) {
  return (
    <div className="card animate-slide-up stagger-3" style={{ padding: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
        系统代理
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--color-text-muted)",
          marginBottom: 12,
        }}
      >
        配置一个全局出站代理地址，站点页可按站点决定是否启用系统代理。
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="系统代理 URL（可选，如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080）"
        style={{
          ...inputStyle,
          fontFamily: "var(--font-mono)",
          marginBottom: 10,
        }}
      />
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
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
            "保存系统代理"
          )}
        </button>
        <button
          onClick={onTest}
          disabled={testing}
          className="btn btn-ghost"
          style={{ border: "1px solid var(--color-border)" }}
        >
          {testing ? (
            <>
              <span className="spinner spinner-sm" /> 测试中...
            </>
          ) : (
            "测试系统代理"
          )}
        </button>
      </div>
      {testState && (
        <div
          style={{
            fontSize: 12,
            marginTop: 10,
            color:
              testState.kind === "success"
                ? "var(--color-success)"
                : "var(--color-danger)",
          }}
        >
          {testState.text}
        </div>
      )}
    </div>
  );
}
