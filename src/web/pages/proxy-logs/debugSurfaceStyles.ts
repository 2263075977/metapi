import type React from "react";

export const formInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  fontSize: 13,
  outline: "none",
  background: "var(--color-bg)",
  color: "var(--color-text-primary)",
};

export const formSectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 14,
  border: "1px solid var(--color-border-light)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-bg-card)",
};

export const formSectionLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-text-secondary)",
  letterSpacing: "0.02em",
};

export const debugCheckboxRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--color-text-primary)",
};

export const debugCodeBlockStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  margin: 0,
  padding: 12,
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border-light)",
  background: "var(--color-bg)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  lineHeight: 1.5,
  overflowX: "auto",
};

export const detailInfoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

export const detailInfoItemStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

export const detailInfoLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--color-text-muted)",
};

export const detailInfoValueStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--color-text-primary)",
  fontWeight: 600,
  minWidth: 0,
  wordBreak: "break-word",
};

export const detailSectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-text-primary)",
};
