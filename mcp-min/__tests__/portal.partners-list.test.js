import { vi, describe, test, expect } from 'vitest';

import partnersListTool from '../portal/partners-list.js';
import { runTool } from '../run-tool.js';
import { rejectionFor } from '../validate-params.js';

const mockConfig = {
  master_token: 'test-token-123',
  partner_portal_url: 'https://portal.example.com'
};

describe('partners-list', () => {
  test('handles response with partners wrapper object', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce({
      partners: [
        { id: 1, name: 'Wrapped Partner' }
      ]
    });

    const res = await runTool(partnersListTool, 
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.partners).toHaveLength(1);
    expect(res.data.partners[0].name).toBe('Wrapped Partner');
  });

  test('returns empty list when no partners', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce([]);

    const res = await runTool(partnersListTool, 
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(true);
    expect(res.data.partners).toHaveLength(0);
    expect(res.data.count).toBe(0);
  });

  // The overlap with partner-get is gone, and a call that still sends partner_id must be rejected
  // rather than quietly listing every partner — the caller meant to fetch one.
  test('partner_id is no longer accepted; partner-get owns that lookup', () => {
    expect(rejectionFor('partners-list', partnersListTool, { partner_id: 42 })).not.toBeNull();
  });

  test('handles network errors', async () => {
    const portalRequest = vi.fn().mockRejectedValueOnce(
      new Error('Connection refused')
    );

    const res = await runTool(partnersListTool, 
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('INTERNAL_ERROR');
    expect(res.error.message).toContain('Connection refused');
  });

  test('includes meta timestamps', async () => {
    const portalRequest = vi.fn().mockResolvedValueOnce([]);

    const res = await runTool(partnersListTool, 
      {},
      { portalRequest, portalConfig: mockConfig }
    );

    expect(res.meta.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.meta.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('has correct schema', () => {
    expect(partnersListTool.inputSchema.required).toEqual([]);
    expect(partnersListTool.inputSchema.properties).toEqual({});
  });
});
