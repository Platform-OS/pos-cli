import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('#lib/logger.js', () => ({ default: { Debug: vi.fn() } }));
vi.mock('#lib/portal.js', () => ({ default: { tokenInfo: vi.fn() } }));

import Portal from '#lib/portal.js';
import { guiSyncRefusal, tokenAccess } from '#lib/tokenAccess.js';

describe('tokenAccess', () => {
  beforeEach(() => vi.clearAllMocks());

  test('reads the scopes a global token has on the instance it is asked about', async () => {
    Portal.tokenInfo.mockResolvedValue({ global: true, scopes_granted: ['*:read', 'code:write'] });

    await expect(tokenAccess({ portalUrl: 'https://p', token: 't', instanceUuid: 'uuid-1' }))
      .resolves.toEqual({ scopes: ['*:read', 'code:write'], global: true });
    expect(Portal.tokenInfo).toHaveBeenCalledWith({ portalUrl: 'https://p', token: 't', instanceUuid: 'uuid-1' });
  });

  test('asks without an instance when none is known', async () => {
    Portal.tokenInfo.mockResolvedValue({ global: true, scopes_granted: ['*'] });

    await expect(tokenAccess({ token: 't' })).resolves.toEqual({ scopes: ['*'], global: true });
    expect(Portal.tokenInfo).toHaveBeenCalledWith({ portalUrl: undefined, token: 't', instanceUuid: undefined });
  });

  // It only shapes what pos-cli offers; the Instance enforces. A per-instance token carries
  // no scopes, and a Portal too old to say or one that cannot be reached must not make the
  // GUI hide things the token can do.
  test.each([
    ['a per-instance token', () => Portal.tokenInfo.mockResolvedValue({ resource_uuid: 'x' })],
    ['a Portal that cannot be reached', () => Portal.tokenInfo.mockRejectedValue(new Error('ECONNREFUSED'))]
  ])('reads %s as full access', async (_name, arrange) => {
    arrange();

    await expect(tokenAccess({ token: 't' })).resolves.toEqual({ scopes: null, global: false });
  });
});

describe('guiSyncRefusal', () => {
  test('lets --sync start with code:write, a wildcard or full access', () => {
    expect(guiSyncRefusal(['code:write'])).toBeNull();
    expect(guiSyncRefusal(['*'])).toBeNull();
    expect(guiSyncRefusal(null)).toBeNull();
  });

  test('refuses --sync without code:write, naming the scope', () => {
    expect(guiSyncRefusal(['*:read'])).toContain('code:write');
    expect(guiSyncRefusal(['records:write'])).toContain('without --sync');
  });
});
