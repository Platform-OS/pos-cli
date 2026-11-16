import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Warn: vi.fn(), Error: vi.fn(), Info: vi.fn(), Success: vi.fn() }
}));

vi.mock('#lib/portal.js', () => ({
  default: { url: () => 'https://partners.platformos.com', bindGlobalToken: vi.fn(), tokenInfo: vi.fn() }
}));

vi.mock('#lib/twoFactorSession.js', () => ({ ensureSession: vi.fn() }));

import Portal from '#lib/portal.js';
import { ensureSession } from '#lib/twoFactorSession.js';
import { bindToInstance } from '#lib/globalBinding.js';
import { getPortal, storePortal } from '#lib/portals.js';

const ROOT = 'posg_root-token';
const inAnHour = () => new Date(Date.now() + 3600_000).toISOString();

describe('bindToInstance', () => {
  let dir;
  const saved = {};

  beforeEach(() => {
    vi.clearAllMocks();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-binding-'));
    for (const key of ['XDG_CONFIG_HOME', 'CONFIG_FILE_PATH', 'POS_PORTALS_FILE']) saved[key] = process.env[key];
    delete process.env.POS_PORTALS_FILE;
    process.env.XDG_CONFIG_HOME = path.join(dir, 'config');
    process.env.CONFIG_FILE_PATH = path.join(dir, '.pos');
    fs.writeFileSync(process.env.CONFIG_FILE_PATH, '{}');
    ensureSession.mockResolvedValue(null);
    Portal.bindGlobalToken.mockResolvedValue({ access_token: 'posg_bound', expires_in: 43200, resource_uuid: 'uuid-a' });
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('leaves a token for one instance as it is, asking nobody', async () => {
    const settings = { url: 'https://a.example.com/', token: 'per-instance-token' };

    expect(await bindToInstance(settings, 'staging')).toBe(settings);
    expect(Portal.bindGlobalToken).not.toHaveBeenCalled();
  });

  // A global token is never sent to an instance: the command gets one bound to it.
  test('binds the token of a portal environment to its instance, and keeps it on the portal', async () => {
    storePortal('shared', { url: 'http://localhost:4000', token: ROOT, email: 'me@example.com' });
    const settings = { url: 'https://a.example.com/', portal: 'shared', token: ROOT, partner_portal_url: 'http://localhost:4000' };

    const bound = await bindToInstance(settings, 'staging');

    expect(Portal.bindGlobalToken).toHaveBeenCalledWith({ portalUrl: 'http://localhost:4000', token: ROOT, instanceHost: 'a.example.com' });
    expect(bound.token).toBe('posg_bound');
    expect(getPortal('shared').bound_tokens['a.example.com'].token).toBe('posg_bound');

    await bindToInstance(settings, 'staging');
    expect(Portal.bindGlobalToken).toHaveBeenCalledTimes(1);
  });

  test('binds from a two-factor session when the token needs one', async () => {
    storePortal('shared', { url: 'http://localhost:4000', token: ROOT });
    ensureSession.mockResolvedValue({ token: 'posg_session', expires_at: inAnHour() });

    await bindToInstance({ url: 'https://a.example.com/', portal: 'shared', token: ROOT }, 'staging');

    expect(Portal.bindGlobalToken).toHaveBeenCalledWith(expect.objectContaining({ token: 'posg_session' }));
  });

  test('binds a global MPKIT_TOKEN, recognised by its prefix, keeping it in memory', async () => {
    const bound = await bindToInstance({ url: 'https://b.example.com', token: ROOT, email: 'me@example.com' }, null);

    expect(bound.token).toBe('posg_bound');
    expect(JSON.parse(fs.readFileSync(process.env.CONFIG_FILE_PATH, 'utf8'))).toEqual({});
  });

  test('uses a token that is bound already as it is', async () => {
    Portal.bindGlobalToken.mockRejectedValue(Object.assign(new Error('422'), { statusCode: 422, response: { body: { error: 'not_bound' } } }));
    const settings = { url: 'https://c.example.com', token: 'posg_already-bound' };

    expect(await bindToInstance(settings, null)).toBe(settings);
  });

  test('says when the token does not reach the instance', async () => {
    Portal.bindGlobalToken.mockRejectedValue(
      Object.assign(new Error('403'), { statusCode: 403, response: { body: { error: 'instance_not_covered' } } })
    );

    await expect(bindToInstance({ url: 'https://d.example.com', token: ROOT }, null)).rejects.toThrow('system URL');
  });
});
