import type React from "react";
import CenteredModal from "../../components/CenteredModal.js";

export interface AccountRebindFormState {
  accessToken: string;
  platformUserId: string;
  refreshToken: string;
  tokenExpiresAt: string;
}

interface AccountRebindSessionModalProps {
  target: any | null;
  form: AccountRebindFormState;
  verifyResult: any;
  verifying: boolean;
  saving: boolean;
  isSub2Api: boolean;
  inputStyle: React.CSSProperties;
  onFormChange: React.Dispatch<React.SetStateAction<AccountRebindFormState>>;
  onClearVerifyResult: () => void;
  onClose: () => void;
  onVerify: () => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
  resolveAccountDisplayName: (account: any) => string;
}

export default function AccountRebindSessionModal({
  target,
  form,
  verifyResult,
  verifying,
  saving,
  isSub2Api,
  inputStyle,
  onFormChange,
  onClearVerifyResult,
  onClose,
  onVerify,
  onSubmit,
  resolveAccountDisplayName,
}: AccountRebindSessionModalProps) {
  return (
    <CenteredModal
      open={Boolean(target)}
      onClose={onClose}
      title="重新绑定 Session Token"
      maxWidth={820}
      bodyStyle={{ display: "flex", flexDirection: "column", gap: 12 }}
      footer={
        <button onClick={onClose} className="btn btn-ghost">
          取消
        </button>
      }
    >
      {target ? (
        <>
          <div
            style={{
              fontSize: 12,
              color: "var(--color-text-muted)",
              marginBottom: 12,
            }}
          >
            连接: {resolveAccountDisplayName(target)} @{" "}
            {target.site?.name || "-"}。请粘贴新的 Session Token，验证成功后再绑定。
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 220px",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <textarea
              placeholder="粘贴新的 Session Token"
              value={form.accessToken}
              onChange={(event) => {
                onFormChange((prev) => ({
                  ...prev,
                  accessToken: event.target.value.trim(),
                }));
                onClearVerifyResult();
              }}
              style={{
                ...inputStyle,
                fontFamily: "var(--font-mono)",
                height: 74,
                resize: "none" as const,
              }}
            />
            <input
              placeholder="用户 ID（可选）"
              value={form.platformUserId}
              onChange={(event) => {
                onFormChange((prev) => ({
                  ...prev,
                  platformUserId: event.target.value.replace(/\D/g, ""),
                }));
                onClearVerifyResult();
              }}
              style={inputStyle}
            />
          </div>
          {isSub2Api && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 220px",
                  gap: 10,
                  marginBottom: 4,
                }}
              >
                <input
                  placeholder="Sub2API refresh_token（可选）"
                  value={form.refreshToken}
                  onChange={(event) =>
                    onFormChange((prev) => ({
                      ...prev,
                      refreshToken: event.target.value.trim(),
                    }))
                  }
                  style={{
                    ...inputStyle,
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <input
                  placeholder="token_expires_at（可选）"
                  value={form.tokenExpiresAt}
                  onChange={(event) =>
                    onFormChange((prev) => ({
                      ...prev,
                      tokenExpiresAt: event.target.value.replace(/\D/g, ""),
                    }))
                  }
                  style={inputStyle}
                />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  marginBottom: 10,
                }}
              >
                留空将保持原有 refresh_token 不变。配置后可用于托管自动续期。
              </div>
            </>
          )}

          {verifyResult &&
            verifyResult.success &&
            verifyResult.tokenType === "session" && (
              <div
                className="alert alert-success animate-scale-in"
                style={{ marginBottom: 10 }}
              >
                <div className="alert-title">Session Token 有效</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  用户: {verifyResult.userInfo?.username || "未知"}
                  {verifyResult.apiToken
                    ? `，已识别 API Key (${String(verifyResult.apiToken).slice(0, 8)}...)`
                    : ""}
                </div>
              </div>
            )}
          {verifyResult &&
            (!verifyResult.success || verifyResult.tokenType !== "session") && (
              <div
                className="alert alert-error animate-scale-in"
                style={{ marginBottom: 10 }}
              >
                <div className="alert-title">
                  {verifyResult.message || "Token 无效或类型不正确"}
                </div>
              </div>
            )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onVerify}
              disabled={verifying || !form.accessToken.trim()}
              className="btn btn-ghost"
              style={{ border: "1px solid var(--color-border)" }}
            >
              {verifying ? (
                <>
                  <span className="spinner spinner-sm" />
                  验证中...
                </>
              ) : (
                "验证 Token"
              )}
            </button>
            <button
              onClick={onSubmit}
              disabled={
                saving ||
                !(
                  verifyResult?.success && verifyResult?.tokenType === "session"
                )
              }
              className="btn btn-success"
            >
              {saving ? (
                <>
                  <span
                    className="spinner spinner-sm"
                    style={{
                      borderTopColor: "white",
                      borderColor: "rgba(255,255,255,0.3)",
                    }}
                  />
                  绑定中...
                </>
              ) : (
                "确认重新绑定"
              )}
            </button>
          </div>
        </>
      ) : null}
    </CenteredModal>
  );
}
