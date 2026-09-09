/**
 * Gateway's two-factor step-up policy.
 *
 * Every short command steps up where it stands and retries the request that was refused.
 * A long-running caller — watch mode, under `pos-cli sync` or `pos-cli gui serve --sync` —
 * cannot: its queue has CONCURRENCY uploads in flight, file events keep arriving behind
 * them, and nobody may be watching stdin. Those callers pass `restartCommand`, and the
 * Gateway then refuses rather than prompting from inside a running watcher or web server.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Info: vi.fn(), Warn: vi.fn(), Success: vi.fn(), Error: vi.fn() }
}));

vi.mock('#lib/apiRequest.js', () => ({ apiRequest: vi.fn() }));

// Left real apart from the one call a step-up would make, so "did it try to step up?" is
// answerable by asking whether the portal was contacted at all.
vi.mock('#lib/portal.js', () => ({
  default: {
    url: () => 'https://partners.platformos.com',
    tokenInfo: vi.fn(),
    twoFactorSession: vi.fn()
  }
}));

import { apiRequest } from '#lib/apiRequest.js';
import Portal from '#lib/portal.js';
import Gateway from '#lib/proxy.js';

const PORTAL = 'http://portal.test';
const INSTANCE = 'http://shop.example.com';

// What the instance answers with when it wants a session it has not been given.
const sessionRequired = () =>
  Object.assign(new Error('Request failed with status 401'), {
    name: 'StatusCodeError',
    statusCode: 401,
    response: { statusCode: 401, body: { error: 'two_factor_required', errors: ['...'] } }
  });

const inOneHour = () => new Date(Date.now() + 3600_000).toISOString();

let workdir;
let originalIsTTY;

const writeConfig = (entry) =>
  fs.writeFileSync(
    path.join(workdir, '.pos'),
    JSON.stringify({ staging: { url: INSTANCE, token: 'long-lived', email: 'a@b.c', partner_portal_url: PORTAL, ...entry } }, null, 2)
  );

const settings = (extra = {}) => ({ url: INSTANCE, token: 'long-lived', email: 'a@b.c', partner_portal_url: PORTAL, ...extra });

beforeEach(() => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-proxy-'));
  process.env.CONFIG_FILE_PATH = path.join(workdir, '.pos');
  writeConfig();

  // Off, so a step-up that does get attempted fails fast instead of blocking on a prompt.
  originalIsTTY = process.stdin.isTTY;
  process.stdin.isTTY = false;
  delete process.env.POS_PORTAL_OTP_CODE;
  delete process.env.POS_PORTAL_SESSION_TOKEN;
  vi.clearAllMocks();
});

afterEach(() => {
  process.stdin.isTTY = originalIsTTY;
  delete process.env.CONFIG_FILE_PATH;
  fs.rmSync(workdir, { recursive: true, force: true });
});

describe('a Gateway with no restartCommand', () => {
  test('steps up with the portal and retries the request that was refused', async () => {
    apiRequest.mockRejectedValueOnce(sessionRequired()).mockResolvedValueOnce('served');
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token', expires_at: inOneHour() });
    process.env.POS_PORTAL_OTP_CODE = '123456';

    await expect(new Gateway(settings()).ping()).resolves.toBe('served');

    expect(Portal.twoFactorSession).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });
});

describe('a Gateway given a restartCommand', () => {
  test('refuses instead of prompting, and never contacts the portal', async () => {
    apiRequest.mockRejectedValue(sessionRequired());

    const error = await new Gateway(settings({ restartCommand: 'pos-cli sync staging' }))
      .ping()
      .catch(e => e);

    expect(error.name).toBe('TwoFactorError');
    expect(error.message).toContain('`pos-cli sync staging` again');
    // The refused request is not retried either — there is no new credential to retry with.
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(Portal.twoFactorSession).not.toHaveBeenCalled();
  });

  // The message has to name the command that was actually started: restarting `pos-cli
  // sync` would not bring back a web server that came down with the watcher.
  test('names the caller that started the run', async () => {
    apiRequest.mockRejectedValue(sessionRequired());

    const error = await new Gateway(settings({ restartCommand: 'pos-cli gui serve staging --sync' }))
      .ping()
      .catch(e => e);

    expect(error.message).toContain('`pos-cli gui serve staging --sync` again');
  });

  test('says the session expired when the run was holding one', async () => {
    writeConfig({ two_factor_session: { token: 'session-token', expires_at: inOneHour() } });
    apiRequest.mockRejectedValue(sessionRequired());

    const error = await new Gateway(settings({ restartCommand: 'pos-cli sync staging' }))
      .ping()
      .catch(e => e);

    expect(error.message).toContain('has expired');
  });

  // Reached when the up-front step-up was skipped because the portal could not be asked.
  // Calling that "expired" would describe a session that never existed.
  test('says a session is required when the run never held one', async () => {
    apiRequest.mockRejectedValue(sessionRequired());

    const error = await new Gateway(settings({ restartCommand: 'pos-cli sync staging' }))
      .ping()
      .catch(e => e);

    expect(error.message).toContain('requires a two-factor session');
    expect(error.message).not.toContain('has expired');
  });

  // The policy is only about the two_factor_required body. An expired or revoked token is
  // a different problem with a different answer, and must keep failing as itself.
  test('leaves every other failure alone', async () => {
    const unauthorized = Object.assign(new Error('Unauthorized'), {
      name: 'StatusCodeError',
      statusCode: 401,
      response: { statusCode: 401, body: '' }
    });
    apiRequest.mockRejectedValue(unauthorized);

    await expect(new Gateway(settings({ restartCommand: 'pos-cli sync staging' })).ping())
      .rejects.toBe(unauthorized);
  });
});
