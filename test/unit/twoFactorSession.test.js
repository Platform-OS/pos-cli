import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const answers = [];
vi.mock('readline', () => ({
  default: {
    createInterface: () => {
      const handlers = {};
      return {
        on: (event, handler) => { handlers[event] = handler; },
        close: () => {},
        question: (_prompt, callback) => {
          if (answers.length) return callback(answers.shift());
          return handlers.close?.();
        }
      };
    }
  }
}));

vi.mock('#lib/logger.js', () => ({
  default: { Log: vi.fn(), Debug: vi.fn(), Info: vi.fn(), Warn: vi.fn(), Success: vi.fn(), Error: vi.fn() }
}));

vi.mock('#lib/portal.js', () => ({
  default: {
    url: () => 'https://partners.platformos.com',
    tokenInfo: vi.fn(),
    twoFactorSession: vi.fn()
  }
}));

const Portal = (await import('#lib/portal.js')).default;
const { ensureSession, needsTwoFactorSession, readSession, startSession } =
  await import('#lib/twoFactorSession.js');

const PORTAL = 'http://portal.test';
const INSTANCE = 'http://shop.example.com';

// What the Instance answers a write with when it wants a session (its
// Api::AppBuilder::BaseController#require_two_factor_session).
const sessionRequired = () => Object.assign(new Error('Request failed with status 401'), {
  name: 'StatusCodeError',
  statusCode: 401,
  response: { statusCode: 401, body: { error: 'two_factor_required', errors: ['...'] } }
});

const inOneHour = () => new Date(Date.now() + 3600_000).toISOString();

let home;
let originalHome;
let originalIsTTY;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-home-'));
  originalHome = os.homedir;
  os.homedir = () => home;
  originalIsTTY = process.stdin.isTTY;
  process.stdin.isTTY = true;
  answers.length = 0;
  delete process.env.POS_PORTAL_OTP_CODE;
  vi.clearAllMocks();
});

afterEach(() => {
  os.homedir = originalHome;
  process.stdin.isTTY = originalIsTTY;
  fs.rmSync(home, { recursive: true, force: true });
});

describe('needsTwoFactorSession', () => {
  test('matches only the instance two_factor_required body on a 401', () => {
    expect(needsTwoFactorSession(sessionRequired())).toBe(true);
    expect(needsTwoFactorSession({ statusCode: 401, response: { body: '' } })).toBe(false);
    expect(needsTwoFactorSession({ statusCode: 403, response: { body: { error: 'two_factor_required' } } })).toBe(false);
    expect(needsTwoFactorSession(null)).toBe(false);
  });
});

describe('the session store', () => {
  test('round-trips a session and keeps it to the owner', async () => {
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token', expires_at: inOneHour() });

    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    expect(readSession(PORTAL, INSTANCE).token).toBe('session-token');
    const file = path.join(home, '.pos-cli', 'sessions.json');
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(fs.statSync(path.dirname(file)).mode & 0o777).toBe(0o700);
  });

  test('never writes a session into .pos, which is shared', async () => {
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token', expires_at: inOneHour() });

    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    expect(fs.existsSync('.pos')).toBe(false);
  });

  test('treats an expired session as no session', async () => {
    Portal.twoFactorSession.mockResolvedValue({
      token: 'session-token',
      expires_at: new Date(Date.now() - 1000).toISOString()
    });

    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    expect(readSession(PORTAL, INSTANCE)).toBeNull();
  });

  // The same instance URL served by a different portal is a different credential.
  test('scopes a session to one portal and one instance', async () => {
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token', expires_at: inOneHour() });

    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    expect(readSession('http://other-portal.test', INSTANCE)).toBeNull();
    expect(readSession(PORTAL, 'http://other.example.com')).toBeNull();
    // Trailing slashes are a formatting difference, not a different instance.
    expect(readSession(`${PORTAL}/`, `${INSTANCE}/`).token).toBe('session-token');
  });
});

describe('ensureSession', () => {
  test('does nothing when the portal does not require a second factor', async () => {
    Portal.tokenInfo.mockResolvedValue({ two_factor_required: false, two_factor_session: false });

    await expect(ensureSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived' })).resolves.toBeNull();

    expect(Portal.twoFactorSession).not.toHaveBeenCalled();
  });

  test('prompts and starts a session when one is required', async () => {
    Portal.tokenInfo.mockResolvedValue({ two_factor_required: true, two_factor_session: false });
    Portal.twoFactorSession.mockImplementation(({ otpCode }) => {
      if (!otpCode) return Promise.reject(sessionRequired());
      return Promise.resolve({ token: 'session-token', expires_at: inOneHour() });
    });
    answers.push('123456');

    const session = await ensureSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived' });

    expect(session.token).toBe('session-token');
    expect(readSession(PORTAL, INSTANCE).token).toBe('session-token');
  });

  test('reuses a stored session without asking the portal anything', async () => {
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token', expires_at: inOneHour() });
    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });
    vi.clearAllMocks();

    const session = await ensureSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived' });

    expect(session.token).toBe('session-token');
    expect(Portal.tokenInfo).not.toHaveBeenCalled();
    expect(Portal.twoFactorSession).not.toHaveBeenCalled();
  });

  // The Instance is what actually enforces this; a Portal that cannot answer must not be
  // able to block a deploy that would otherwise have been allowed.
  test('proceeds when the portal cannot be reached', async () => {
    Portal.tokenInfo.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(ensureSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived' })).resolves.toBeNull();
  });

  test('refuses with guidance rather than prompting when there is no terminal', async () => {
    process.stdin.isTTY = false;
    Portal.tokenInfo.mockResolvedValue({ two_factor_required: true, two_factor_session: false });
    Portal.twoFactorSession.mockRejectedValue(sessionRequired());

    await expect(ensureSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived' }))
      .rejects.toMatchObject({ name: 'TwoFactorError' });
  });

  // A long-lived token is exactly what the instance just refused, so telling the operator
  // to go and get one would send them in a circle.
  test('does not advise a long-lived token when one is what was refused', async () => {
    process.stdin.isTTY = false;
    Portal.tokenInfo.mockResolvedValue({ two_factor_required: true, two_factor_session: false });
    Portal.twoFactorSession.mockRejectedValue(sessionRequired());

    await expect(ensureSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived' }))
      .rejects.toMatchObject({ message: expect.not.stringContaining('--token') });
  });
});
