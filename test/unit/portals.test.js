import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Warn: vi.fn(), Error: vi.fn(), Info: vi.fn(), Success: vi.fn() }
}));

vi.mock('open', () => ({ default: vi.fn() }));

vi.mock('#lib/portal.js', () => ({
  default: {
    url: () => 'https://partners.platformos.com',
    tokenInfo: vi.fn(),
    requestGlobalTokenDevice: vi.fn(),
    fetchGlobalToken: vi.fn(),
    revokeGlobalToken: vi.fn()
  }
}));

import Portal from '#lib/portal.js';
import logger from '#lib/logger.js';
import { getPortal, portalsPath, readPortals, storePortal } from '#lib/portals.js';
import { addPortal, describeRules, removePortalCommand, waitForGlobalToken } from '#lib/portals/commands.js';
import { settingsFromDotPos } from '#lib/settings.js';
import addEnv from '#lib/envs/add.js';
import { readSession, persistSession } from '#lib/twoFactorSession.js';

const GLOBAL_TOKEN = 'global-token-value';

const pending = () => Object.assign(new Error('400'), { statusCode: 400, response: { body: { error: 'authorization_pending' } } });

describe('portals', () => {
  let dir;
  const saved = {};

  beforeEach(() => {
    vi.clearAllMocks();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-portals-'));
    for (const key of ['POS_PORTALS_FILE', 'XDG_CONFIG_HOME', 'CONFIG_FILE_PATH', 'CI', 'POS_PORTAL_SESSION_TOKEN']) saved[key] = process.env[key];
    delete process.env.POS_PORTALS_FILE;
    delete process.env.POS_PORTAL_SESSION_TOKEN;
    process.env.XDG_CONFIG_HOME = path.join(dir, 'config');
    process.env.CONFIG_FILE_PATH = path.join(dir, '.pos');
    process.env.CI = 'true';
    // Created up front: with CONFIG_FILE_PATH naming a file that does not exist, pos-cli
    // falls back to ./.pos in the working directory (files.js).
    fs.writeFileSync(process.env.CONFIG_FILE_PATH, '{}');
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const writeDotPos = (config) => fs.writeFileSync(process.env.CONFIG_FILE_PATH, JSON.stringify(config));
  const readDotPos = () => JSON.parse(fs.readFileSync(process.env.CONFIG_FILE_PATH, 'utf8'));

  describe('store', () => {
    // Not ~/.pos: .pos is looked up in the working directory.
    test('lives under the XDG config directory, or where POS_PORTALS_FILE says', () => {
      expect(portalsPath()).toBe(path.join(dir, 'config', 'pos-cli', 'portals.json'));

      process.env.POS_PORTALS_FILE = path.join(dir, 'elsewhere.json');
      expect(portalsPath()).toBe(path.join(dir, 'elsewhere.json'));
    });

    test.skipIf(process.platform === 'win32')('is written for its owner only', () => {
      storePortal('shared', { url: 'https://partners.platformos.com', token: GLOBAL_TOKEN });

      expect(fs.statSync(portalsPath()).mode & 0o777).toBe(0o600);
      expect(getPortal('shared').token).toBe(GLOBAL_TOKEN);
    });

    test('never resolves a name from Object.prototype', () => {
      storePortal('shared', { url: 'https://partners.platformos.com' });

      expect(getPortal('constructor')).toBeUndefined();
    });

    test('names the file when it is not JSON', () => {
      fs.mkdirSync(path.dirname(portalsPath()), { recursive: true });
      fs.writeFileSync(portalsPath(), '{ nope');

      expect(() => readPortals()).toThrow(portalsPath());
    });
  });

  describe('pos-cli portal add', () => {
    beforeEach(() => {
      Portal.requestGlobalTokenDevice.mockResolvedValue({
        device_code: 'device-code', user_code: 'ABCD-EFGH', interval: 0, expires_in: 5,
        verification_uri_complete: 'http://localhost:4000/global_token_device?user_code=ABCDEFGH'
      });
      Portal.fetchGlobalToken.mockRejectedValueOnce(pending()).mockResolvedValueOnce({
        access_token: GLOBAL_TOKEN, credential_id: 7, email: 'me@example.com', scopes: ['*'], all_instances: true,
        two_factor_mode: 'enforced', expires_in: 30 * 86400
      });
    });

    test('stores the approved token under the name, after waiting for the approval', async () => {
      await addPortal('shared', { url: 'http://localhost:4000/' });

      expect(Portal.requestGlobalTokenDevice).toHaveBeenCalledWith({ portalUrl: 'http://localhost:4000', clientName: `shared on ${os.hostname()}` });
      expect(Portal.fetchGlobalToken).toHaveBeenCalledTimes(2);
      expect(getPortal('shared')).toMatchObject({
        url: 'http://localhost:4000', token: GLOBAL_TOKEN, credential_id: 7, email: 'me@example.com', scopes: ['*'],
        two_factor_mode: 'enforced'
      });
    });

    test('never prints the token', async () => {
      await addPortal('shared', { url: 'http://localhost:4000' });

      const printed = [...logger.Info.mock.calls, ...logger.Success.mock.calls].flat().join('\n');
      expect(printed).toContain('ABCD-EFGH');
      expect(printed).not.toContain(GLOBAL_TOKEN);
    });

    test('says what each rule allows, without naming instances', () => {
      expect(describeRules({ rules: [
        { endpoint: 'production', all_instances: true, scopes: ['*:read'] },
        { endpoint: 'staging', all_instances: false, instance_count: 2, scopes: ['*'] },
        { endpoint: null, all_instances: true, scopes: ['logs:read'] }
      ] })).toEqual([
        'production, all instances: *:read',
        'staging, 2 chosen instances: *',
        'every endpoint, all instances: logs:read'
      ]);
    });

    // A Portal that sends no rules gives no count either.
    test('says "chosen instances" once when there is no count', () => {
      expect(describeRules({ all_instances: false, scopes: ['*'] })).toEqual(['every endpoint, chosen instances: *']);
    });

    test('does not replace an existing portal without --force', async () => {
      storePortal('shared', { url: 'https://partners.platformos.com', token: 'old' });

      await expect(addPortal('shared', {})).rejects.toThrow('already exists');
      expect(Portal.requestGlobalTokenDevice).not.toHaveBeenCalled();

      await addPortal('shared', { url: 'http://localhost:4000', force: true });
      expect(getPortal('shared').token).toBe(GLOBAL_TOKEN);
      // The replaced token is revoked, not left live and forgotten.
      expect(Portal.revokeGlobalToken).toHaveBeenCalledWith({ portalUrl: 'https://partners.platformos.com', token: 'old' });
    });

    // The new token is stored either way; the old one is still live, so the operator is told.
    test('says so when the token --force replaced could not be revoked', async () => {
      storePortal('shared', { url: 'https://partners.platformos.com', token: 'old' });
      Portal.revokeGlobalToken.mockRejectedValueOnce(new Error('fetch failed'));

      await addPortal('shared', { url: 'http://localhost:4000', force: true });

      expect(getPortal('shared').token).toBe(GLOBAL_TOKEN);
      expect(logger.Warn).toHaveBeenCalledWith(expect.stringContaining('Could not revoke the token this replaced on https://partners.platformos.com'));
    });

    test('says so when the request is denied on the Portal', async () => {
      Portal.fetchGlobalToken.mockReset().mockRejectedValue(
        Object.assign(new Error('400'), { statusCode: 400, response: { body: { error: 'access_denied' } } })
      );

      await expect(waitForGlobalToken({ portalUrl: 'x', deviceCode: 'd', interval: 0, expiresIn: 5 })).rejects.toThrow('denied');
    });
  });

  test('pos-cli portal remove revokes the token and forgets it', async () => {
    storePortal('shared', { url: 'http://localhost:4000', token: GLOBAL_TOKEN });

    await removePortalCommand('shared');

    expect(Portal.revokeGlobalToken).toHaveBeenCalledWith({ portalUrl: 'http://localhost:4000', token: GLOBAL_TOKEN });
    expect(getPortal('shared')).toBeUndefined();
    expect(logger.Success).toHaveBeenCalledWith('Portal shared removed and its token revoked.');
  });

  // The line the operator remembers must not claim a revocation that did not happen.
  test('pos-cli portal remove says the token is still live when it could not be revoked', async () => {
    storePortal('shared', { url: 'http://localhost:4000', token: GLOBAL_TOKEN });
    Portal.revokeGlobalToken.mockRejectedValueOnce(new Error('fetch failed'));

    await removePortalCommand('shared');

    expect(getPortal('shared')).toBeUndefined();
    const said = logger.Success.mock.calls.flat().join('\n');
    expect(said).toContain('still live on http://localhost:4000');
    expect(said).not.toContain('revoked.');
  });

  describe('pos-cli env add --portal', () => {
    beforeEach(() => storePortal('shared', { url: 'http://localhost:4000', token: GLOBAL_TOKEN, email: 'me@example.com' }));

    test('binds the environment to the instance the Portal names for its host, and stores no token', async () => {
      Portal.tokenInfo.mockResolvedValue({ global: true, resource_uuid: 'uuid-a', scopes_granted: ['*'] });

      await addEnv('staging', { url: 'https://a.example.com', portal: 'shared' });

      expect(Portal.tokenInfo).toHaveBeenCalledWith({ portalUrl: 'http://localhost:4000', token: GLOBAL_TOKEN, instanceHost: 'a.example.com' });
      expect(readDotPos()).toEqual({ staging: { url: 'https://a.example.com/', portal: 'shared' } });
    });

    // A global token reaches many instances: it is not sent to a URL the Portal does not
    // confirm is one of them.
    test('refuses a host the token does not reach, and writes nothing', async () => {
      Portal.tokenInfo.mockResolvedValue({ global: true, resource_uuid: null, scopes_granted: [] });

      await expect(addEnv('staging', { url: 'https://evil.example.net', portal: 'shared' })).rejects.toThrow('not an instance');
      expect(readDotPos()).toEqual({});
    });

    test('refuses a portal that is not on this machine', async () => {
      await expect(addEnv('staging', { url: 'https://a.example.com', portal: 'nope' })).rejects.toThrow('portal add nope');
      expect(Portal.tokenInfo).not.toHaveBeenCalled();
    });

    test('cannot be combined with --token or --email', async () => {
      await expect(addEnv('staging', { url: 'https://a.example.com', portal: 'shared', token: 't' })).rejects.toThrow('--portal');
    });
  });

  describe('an environment that names a portal', () => {
    beforeEach(() => {
      storePortal('shared', { url: 'http://localhost:4000', token: GLOBAL_TOKEN, email: 'me@example.com' });
      writeDotPos({
        a: { url: 'https://a.example.com/', portal: 'shared' },
        b: { url: 'https://b.example.com/', portal: 'shared' },
        own: { url: 'https://c.example.com/', token: 'own-token', partner_portal_url: 'https://partners.platformos.com' }
      });
    });

    test('takes its token, email and Partner Portal from the portal', () => {
      expect(settingsFromDotPos('a')).toEqual({
        url: 'https://a.example.com/', portal: 'shared',
        token: GLOBAL_TOKEN, email: 'me@example.com', partner_portal_url: 'http://localhost:4000'
      });
      expect(settingsFromDotPos('own').token).toBe('own-token');
    });

    // One instance in .pos twice, through two accounts' portals on the same Partner Portal:
    // a session is the token it was stepped up from, never the URL's.
    test('keeps a session with the portal whose token minted it, when an instance is in .pos twice', () => {
      storePortal('other', { url: 'http://localhost:4000', token: 'other-account-token' });
      writeDotPos({
        a: { url: 'https://a.example.com/', portal: 'shared' },
        x: { url: 'https://a.example.com/', portal: 'other' }
      });
      const session = { token: 'other-session', expires_at: new Date(Date.now() + 3600_000).toISOString() };

      persistSession('https://a.example.com/', 'http://localhost:4000', session, 'other-account-token');

      expect(getPortal('other').two_factor_session).toEqual(session);
      expect(getPortal('shared').two_factor_session).toBeUndefined();
      expect(readSession('https://a.example.com/', 'http://localhost:4000', GLOBAL_TOKEN)).toBeNull();
      expect(readSession('https://a.example.com/', 'http://localhost:4000', 'other-account-token')).toEqual(session);
    });

    test('names the missing portal when it is not on this machine', () => {
      writeDotPos({ a: { url: 'https://a.example.com/', portal: 'gone' } });

      expect(() => settingsFromDotPos('a')).toThrow('portal add gone');
    });

    // One code for every instance on the portal: the session is the global token stepped up.
    test('keeps its two-factor session on the portal, shared by every environment naming it', () => {
      const session = { token: 'session-token', expires_at: new Date(Date.now() + 3600_000).toISOString() };

      persistSession('https://a.example.com/', 'http://localhost:4000', session);

      expect(getPortal('shared').two_factor_session).toEqual(session);
      expect(readDotPos().a.two_factor_session).toBeUndefined();
      expect(readSession('https://b.example.com/', 'http://localhost:4000')).toEqual(session);
      expect(readSession('https://c.example.com/', 'https://partners.platformos.com')).toBeNull();
    });
  });
});
