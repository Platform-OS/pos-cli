import { vi, describe, test, expect } from 'vitest';

import partnersListTool from '../portal/partners-list.js';

const mockConfig = {
  master_token: 'test-token-123',
  partner_portal_url: 'https://portal.example.com'
};

describe('partners-list', () => {
  test('lists all partners successfully', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce([
      { id: 1, name: 'Partner One' },
      { id: 2, name: 'Partner Two' },
      { id: 3, name: 'Partner Three' }
    ]);

    const res = await partnersListTool.handler(
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.partners).toHaveLength(3);
    expect(res.data.partners[0]).toEqual({ id: 1, name: 'Partner One' });
    expect(res.data.count).toBe(3);

    expect(portalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/partners'
      })
    );
  });

  test('handles response with partners wrapper object', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce({
      partners: [
        { id: 1, name: 'Wrapped Partner' }
      ]
    });

    const res = await partnersListTool.handler(
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.partners).toHaveLength(1);
    expect(res.data.partners[0].name).toBe('Wrapped Partner');
  });

  test('returns empty list when no partners', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce([]);

    const res = await partnersListTool.handler(
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.partners).toHaveLength(0);
    expect(res.data.count).toBe(0);
  });

  test('fetches specific partner with billing plans', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce({
      id: 42,
      name: 'Acme Corp',
      instance_billing_plan_types: [
        { id: 101, name: 'Free Tier', code: 'free' },
        { id: 102, name: 'Production', code: 'prod' }
      ]
    });

    const res = await partnersListTool.handler(
      { partner_id: 42 },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.partner.id).toBe(42);
    expect(res.data.partner.name).toBe('Acme Corp');
    expect(res.data.partner.billing_plans).toHaveLength(2);
    expect(res.data.partner.billing_plans[0]).toEqual({
      id: 101,
      name: 'Free Tier',
      code: 'free'
    });

    expect(portalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/partners/42'
      })
    );
  });

  test('handles partner with no billing plans', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce({
      id: 1,
      name: 'No Plans Partner'
    });

    const res = await partnersListTool.handler(
      { partner_id: 1 },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.partner.billing_plans).toEqual([]);
  });

  test('returns error when partner not found', async () => {
    const portalRequest = vi.fn().mockRejectedValueOnce(
      Object.assign(new Error('Partner not found'), { status: 404 })
    );

    const res = await partnersListTool.handler(
      { partner_id: 999 },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('PARTNER_NOT_FOUND');
  });

  test('handles network errors', async () => {
    const portalRequest = vi.fn().mockRejectedValueOnce(
      new Error('Connection refused')
    );

    const res = await partnersListTool.handler(
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('PARTNERS_LIST_ERROR');
    expect(res.error.message).toContain('Connection refused');
  });

  test('includes meta timestamps', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce([]);

    const res = await partnersListTool.handler(
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.meta.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.meta.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('has correct schema', () => {
    expect(partnersListTool.inputSchema.required).toEqual([]);
    expect(partnersListTool.inputSchema.properties.partner_id.type).toBe('number');
  });
});
