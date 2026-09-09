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

const { permissionsOf, supportsPosixPermissions } = await import('#lib/filePermissions.js');
const Portal = (await import('#lib/portal.js')).default;
const logger = (await import('#lib/logger.js')).default;
const {
  SESSION_TOKEN_ENV_VAR,
  clearSession,
  describeLifetime,
  ensureSession,
  ensureSessionForCommand,
  portalUrlFor,
  readSession,
  sessionInterruptedMessage,
  sessionPrelude,
  startSession
} = await import('#lib/twoFactorSession.js');

const PORTAL = 'http://portal.test';
const INSTANCE = 'http://shop.example.com';

// What the instance answers a write with when it wants a session.
const sessionRequired = () => Object.assign(new Error('Request failed with status 401'), {
  name: 'StatusCodeError',
  statusCode: 401,
  response: { statusCode: 401, body: { error: 'two_factor_required', errors: ['...'] } }
});

const inOneHour = () => new Date(Date.now() + 3600_000).toISOString();

let workdir;
let configPath;
let originalIsTTY;

const writeConfig = (config) => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
const readConfig = () => JSON.parse(fs.readFileSync(configPath, 'utf8'));

beforeEach(() => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-pos-'));
  configPath = path.join(workdir, '.pos');
  process.env.CONFIG_FILE_PATH = configPath;
  writeConfig({
    staging: { url: INSTANCE, token: 'long-lived', email: 'a@b.c', partner_portal_url: PORTAL }
  });

  originalIsTTY = process.stdin.isTTY;
  process.stdin.isTTY = true;
  answers.length = 0;
  delete process.env.POS_PORTAL_OTP_CODE;
  delete process.env[SESSION_TOKEN_ENV_VAR];
  vi.clearAllMocks();
});

afterEach(() => {
  process.stdin.isTTY = originalIsTTY;
  delete process.env.CONFIG_FILE_PATH;
  delete process.env[SESSION_TOKEN_ENV_VAR];
  fs.rmSync(workdir, { recursive: true, force: true });
});

describe('the session store', () => {
  test('round-trips a session through the environment entry in .pos', async () => {
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token', expires_at: inOneHour() });

    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    expect(readSession(INSTANCE, PORTAL).token).toBe('session-token');
    expect(readConfig().staging.two_factor_session.token).toBe('session-token');
  });

  // .pos now holds something shorter-lived than the year-long token, and existing files
  // were written world-readable. Nothing to assert where the platform has no permission
  // bits — see lib/filePermissions.js.
  test.skipIf(!supportsPosixPermissions)('tightens .pos to owner-only when it stores a session', async () => {
    fs.chmodSync(configPath, 0o644);
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token', expires_at: inOneHour() });

    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    expect(permissionsOf(configPath)).toBe(0o600);
  });

  // storeEnvironment rebuilds an entry from four known keys; this writer must not, or a
  // hand-added field would disappear the first time a session was cached.
  test('preserves other environments and unknown fields', async () => {
    writeConfig({
      staging: { url: INSTANCE, token: 'long-lived', email: 'a@b.c', partner_portal_url: PORTAL, note: 'keep me' },
      production: { url: 'http://prod.example.com', token: 'other' }
    });
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token', expires_at: inOneHour() });

    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    const config = readConfig();
    expect(config.staging.note).toBe('keep me');
    expect(config.staging.token).toBe('long-lived');
    expect(config.production).toEqual({ url: 'http://prod.example.com', token: 'other' });
    expect(config.production.two_factor_session).toBeUndefined();
  });

  test('treats an expired session as no session', async () => {
    Portal.twoFactorSession.mockResolvedValue({
      token: 'session-token',
      expires_at: new Date(Date.now() - 1000).toISOString()
    });

    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    expect(readSession(INSTANCE, PORTAL)).toBeNull();
  });

  test('scopes a session to the environment whose URL matches', async () => {
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token', expires_at: inOneHour() });

    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    expect(readSession('http://other.example.com', PORTAL)).toBeNull();
    // Trailing slashes are a formatting difference, not a different instance.
    expect(readSession(`${INSTANCE}/`, `${PORTAL}/`).token).toBe('session-token');
  });

  // The same URL under two portals is what a domain migration looks like mid-flight, and a
  // session proved to one portal is not a credential for the other.
  test('keeps two portals serving one URL apart', async () => {
    writeConfig({
      old: { url: INSTANCE, token: 't1', partner_portal_url: PORTAL },
      new: { url: INSTANCE, token: 't2', partner_portal_url: 'http://other-portal.test' }
    });
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token', expires_at: inOneHour() });

    await startSession({ portalUrl: 'http://other-portal.test', instanceUrl: INSTANCE, token: 't2', otpCode: '123456' });

    expect(readConfig().new.two_factor_session.token).toBe('session-token');
    expect(readConfig().old.two_factor_session).toBeUndefined();
    expect(readSession(INSTANCE, PORTAL)).toBeNull();
  });

  test('clearSession removes only the session', async () => {
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token', expires_at: inOneHour() });
    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    clearSession(INSTANCE, PORTAL);

    expect(readSession(INSTANCE, PORTAL)).toBeNull();
    expect(readConfig().staging.token).toBe('long-lived');
  });

  // sync runs its queue at CONCURRENCY, so an instance that wants a session refuses that
  // many uploads at once. Without a shared step-up each one would open its own readline
  // over the same stdin and mint its own session.
  test('shares one step-up across callers that race for the same instance', async () => {
    let resolvePortal;
    Portal.twoFactorSession.mockImplementation(() => new Promise(resolve => { resolvePortal = resolve; }));

    const args = { portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' };
    const all = Promise.all([startSession(args), startSession(args), startSession(args)]);
    resolvePortal({ token: 'session-token', expires_at: inOneHour() });

    const sessions = await all;
    expect(Portal.twoFactorSession).toHaveBeenCalledTimes(1);
    expect(sessions.map(s => s.token)).toEqual(['session-token', 'session-token', 'session-token']);
  });

  // ...and the sharing must not outlive the request, or the next command would be handed
  // a stale promise instead of prompting.
  test('starts a fresh step-up once the previous one has settled', async () => {
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token', expires_at: inOneHour() });

    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });
    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    expect(Portal.twoFactorSession).toHaveBeenCalledTimes(2);
  });

  // MPKIT_* settings take precedence over .pos and often come with no file at all, so a
  // session started that way has to survive in the process or `sync` would re-prompt per
  // changed file.
  test('falls back to memory when no .pos entry matches', async () => {
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token', expires_at: inOneHour() });
    const unregistered = 'http://not-in-dot-pos.example.com';

    await startSession({ portalUrl: PORTAL, instanceUrl: unregistered, token: 'long-lived', otpCode: '123456' });

    expect(readSession(unregistered, PORTAL).token).toBe('session-token');
    expect(readConfig().staging.two_factor_session).toBeUndefined();
  });
});

describe(`${SESSION_TOKEN_ENV_VAR}`, () => {
  test('is used in preference to anything on disk, and is never written', async () => {
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token', expires_at: inOneHour() });
    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    process.env[SESSION_TOKEN_ENV_VAR] = 'injected-token';

    expect(readSession(INSTANCE, PORTAL).token).toBe('injected-token');
    expect(readConfig().staging.two_factor_session.token).toBe('session-token');
  });

  // Its lifetime is not knowable here — the instance is left to reject it if it is stale.
  test('short-circuits ensureSession without asking the portal anything', async () => {
    process.env[SESSION_TOKEN_ENV_VAR] = 'injected-token';

    const session = await ensureSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived' });

    expect(session.token).toBe('injected-token');
    expect(Portal.tokenInfo).not.toHaveBeenCalled();
    expect(Portal.twoFactorSession).not.toHaveBeenCalled();
  });
});

describe('portalUrlFor', () => {
  test('recovers the portal an instance was registered against', () => {
    expect(portalUrlFor(INSTANCE)).toBe(PORTAL);
    expect(portalUrlFor(`${INSTANCE}/`)).toBe(PORTAL);
    expect(portalUrlFor('http://unknown.example.com')).toBeUndefined();
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
    expect(readSession(INSTANCE, PORTAL).token).toBe('session-token');
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

  // The instance is what actually enforces this; a Portal that cannot answer must not be
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

describe('the lifetime pos-cli reports', () => {
  // The eight hours this used to hardcode is the Portal's to choose, and it is reported on
  // the wire as expires_at. Changing it there must not leave pos-cli quoting a number
  // nobody honours, so every duration it prints is read back off that field.
  test('is read off the expiry the portal returned, not a constant of our own', async () => {
    Portal.twoFactorSession.mockResolvedValue({
      token: 'session-token',
      expires_at: new Date(Date.now() + 59 * 60_000).toISOString()
    });

    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    expect(logger.Info).toHaveBeenCalledWith(expect.stringContaining('expires in 59 minutes'), expect.anything());
    expect(logger.Info).not.toHaveBeenCalledWith(expect.stringContaining('8 hours'), expect.anything());
  });

  test('follows the portal when it reports a different lifetime', async () => {
    Portal.twoFactorSession.mockResolvedValue({
      token: 'session-token',
      expires_at: new Date(Date.now() + 3 * 3600_000).toISOString()
    });

    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    expect(logger.Info).toHaveBeenCalledWith(expect.stringContaining('expires in 3 hours'), expect.anything());
  });

  // A portal too old to send expires_at, and an injected session, both leave it unset —
  // and inventing a duration for either is exactly the drift being removed here.
  test('is left unsaid when the portal did not report one', async () => {
    Portal.twoFactorSession.mockResolvedValue({ token: 'session-token' });

    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', otpCode: '123456' });

    expect(describeLifetime(undefined)).toBeNull();
    expect(describeLifetime('not a date')).toBeNull();
    expect(logger.Info).not.toHaveBeenCalledWith(expect.stringContaining('expires in'), expect.anything());
  });

  // The unattended advice is written before anything has been minted, so there is no
  // expiry for it to quote — it must not fall back to a guess.
  test('is absent from the advice printed when there is no terminal to prompt on', async () => {
    process.stdin.isTTY = false;
    Portal.twoFactorSession.mockRejectedValue(sessionRequired());

    const error = await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived' })
      .catch(e => e);

    expect(error.name).toBe('TwoFactorError');
    expect(error.message).toContain('A session is short-lived');
    expect(error.message).not.toMatch(/\d+\s*hours/);
  });
});

describe('sessionInterruptedMessage', () => {
  test('tells an operator whose session ran out to restart that exact command', () => {
    const message = sessionInterruptedMessage({ command: 'pos-cli sync staging' });

    expect(message).toContain('has expired');
    expect(message).toContain('`pos-cli sync staging` again');
    expect(message).toContain('re-save the files you changed');
  });

  // Reached when the up-front step-up was skipped because the Portal could not be asked.
  // Calling that "expired" would describe a session that never existed.
  test('says a session is required when the run never held one', () => {
    const message = sessionInterruptedMessage({ command: 'pos-cli sync', expired: false });

    expect(message).toContain('requires a two-factor session');
    expect(message).not.toContain('has expired');
  });
});

describe('the prompt that asks for a code', () => {
  // The instance has no two-factor setting of its own — the account whose token is being
  // presented does. Blaming the instance sent operators looking for a switch that is not
  // there, and made a shared instance look like the thing that had changed.
  test('blames the Partner Portal account rather than the instance', () => {
    const prelude = sessionPrelude({ instanceUrl: INSTANCE, portalUrl: PORTAL });

    expect(prelude).toContain('Your Partner Portal account has 2FA enabled');
    expect(prelude).not.toContain('This instance requires a two-factor code');
  });

  // Which account is half the question when the operator holds one on a private stack and
  // another on partners.platformos.com, each with its own authenticator entry.
  test('names the account when the environment stores an email', () => {
    const prelude = sessionPrelude({ instanceUrl: INSTANCE, portalUrl: PORTAL, email: 'you@example.com' });

    expect(prelude).toContain('Your Partner Portal account (you@example.com) has 2FA enabled');
  });

  // The browser device flow stores no email, and the Portal is not worth a round trip just
  // to label a prompt — so the parenthetical goes away rather than reading "(undefined)".
  test('leaves the account out when the environment stores no email', () => {
    const prelude = sessionPrelude({ instanceUrl: INSTANCE, portalUrl: PORTAL });

    expect(prelude).toContain('Your Partner Portal account has 2FA enabled');
    expect(prelude).not.toContain('(');
  });

  // `pos-cli deploy staging` names neither host, and a code is worth confirming the target
  // of before it is typed — especially with a production environment one line away.
  test('names the instance and the portal the code will be spent on', () => {
    const prelude = sessionPrelude({ instanceUrl: `${INSTANCE}/`, portalUrl: `${PORTAL}/` });

    expect(prelude).toContain(INSTANCE);
    expect(prelude).toContain(PORTAL);
    // Normalized, so the trailing slash does not reach the operator.
    expect(prelude).not.toContain(`${INSTANCE}/`);
  });

  // Settings rebuilt from MARKETPLACE_* carry no portal URL; the request itself falls back
  // to Portal.url() there, so the line printed has to fall back the same way rather than
  // reading "Partner Portal: undefined".
  test('falls back to the default portal when the environment names none', () => {
    const prelude = sessionPrelude({ instanceUrl: INSTANCE, portalUrl: undefined, email: undefined });

    expect(prelude).toContain('https://partners.platformos.com');
    expect(prelude).not.toContain('undefined');
  });

  test('is what the operator is shown before the code prompt', async () => {
    answers.push('123456');
    Portal.twoFactorSession
      .mockRejectedValueOnce(sessionRequired())
      .mockResolvedValueOnce({ token: 'session-token', expires_at: inOneHour() });

    await startSession({ portalUrl: PORTAL, instanceUrl: INSTANCE, token: 'long-lived', email: 'you@example.com' });

    expect(logger.Info).toHaveBeenCalledWith(
      expect.stringContaining(sessionPrelude({ instanceUrl: INSTANCE, portalUrl: PORTAL, email: 'you@example.com' })),
      expect.anything()
    );
  });
});


// `deploy`, `sync` and `gui serve` all await this at the top of a commander action, and
// all three bins end in `program.parse` rather than `parseAsync` — so anything thrown here
// is a Node unhandled rejection and a stack trace instead of a message. Every one of these
// asserts the call resolves: that is the property, and reportCommandError picking the
// right wording is the second half of it.
describe('ensureSessionForCommand', () => {
  const authData = { url: INSTANCE, token: 'long-lived', email: 'a@b.c', partner_portal_url: PORTAL };

  // The shape apiRequest throws, which is what ServerError reads.
  const portalRefused = (statusCode, body) => Object.assign(new Error(`Request failed with status ${statusCode}`), {
    name: 'StatusCodeError',
    statusCode,
    options: { uri: `${PORTAL}/api/two_factor_session` },
    response: { statusCode, body }
  });

  const portalUnreachable = () => Object.assign(new Error('fetch failed'), {
    name: 'RequestError',
    options: { uri: `${PORTAL}/api/two_factor_session` },
    cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
  });

  beforeEach(() => {
    Portal.tokenInfo.mockResolvedValue({ two_factor_required: true });
  });

  test('reports a portal that refuses the step-up instead of throwing out of the action', async () => {
    Portal.twoFactorSession.mockRejectedValue(portalRefused(503, { error: 'service unavailable' }));

    await expect(ensureSessionForCommand(authData, { otpCode: '123456' })).resolves.toBeUndefined();

    expect(logger.Error).toHaveBeenCalledWith(expect.stringContaining('service unavailable'), expect.anything());
  });

  // The portal is a second host the command depends on, and an unreachable one is worth
  // naming as such rather than as a bare 'fetch failed' — ServerError already knows how.
  test('reports an unreachable portal through ServerError', async () => {
    Portal.twoFactorSession.mockRejectedValue(portalUnreachable());

    await expect(ensureSessionForCommand(authData, { otpCode: '123456' })).resolves.toBeUndefined();

    expect(logger.Error).toHaveBeenCalledWith(expect.stringContaining('Could not connect'), expect.anything());
  });

  // Not a StatusCodeError and not a TwoFactorError: the branch that used to escape as a
  // raw Error object, which the log formatter JSON-encodes. The prefix is what names the
  // operation that failed.
  test('names the operation when the failure is neither a portal response nor a two-factor error', async () => {
    Portal.twoFactorSession.mockResolvedValue({});

    await expect(ensureSessionForCommand(authData, { otpCode: '123456' })).resolves.toBeUndefined();

    expect(logger.Error).toHaveBeenCalledWith(
      expect.stringContaining('Could not start a two-factor session'),
      expect.anything()
    );
    expect(logger.Error).toHaveBeenCalledWith(
      expect.stringContaining('did not return a two-factor session token'),
      expect.anything()
    );
  });

  // A TwoFactorError already carries multi-line, actionable text. Prefixing it would push
  // the first line out of alignment with the rest, so it keeps reporting itself.
  test('leaves a two-factor error to speak for itself, unprefixed', async () => {
    Portal.twoFactorSession.mockRejectedValue(portalRefused(401, { error: 'two_factor_locked' }));

    await expect(ensureSessionForCommand(authData, { otpCode: '123456' })).resolves.toBeUndefined();

    expect(logger.Error).toHaveBeenCalledWith(
      expect.stringContaining('locked this account for 15 minutes'),
      expect.objectContaining({ hideTimestamp: true })
    );
    expect(logger.Error).not.toHaveBeenCalledWith(
      expect.stringContaining('Could not start a two-factor session'),
      expect.anything()
    );
  });
});
