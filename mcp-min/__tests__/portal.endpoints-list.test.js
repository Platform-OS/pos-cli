import { vi, describe, test, expect } from 'vitest';

import endpointsListTool from '../portal/endpoints-list.js';

const mockConfig = {
  master_token: 'test-token-123',
  partner_portal_url: 'https://portal.example.com'
};

describe('endpoints-list', () => {
  test('lists all endpoints successfully', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce([
      { id: 1, name: 'US East', url: 'https://us-east.platformos.com', region: 'us-east-1' },
      { id: 2, name: 'EU West', url: 'https://eu-west.platformos.com', region: 'eu-west-1' },
      { id: 3, name: 'Asia Pacific', url: 'https://ap.platformos.com', region: 'ap-southeast-1' }
    ]);

    const res = await endpointsListTool.handler(
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.endpoints).toHaveLength(3);
    expect(res.data.endpoints[0]).toEqual({
      id: 1,
      name: 'US East',
      url: 'https://us-east.platformos.com',
      region: 'us-east-1'
    });
    expect(res.data.count).toBe(3);

    expect(portalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/endpoints'
      })
    );
  });

  test('handles response with endpoints wrapper object', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce({
      endpoints: [
        { id: 1, name: 'Wrapped Endpoint', url: 'https://example.com', region: 'test' }
      ]
    });

    const res = await endpointsListTool.handler(
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.endpoints).toHaveLength(1);
    expect(res.data.endpoints[0].name).toBe('Wrapped Endpoint');
  });

  test('returns empty list when no endpoints', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce([]);

    const res = await endpointsListTool.handler(
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.endpoints).toHaveLength(0);
    expect(res.data.count).toBe(0);
  });

  test('handles missing optional fields', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce([
      { id: 1, name: 'Minimal Endpoint' }
    ]);

    const res = await endpointsListTool.handler(
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.endpoints[0]).toEqual({
      id: 1,
      name: 'Minimal Endpoint',
      url: undefined,
      region: undefined
    });
  });

  test('handles network errors', async () => {
    const portalRequest = vi.fn().mockRejectedValueOnce(
      new Error('Connection timeout')
    );

    const res = await endpointsListTool.handler(
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('ENDPOINTS_LIST_ERROR');
    expect(res.error.message).toContain('Connection timeout');
  });

  test('handles authentication errors', async () => {
    const portalRequest = vi.fn().mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), { status: 401 })
    );

    const res = await endpointsListTool.handler(
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('ENDPOINTS_LIST_ERROR');
    expect(res.error.message).toContain('Unauthorized');
  });

  test('includes meta timestamps', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce([]);

    const res = await endpointsListTool.handler(
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.meta.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.meta.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('has correct schema with no required fields', () => {
    expect(endpointsListTool.inputSchema.required).toEqual([]);
    expect(endpointsListTool.inputSchema.properties).toEqual({});
  });
});
