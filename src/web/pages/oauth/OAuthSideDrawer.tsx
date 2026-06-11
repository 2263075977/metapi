import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAnimatedVisibility } from '../../components/useAnimatedVisibility.js';

type OAuthSideDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
};

export default function OAuthSideDrawer({
  open,
  onClose,
  title,
  children,
}: OAuthSideDrawerProps) {
  const presence = useAnimatedVisibility(open, 220);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!presence.shouldRender) return null;

  const panel = (
    <div
      className={`modal-backdrop oauth-drawer-backdrop ${presence.isVisible ? '' : 'is-closing'}`.trim()}
      onClick={onClose}
    >
      <div
        className={`modal-content oauth-drawer-content ${presence.isVisible ? '' : 'is-closing'}`.trim()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header oauth-drawer-header">
          <div className="modal-title">{title}</div>
          <button
            type="button"
            className="modal-close-button oauth-drawer-close"
            onClick={onClose}
            aria-label="关闭 OAuth 抽屉"
          >
            ×
          </button>
        </div>
        <div className="modal-body oauth-drawer-body">
          {children}
        </div>
      </div>
    </div>
  );

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  return portalTarget ? createPortal(panel, portalTarget) : panel;
}
