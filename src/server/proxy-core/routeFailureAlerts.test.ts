import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_DOWNSTREAM_ROUTING_POLICY } from '../services/downstreamPolicyTypes.js';

const explainSelectionMock = vi.fn();
const reportProxyAllFailedMock = vi.fn();

vi.mock('../services/tokenRouter.js', () => ({
  tokenRouter: {
    explainSelection: (...args: unknown[]) => explainSelectionMock(...args),
  },
}));

vi.mock('../services/alertService.js', () => ({
  reportProxyAllFailed: (...args: unknown[]) => reportProxyAllFailedMock(...args),
}));

describe('route failure alerts', () => {
  beforeEach(() => {
    explainSelectionMock.mockReset();
    reportProxyAllFailedMock.mockReset();
  });

  it('does not report proxy all failed while an untried failover channel remains', async () => {
    explainSelectionMock.mockResolvedValue({ selectedChannelId: 22 });

    const { reportProxyAllFailedIfRouteExhausted } = await import('./routeFailureAlerts.js');
    const reported = await reportProxyAllFailedIfRouteExhausted({
      requestedModel: 'gpt-5.2',
      reason: 'upstream returned HTTP 502',
      downstreamPolicy: EMPTY_DOWNSTREAM_ROUTING_POLICY,
      excludeChannelIds: [11],
    });

    expect(reported).toBe(false);
    expect(explainSelectionMock).toHaveBeenCalledWith(
      'gpt-5.2',
      [11],
      EMPTY_DOWNSTREAM_ROUTING_POLICY,
    );
    expect(reportProxyAllFailedMock).not.toHaveBeenCalled();
  });

  it('reports proxy all failed after route failover candidates are exhausted', async () => {
    explainSelectionMock.mockResolvedValue({ selectedChannelId: undefined });

    const { reportProxyAllFailedIfRouteExhausted } = await import('./routeFailureAlerts.js');
    const reported = await reportProxyAllFailedIfRouteExhausted({
      requestedModel: 'gpt-5.2',
      reason: 'network failure',
      downstreamPolicy: EMPTY_DOWNSTREAM_ROUTING_POLICY,
      excludeChannelIds: [11, 22],
    });

    expect(reported).toBe(true);
    expect(reportProxyAllFailedMock).toHaveBeenCalledWith({
      model: 'gpt-5.2',
      reason: 'network failure',
    });
  });

  it('does not report proxy all failed for fixed-channel tester requests', async () => {
    const { reportProxyAllFailedIfRouteExhausted } = await import('./routeFailureAlerts.js');
    const reported = await reportProxyAllFailedIfRouteExhausted({
      requestedModel: 'gpt-5.2',
      reason: '指定通道 #11 当前不可用',
      downstreamPolicy: EMPTY_DOWNSTREAM_ROUTING_POLICY,
      excludeChannelIds: [11],
      forcedChannelId: 11,
    });

    expect(reported).toBe(false);
    expect(explainSelectionMock).not.toHaveBeenCalled();
    expect(reportProxyAllFailedMock).not.toHaveBeenCalled();
  });
});
