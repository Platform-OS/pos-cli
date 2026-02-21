import { vi, describe, test, expect, beforeEach } from 'vitest';

import instanceCreateTool from '../portal/instance-create.js';

const mockConfig = {
  master_token: 'test-token-123',
  partner_portal_url: 'https://portal.example.com'
};

describe('instance-create', () => {
  test('creates instance successfully when name is available', async () => {
    const portalRequest = vi.fn()
      .mockResolvedValueOnce({ available: true }) // name check
      .mockResolvedValueOnce({ acknowledged: true }); // create

    const res = await instanceCreateTool.handler(
      {
        name: 'my-new-instance',
        partner_id: 123,
        endpoint_id: 456,
        billing_plan_id: 789
      },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.acknowledged).toBe(true);
    expect(res.data.name).toBe('my-new-instance');
    expect(res.data.message).toContain('Instance creation started');

    // Verify name check call
    expect(portalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/instance_name_checks/my-new-instance'
      })
    );

    // Verify create call
    expect(portalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/api/tasks/instance/create',
        body: {
          instance_billing_plan_type_id: 789,
          partner_id: 123,
          instance_params: {
            endpoint_id: 456,
            name: 'my-new-instance',
            tag_list: []
          }
        }
      })
    );
  });

  test('includes tags when provided', async () => {
    const portalRequest = vi.fn()
      .mockResolvedValueOnce({ available: true })
      .mockResolvedValueOnce({ acknowledged: true });

    await instanceCreateTool.handler(
      {
        name: 'tagged-instance',
        partner_id: 1,
        endpoint_id: 2,
        billing_plan_id: 3,
        tags: ['production', 'client-abc']
      },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(portalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          instance_params: expect.objectContaining({
            tag_list: ['production', 'client-abc']
          })
        })
      })
    );
  });

  test('returns error when name is unavailable', async () => {
    const portalRequest = vi.fn()
      .mockResolvedValueOnce({ available: false });

    const res = await instanceCreateTool.handler(
      {
        name: 'taken-name',
        partner_id: 1,
        endpoint_id: 2,
        billing_plan_id: 3
      },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('NAME_UNAVAILABLE');
    expect(res.error.message).toContain('taken-name');

    // Should not call create endpoint
    expect(portalRequest).toHaveBeenCalledTimes(1);
  });

  test('handles validation errors from API (422)', async () => {
    const portalRequest = vi.fn()
      .mockResolvedValueOnce({ available: true })
      .mockRejectedValueOnce(Object.assign(
        new Error('Invalid billing plan'),
        { status: 422, data: { errors: ['billing_plan_id is invalid'] } }
      ));

    const res = await instanceCreateTool.handler(
      {
        name: 'valid-name',
        partner_id: 1,
        endpoint_id: 2,
        billing_plan_id: 999
      },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('VALIDATION_ERROR');
    expect(res.error.message).toContain('Invalid billing plan');
  });

  test('handles network/server errors', async () => {
    const portalRequest = vi.fn()
      .mockRejectedValueOnce(new Error('Network timeout'));

    const res = await instanceCreateTool.handler(
      {
        name: 'test-instance',
        partner_id: 1,
        endpoint_id: 2,
        billing_plan_id: 3
      },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('INSTANCE_CREATE_ERROR');
    expect(res.error.message).toContain('Network timeout');
  });

  test('URL-encodes special characters in name', async () => {
    const portalRequest = vi.fn()
      .mockResolvedValueOnce({ available: true })
      .mockResolvedValueOnce({ acknowledged: true });

    await instanceCreateTool.handler(
      {
        name: 'test instance',
        partner_id: 1,
        endpoint_id: 2,
        billing_plan_id: 3
      },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(portalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/instance_name_checks/test%20instance'
      })
    );
  });

  test('includes meta timestamps in response', async () => {
    const portalRequest = vi.fn()
      .mockResolvedValueOnce({ available: true })
      .mockResolvedValueOnce({ acknowledged: true });

    const res = await instanceCreateTool.handler(
      {
        name: 'test',
        partner_id: 1,
        endpoint_id: 2,
        billing_plan_id: 3
      },
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.meta).toBeDefined();
    expect(res.meta.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.meta.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('has correct schema', () => {
    expect(instanceCreateTool.inputSchema.required).toContain('name');
    expect(instanceCreateTool.inputSchema.required).toContain('partner_id');
    expect(instanceCreateTool.inputSchema.required).toContain('endpoint_id');
    expect(instanceCreateTool.inputSchema.required).toContain('billing_plan_id');

    expect(instanceCreateTool.inputSchema.properties.tags.type).toBe('array');
    expect(instanceCreateTool.inputSchema.properties.tags.items.type).toBe('string');
  });
});

describe('portal-client', () => {
  // Basic integration test for the client module structure
  test('portal-client exports expected functions', async () => {
    const { getPortalConfig, portalRequest } = await import('../portal/portal-client.js');

    expect(typeof getPortalConfig).toBe('function');
    expect(typeof portalRequest).toBe('function');
  });
});
