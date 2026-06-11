import CenteredModal from '../../components/CenteredModal.js';
import ModernSelect from '../../components/ModernSelect.js';
import type { OAuthRouteUnitStrategy } from '../../api.js';

type OAuthRouteUnitModalProps = {
  open: boolean;
  name: string;
  strategy: OAuthRouteUnitStrategy;
  creating: boolean;
  canCreate: boolean;
  onClose: () => void;
  onCreate: () => void | Promise<void>;
  onNameChange: (value: string) => void;
  onStrategyChange: (value: OAuthRouteUnitStrategy) => void;
};

export default function OAuthRouteUnitModal({
  open,
  name,
  strategy,
  creating,
  canCreate,
  onClose,
  onCreate,
  onNameChange,
  onStrategyChange,
}: OAuthRouteUnitModalProps) {
  return (
    <CenteredModal
      open={open}
      onClose={onClose}
      title="创建路由池"
      maxWidth={520}
      bodyStyle={{ display: 'grid', gap: 16 }}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onCreate}
            disabled={creating || !canCreate}
          >
            {creating ? '创建中...' : '创建路由池'}
          </button>
        </>
      )}
    >
      <div className="oauth-form-field">
        <div className="oauth-field-label">路由池名称</div>
        <input
          type="text"
          className="oauth-input"
          data-testid="oauth-route-unit-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="例如 Codex Pool"
        />
      </div>
      <div className="oauth-form-field">
        <div className="oauth-field-label">策略</div>
        <ModernSelect
          value={strategy}
          onChange={(value) =>
            onStrategyChange(String(value || 'round_robin') as OAuthRouteUnitStrategy)
          }
          options={[
            { value: 'round_robin', label: '轮询' },
            { value: 'stick_until_unavailable', label: '单个用到不可用再切' },
          ]}
          placeholder="选择路由池策略"
        />
      </div>
    </CenteredModal>
  );
}
