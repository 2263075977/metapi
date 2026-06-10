type StoredDebugPreviewPayload = {
  __metapiTruncated?: boolean;
  preview?: string;
  originalBytes?: number;
  storedBytes?: number;
};

export function stringifyStoredDebugValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function parseStoredDebugPreview(value: unknown): {
  raw: string | null;
  displayText: string;
  truncated: boolean;
  note: string | null;
} {
  const raw = stringifyStoredDebugValue(value);
  if (!raw) {
    return {
      raw: null,
      displayText: "-",
      truncated: false,
      note: null,
    };
  }

  try {
    const parsed = JSON.parse(raw) as StoredDebugPreviewPayload | string;
    if (typeof parsed === "string") {
      return {
        raw,
        displayText: parsed || "-",
        truncated: false,
        note: null,
      };
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.__metapiTruncated &&
      typeof parsed.preview === "string"
    ) {
      const originalBytes = Number(parsed.originalBytes || 0);
      const storedBytes = Number(parsed.storedBytes || 0);
      return {
        raw,
        displayText: parsed.preview || "-",
        truncated: true,
        note:
          originalBytes > 0 && storedBytes > 0
            ? `内容已截断展示，原始 ${originalBytes} bytes，当前保留 ${storedBytes} bytes。复制按钮会复制当前数据库里保存的内容。`
            : "内容已截断展示。复制按钮会复制当前数据库里保存的内容。",
      };
    }
  } catch {
    // Fall through to display the saved raw value directly.
  }

  return {
    raw,
    displayText: raw,
    truncated: false,
    note: null,
  };
}
