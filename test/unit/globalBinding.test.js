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
import { bindToInstance, dropBoundToken } from '#lib/globalBinding.js';
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

  // A token bound without a session cannot be stepped up, so once the account needs one -- or
  // the session it was bound from is renewed -- a new one is bound rather than the cached reused.
  test('binds anew when the session behind the token changes', async () => {
    storePortal('shared', { url: 'http://localhost:4000', token: ROOT });
    const settings = { url: 'https://a.example.com/', portal: 'shared', token: ROOT };

    await bindToInstance(settings, 'staging');
    ensureSession.mockResolvedValue({ token: 'posg_session', expires_at: inAnHour() });
    await bindToInstance(settings, 'staging');
    await bindToInstance(settings, 'staging');

    expect(Portal.bindGlobalToken).toHaveBeenCalledTimes(2);
    expect(Portal.bindGlobalToken).toHaveBeenLastCalledWith(expect.objectContaining({ token: 'posg_session' }));
  });

  test('forgets a bound token an instance refused, so the next command binds a new one', async () => {
    storePortal('shared', { url: 'http://localhost:4000', token: ROOT });
    await bindToInstance({ url: 'https://a.example.com/', portal: 'shared', token: ROOT }, 'staging');

    dropBoundToken('posg_bound');

    expect(getPortal('shared').bound_tokens).toEqual({});
  });

  test('passes the command\'s --otp-code on to the step-up', async () => {
    storePortal('shared', { url: 'http://localhost:4000', token: ROOT });

    await bindToInstance({ url: 'https://a.example.com/', portal: 'shared', token: ROOT }, 'staging', { otpCode: '123456' });

    expect(ensureSession).toHaveBeenCalledWith(expect.objectContaining({ otpCode: '123456' }));
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

  // A lifetime cannot be made up: the token serves this command and is not kept.
  test('uses a bound token the Portal gave no lifetime without keeping it', async () => {
    storePortal('shared', { url: 'http://localhost:4000', token: ROOT });
    Portal.bindGlobalToken.mockResolvedValue({ access_token: 'posg_forever' });
    const settings = { url: 'https://a.example.com/', portal: 'shared', token: ROOT };

    expect((await bindToInstance(settings, 'staging')).token).toBe('posg_forever');
    expect(getPortal('shared').bound_tokens).toBeUndefined();
  });

  // fetchSettings prints only the message, so the message names the Portal and the fix.
  test('says how to renew a refused portal token', async () => {
    storePortal('shared', { url: 'http://localhost:4000', token: ROOT });
    Portal.bindGlobalToken.mockRejectedValue(Object.assign(new Error('Request failed with status 401'), {
      statusCode: 401, response: { body: { error: 'invalid_token' } }
    }));

    const failure = bindToInstance({ url: 'https://a.example.com', portal: 'shared', token: ROOT }, 'staging');
    await expect(failure).rejects.toMatchObject({ name: 'GlobalBindingError', reason: 'refused', portal: 'shared' });
    await expect(failure).rejects.toThrow('pos-cli portal add shared --force');
  });

  // Each kept where it came from, so each is renewed there.
  test('says how to replace a refused token from .pos or MPKIT_TOKEN', async () => {
    const refused = Object.assign(new Error('Request failed with status 401'), { statusCode: 401, response: { body: {} } });
    Portal.bindGlobalToken.mockRejectedValue(refused);
    fs.writeFileSync(process.env.CONFIG_FILE_PATH, JSON.stringify({ staging: { url: 'https://a.example.com', token: ROOT } }));

    await expect(bindToInstance({ url: 'https://a.example.com', token: ROOT }, 'staging'))
      .rejects.toThrow('pos-cli env add staging --url https://a.example.com --token <token>');
    await expect(bindToInstance({ url: 'https://a.example.com', token: ROOT, fromEnv: true }, null))
      .rejects.toThrow('in MPKIT_TOKEN');
  });

  test('explains a refusal of the token\'s account as the CLI does elsewhere', async () => {
    Portal.bindGlobalToken.mockRejectedValue(Object.assign(new Error('Request failed with status 401'), {
      statusCode: 401, response: { body: { error: 'two_factor_not_enabled' } }
    }));

    await expect(bindToInstance({ url: 'https://a.example.com', token: ROOT }, null)).rejects.toThrow('two-factor authentication is not enabled');
  });

  test('names the Portal when it is down or unreachable, and does not blame the token', async () => {
    Portal.bindGlobalToken.mockRejectedValueOnce(Object.assign(new Error('Request failed with status 503'), { statusCode: 503, response: { body: '' } }));
    await expect(bindToInstance({ url: 'https://a.example.com', token: ROOT }, null))
      .rejects.toMatchObject({ reason: 'portal_error', message: expect.stringContaining('https://partners.platformos.com answered 503') });

    Portal.bindGlobalToken.mockRejectedValueOnce(Object.assign(new Error('fetch failed'), { name: 'RequestError', cause: { code: 'ECONNREFUSED' } }));
    await expect(bindToInstance({ url: 'https://a.example.com', token: ROOT }, null))
      .rejects.toMatchObject({ reason: 'unreachable', message: expect.stringContaining('Could not reach https://partners.platformos.com (ECONNREFUSED)') });
  });
});
