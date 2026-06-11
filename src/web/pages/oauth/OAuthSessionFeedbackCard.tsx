import type { OAuthRouteUnitStrategy } from '../../api.js';

type OAuthSessionRouteUnitFeedback = {
  action: 'created' | 'deleted';
  name: string;
  memberCount: number;
  strategy: OAuthRouteUnitStrategy;
};

type OAuthSessionFeedback = {
  message: string;
  tone: 'info' | 'success' | 'error';
  routeUnit?: OAuthSessionRouteUnitFeedback | null;
};

type OAuthSessionFeedbackCardProps = {
  feedback: OAuthSessionFeedback;
  resolveRouteUnitStrategyLabel: (strategy?: OAuthRouteUnitStrategy | null) => string;
};

export default function OAuthSessionFeedbackCard({
  feedback,
  resolveRouteUnitStrategyLabel,
}: OAuthSessionFeedbackCardProps) {
  return (
    <div className={`card oauth-page-message oauth-page-message-${feedback.tone}`.trim()}>
      <div className="oauth-page-message-head">
        <div className="oauth-page-message-text">{feedback.message}</div>
        <span className={`badge ${feedback.tone === 'success' ? 'badge-success' : feedback.tone === 'error' ? 'badge-danger' : 'badge-info'}`}>
          {feedback.tone === 'success' ? '成功' : feedback.tone === 'error' ? '失败' : '提示'}
        </span>
      </div>
      {feedback.routeUnit ? (
        <div className="oauth-page-message-meta">
          <span className="badge badge-info">{feedback.routeUnit.name}</span>
          <span className="badge badge-muted">{feedback.routeUnit.memberCount} 个成员</span>
          <span className="badge badge-muted">{resolveRouteUnitStrategyLabel(feedback.routeUnit.strategy)}</span>
          <div className="oauth-page-message-detail">
            {feedback.routeUnit.action === 'created'
              ? '已将选中的 OAuth 账号合并为一个路由池，后续会以单个路由单元参与路由。'
              : '该路由池已拆分回单体账号，后续会分别参与路由。'}
          </div>
        </div>
      ) : null}
    </div>
  );
}
