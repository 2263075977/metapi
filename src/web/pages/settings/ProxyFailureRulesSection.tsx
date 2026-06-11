import type React from "react";

interface ProxyFailureRulesSectionProps {
  keywordsText: string;
  emptyContentFailEnabled: boolean;
  inputStyle: React.CSSProperties;
  saving: boolean;
  onKeywordsChange: (value: string) => void;
  onEmptyContentFailChange: (checked: boolean) => void;
  onSave: () => void | Promise<void>;
}

export default function ProxyFailureRulesSection({
  keywordsText,
  emptyContentFailEnabled,
  inputStyle,
  saving,
  onKeywordsChange,
  onEmptyContentFailChange,
  onSave,
}: ProxyFailureRulesSectionProps) {
  return (
    <div className="card animate-slide-up stagger-4" style={{ padding: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
        代理失败判定
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--color-text-muted)",
          marginBottom: 12,
        }}
      >
        命中任一关键词或空内容时判定失败，可触发重试。
      </div>
      <textarea
        value={keywordsText}
        onChange={(event) => onKeywordsChange(event.target.value)}
        placeholder="一行一个关键词，或逗号分隔"
        style={{
          ...inputStyle,
          fontFamily: "var(--font-mono)",
          minHeight: 96,
          resize: "vertical",
          marginBottom: 12,
        }}
      />
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "var(--color-text-secondary)",
          marginBottom: 12,
        }}
      >
        <input
          type="checkbox"
          checked={emptyContentFailEnabled}
          onChange={(event) => onEmptyContentFailChange(event.target.checked)}
        />
        空内容（completion=0，即使 prompt 有 token 也算）判定失败
      </label>
      <div>
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
            "保存失败规则"
          )}
        </button>
      </div>
    </div>
  );
}
