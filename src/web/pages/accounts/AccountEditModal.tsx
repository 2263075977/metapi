import type React from "react";
import CenteredModal from "../../components/CenteredModal.js";
import ModernSelect from "../../components/ModernSelect.js";
import ResponsiveFormGrid from "../../components/ResponsiveFormGrid.js";

export interface AccountEditFormState {
  username: string;
  status: string;
  checkinEnabled: boolean;
  unitCost: string;
  accessToken: string;
  apiToken: string;
  isPinned: boolean;
  refreshToken: string;
  tokenExpiresAt: string;
  proxyUrl: string;
}

interface AccountEditModalProps {
  account: any | null;
  form: AccountEditFormState;
  saving: boolean;
  inputStyle: React.CSSProperties;
  onFormChange: React.Dispatch<React.SetStateAction<AccountEditFormState>>;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

export default function AccountEditModal({
  account,
  form,
  saving,
  inputStyle,
  onFormChange,
  onClose,
  onSave,
}: AccountEditModalProps) {
  return (
    <CenteredModal
      open={Boolean(account)}
      onClose={onClose}
      title="编辑账号"
      maxWidth={860}
      bodyStyle={{ display: "flex", flexDirection: "column", gap: 12 }}
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">
            取消
          </button>
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
              "保存修改"
            )}
          </button>
        </>
      }
    >
      {account ? (
        <ResponsiveFormGrid>
          <input
            placeholder="账号名称"
            value={form.username}
            onChange={(event) =>
              onFormChange((prev) => ({
                ...prev,
                username: event.target.value,
              }))
            }
            style={inputStyle}
          />
          <ModernSelect
            value={form.status}
            onChange={(value) =>
              onFormChange((prev) => ({ ...prev, status: value }))
            }
            options={[
              { value: "active", label: "active" },
              { value: "disabled", label: "disabled" },
              { value: "expired", label: "expired" },
            ]}
            placeholder="状态"
          />
          <input
            placeholder="单位成本（可选）"
            value={form.unitCost}
            onChange={(event) =>
              onFormChange((prev) => ({
                ...prev,
                unitCost: event.target.value,
              }))
            }
            style={inputStyle}
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              ...inputStyle,
            }}
          >
            <input
              type="checkbox"
              checked={form.checkinEnabled}
              onChange={(event) =>
                onFormChange((prev) => ({
                  ...prev,
                  checkinEnabled: event.target.checked,
                }))
              }
            />
            启用签到
          </label>
          <input
            placeholder="Access Token"
            value={form.accessToken}
            onChange={(event) =>
              onFormChange((prev) => ({
                ...prev,
                accessToken: event.target.value,
              }))
            }
            style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
          />
          <input
            placeholder="API Token（可选）"
            value={form.apiToken}
            onChange={(event) =>
              onFormChange((prev) => ({
                ...prev,
                apiToken: event.target.value,
              }))
            }
            style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
          />
          <input
            placeholder="代理地址（可选，如 http://127.0.0.1:7890）"
            value={form.proxyUrl}
            onChange={(event) =>
              onFormChange((prev) => ({
                ...prev,
                proxyUrl: event.target.value,
              }))
            }
            style={inputStyle}
          />
          <div
            style={{
              fontSize: 12,
              color: "var(--color-text-muted)",
              marginTop: -4,
            }}
          >
            覆盖站点和系统代理，留空则使用站点设置。支持 http/https/socks5
            协议。
          </div>
          {(account?.site?.platform || "").toLowerCase() === "sub2api" && (
            <>
              <input
                placeholder="Sub2API refresh_token（可选）"
                value={form.refreshToken}
                onChange={(event) =>
                  onFormChange((prev) => ({
                    ...prev,
                    refreshToken: event.target.value,
                  }))
                }
                style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
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
            </>
          )}
        </ResponsiveFormGrid>
      ) : null}
    </CenteredModal>
  );
}
