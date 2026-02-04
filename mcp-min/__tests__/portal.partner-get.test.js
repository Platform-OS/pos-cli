import { vi, describe, test, expect } from 'vitest';

import partnerGetTool from '../portal/partner-get.js';

const mockConfig = {
  master_token: 'test-token-123',
  partner_portal_url: 'https://portal.example.com'
};

describe('partner-get', () => {
  test('fetches partner with billing plans', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce({
      id: 42,
      name: 'Acme Corp',
      email: 'admin@acme.com',
      created_at: '2024-01-15T10:00:00Z',
      instance_billing_plan_types: [
        { id: 101, name: 'Free Tier', code: 'free', description: 'For development', price: 0, currency: 'USD' },
        { id: 102, name: 'Production', code: 'prod', description: 'For live apps', price: 99, currency: 'USD' },
        { id: 103, name: 'Enterprise', code: 'ent', description: 'Custom solutions', price: 499, currency: 'USD' }
      ]
    });

    const res = await partnerGetTool.handler(
      { partner_id: 42 },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.partner.id).toBe(42);
    expect(res.data.partner.name).toBe('Acme Corp');
    expect(res.data.partner.email).toBe('admin@acme.com');
    expect(res.data.billing_plans).toHaveLength(3);
    expect(res.data.billing_plans_count).toBe(3);

    expect(res.data.billing_plans[0]).toEqual({
      id: 101,
      name: 'Free Tier',
      code: 'free',
      description: 'For development',
      price: 0,
      currency: 'USD'
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
      name: 'New Partner',
      email: 'new@partner.com'
    });

    const res = await partnerGetTool.handler(
      { partner_id: 1 },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.partner.name).toBe('New Partner');
    expect(res.data.billing_plans).toEqual([]);
    expect(res.data.billing_plans_count).toBe(0);
  });

  test('handles billing plans with missing optional fields', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce({
      id: 1,
      name: 'Partner',
      instance_billing_plan_types: [
        { id: 101, name: 'Basic', code: 'basic' }
      ]
    });

    const res = await partnerGetTool.handler(
      { partner_id: 1 },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.billing_plans[0]).toEqual({
      id: 101,
      name: 'Basic',
      code: 'basic',
      description: undefined,
      price: undefined,
      currency: undefined
    });
  });

  test('returns error when partner not found', async () => {
    const portalRequest = vi.fn().mockRejectedValueOnce(
      Object.assign(new Error('Partner not found'), { status: 404 })
    );

    const res = await partnerGetTool.handler(
      { partner_id: 999 },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('PARTNER_NOT_FOUND');
    expect(res.error.message).toContain('not found');
  });

  test('handles authentication errors', async () => {
    const portalRequest = vi.fn().mockRejectedValueOnce(
      Object.assign(new Error('Invalid token'), { status: 401 })
    );

    const res = await partnerGetTool.handler(
      { partner_id: 1 },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('PARTNER_GET_ERROR');
    expect(res.error.message).toContain('Invalid token');
  });

  test('handles network errors', async () => {
    const portalRequest = vi.fn().mockRejectedValueOnce(
      new Error('Connection refused')
    );

    const res = await partnerGetTool.handler(
      { partner_id: 1 },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('PARTNER_GET_ERROR');
    expect(res.error.message).toContain('Connection refused');
  });

  test('includes meta timestamps', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce({
      id: 1,
      name: 'Test'
    });

    const res = await partnerGetTool.handler(
      { partner_id: 1 },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.meta.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.meta.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('has correct schema with required partner_id', () => {
    expect(partnerGetTool.inputSchema.required).toContain('partner_id');
    expect(partnerGetTool.inputSchema.properties.partner_id.type).toBe('number');
  });
});
