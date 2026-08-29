import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

// A controllable stand-in for the readline prompt. Answers are queued per test; an
// exhausted queue emits 'close' instead, which is what a drained or closed stdin does.
//
// It also reproduces the Node behaviour that makes reusing one interface necessary: an
// interface built over process.stdin *after* an earlier one was closed fires 'close'
// immediately instead of reading. Without that, a prompt-per-attempt implementation looks
// fine under test and then aborts on the first retry in a real terminal.
const answers = [];
const readlineState = { interfacesCreated: 0, anyClosed: false };
vi.mock('readline', () => ({
  default: {
    createInterface: () => {
      const handlers = {};
      const bornClosed = readlineState.anyClosed;
      readlineState.interfacesCreated += 1;
      return {
        on: (event, handler) => {
          handlers[event] = handler;
          if (event === 'close' && bornClosed) handler();
        },
        close: () => {
          readlineState.anyClosed = true;
          handlers.close?.();
        },
        question: (_prompt, callback) => {
          if (answers.length) return callback(answers.shift());
          return handlers.close?.();
        }
      };
    }
  }
}));

vi.mock('#lib/logger.js', () => ({
  default: {
    Log: vi.fn(),
    Debug: vi.fn(),
    Info: vi.fn(),
    Warn: vi.fn(),
    Success: vi.fn(),
    Error: vi.fn()
  }
}));

const {
  MAX_ATTEMPTS,
  OTP_CODE_ENV_VAR,
  isTwoFactorInvalid,
  isTwoFactorLocked,
  isTwoFactorRequired,
  normalizeCode,
  withTwoFactor
} = await import('#lib/utils/twoFactor.js');

// Shape of what apiRequest throws for the portal's "send me a code" answer.
const twoFactorRequired = () => Object.assign(new Error('Request failed with status 401'), {
  name: 'StatusCodeError',
  statusCode: 401,
  response: { statusCode: 401, body: { error: 'two_factor_required', errors: ['Two-factor code required'] } }
});

const twoFactorBody = (code, message) => Object.assign(new Error('Request failed with status 401'), {
  name: 'StatusCodeError',
  statusCode: 401,
  response: { statusCode: 401, body: { error: code, errors: [message] } }
});

const twoFactorInvalid = () => twoFactorBody('two_factor_invalid', 'Invalid two-factor code');
const twoFactorLocked = () => twoFactorBody('two_factor_locked', 'Too many two-factor attempts');

// A bodiless 401 — what a wrong password gets, and what a portal too old to send
// two_factor_invalid/two_factor_locked answers a wrong code with.
const unauthorized = () => Object.assign(new Error('Request failed with status 401'), {
  name: 'StatusCodeError',
  statusCode: 401,
  response: { statusCode: 401, body: '' }
});

let originalIsTTY;

beforeEach(() => {
  answers.length = 0;
  readlineState.interfacesCreated = 0;
  readlineState.anyClosed = false;
  originalIsTTY = process.stdin.isTTY;
  process.stdin.isTTY = true;
  delete process.env[OTP_CODE_ENV_VAR];
  vi.clearAllMocks();
});

afterEach(() => {
  process.stdin.isTTY = originalIsTTY;
  delete process.env[OTP_CODE_ENV_VAR];
});

describe('portal error codes', () => {
  test('each matcher recognises only its own code on a 401', () => {
    expect(isTwoFactorRequired(twoFactorRequired())).toBe(true);
    expect(isTwoFactorInvalid(twoFactorInvalid())).toBe(true);
    expect(isTwoFactorLocked(twoFactorLocked())).toBe(true);

    expect(isTwoFactorRequired(twoFactorInvalid())).toBe(false);
    expect(isTwoFactorInvalid(twoFactorLocked())).toBe(false);
    expect(isTwoFactorLocked(twoFactorRequired())).toBe(false);
  });

  test('none of them match a bodiless 401, a non-401, or a 401 HTML page', () => {
    for (const matcher of [isTwoFactorRequired, isTwoFactorInvalid, isTwoFactorLocked]) {
      expect(matcher(unauthorized())).toBe(false);
      expect(matcher(null)).toBe(false);
      expect(matcher({ statusCode: 403, response: { body: { error: 'two_factor_required' } } })).toBe(false);
      expect(matcher({ statusCode: 401, response: { body: '<html>two_factor_locked</html>' } })).toBe(false);
    }
  });
});

describe('normalizeCode', () => {
  test('strips the whitespace authenticator apps and copy-paste introduce', () => {
    expect(normalizeCode(' 123 456 ')).toBe('123456');
    expect(normalizeCode('abcd-efgh\n')).toBe('abcd-efgh');
    expect(normalizeCode(undefined)).toBe('');
  });
});

describe('withTwoFactor', () => {
  test('passes no code and never prompts for an account without 2FA', async () => {
    const run = vi.fn(async () => 'token');

    await expect(withTwoFactor(run)).resolves.toBe('token');

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(null);
  });

  test('sends a code given as an option without prompting', async () => {
    const run = vi.fn(async () => 'token');

    await expect(withTwoFactor(run, { otpCode: '123 456' })).resolves.toBe('token');

    expect(run).toHaveBeenCalledWith('123456');
    expect(answers.length).toBe(0);
  });

  test(`sends a code from ${OTP_CODE_ENV_VAR} when no option is given`, async () => {
    process.env[OTP_CODE_ENV_VAR] = '654321';
    const run = vi.fn(async () => 'token');

    await expect(withTwoFactor(run)).resolves.toBe('token');

    expect(run).toHaveBeenCalledWith('654321');
  });

  test('prompts for a code when the portal asks for one, then retries', async () => {
    answers.push('123 456');
    const run = vi.fn(async code => {
      if (!code) throw twoFactorRequired();
      return `token-for-${code}`;
    });

    await expect(withTwoFactor(run)).resolves.toBe('token-for-123456');

    expect(run).toHaveBeenNthCalledWith(1, null);
    expect(run).toHaveBeenNthCalledWith(2, '123456');
  });

  test('re-prompts after a wrong code and succeeds on a later attempt', async () => {
    answers.push('000000', '123456');
    const run = vi.fn(async code => {
      if (!code) throw twoFactorRequired();
      if (code !== '123456') throw twoFactorInvalid();
      return 'token';
    });

    await expect(withTwoFactor(run)).resolves.toBe('token');

    expect(run).toHaveBeenCalledTimes(3);
    // Every attempt must share one readline interface — a second one built over an
    // already-closed process.stdin would abort instead of asking again.
    expect(readlineState.interfacesCreated).toBe(1);
  });

  test(`gives up after ${MAX_ATTEMPTS} wrong codes and explains the portal lockout`, async () => {
    answers.push('000000', '111111', '222222', '333333');
    const run = vi.fn(async code => {
      if (!code) throw twoFactorRequired();
      throw twoFactorInvalid();
    });

    await expect(withTwoFactor(run)).rejects.toMatchObject({
      name: 'TwoFactorError',
      message: expect.stringContaining('locks an account for 15 minutes')
    });

    // One password-only probe plus exactly MAX_ATTEMPTS codes — the 4th answer is
    // never read, so the portal's 5-attempt budget is not spent here.
    expect(run).toHaveBeenCalledTimes(MAX_ATTEMPTS + 1);
    expect(answers).toEqual(['333333']);
  });

  test('reports a rejected --otp-code as a code problem, not a password problem', async () => {
    process.stdin.isTTY = false;
    const run = vi.fn(async () => { throw twoFactorInvalid(); });

    await expect(withTwoFactor(run, { otpCode: '000000' })).rejects.toMatchObject({
      name: 'TwoFactorError',
      message: expect.stringContaining('--otp-code')
    });
  });

  // pos-cli talks to private-stack portals that upgrade on their own schedule.
  describe('against a portal too old to send two_factor_invalid', () => {
    test('still blames a rejected preset code rather than the password', async () => {
      process.stdin.isTTY = false;
      const run = vi.fn(async () => { throw unauthorized(); });

      await expect(withTwoFactor(run, { otpCode: '000000' })).rejects.toMatchObject({
        name: 'TwoFactorError',
        message: expect.stringContaining('--otp-code')
      });
    });

    test('still re-prompts after a wrong typed code', async () => {
      answers.push('000000', '123456');
      const run = vi.fn(async code => {
        if (!code) throw twoFactorRequired();
        if (code !== '123456') throw unauthorized();
        return 'token';
      });

      await expect(withTwoFactor(run)).resolves.toBe('token');
    });

    // The inference only holds for a code we sent: a bodiless 401 with no code in play
    // is a wrong password and must stay one.
    test('leaves a bodiless 401 alone when no code was ever sent', async () => {
      const run = vi.fn(async () => { throw unauthorized(); });

      await expect(withTwoFactor(run)).rejects.toMatchObject({ statusCode: 401 });

      expect(run).toHaveBeenCalledTimes(1);
    });
  });

  describe('two_factor_locked', () => {
    test('stops immediately instead of prompting when the account is already locked', async () => {
      const run = vi.fn(async () => { throw twoFactorLocked(); });

      await expect(withTwoFactor(run)).rejects.toMatchObject({
        name: 'TwoFactorError',
        message: expect.stringContaining('locked this account for 15 minutes')
      });

      expect(run).toHaveBeenCalledTimes(1);
      expect(readlineState.interfacesCreated).toBe(0);
    });

    test('stops mid-loop when an attempt earns the lock, leaving later answers unread', async () => {
      answers.push('000000', '111111', '222222');
      const run = vi.fn(async code => {
        if (!code) throw twoFactorRequired();
        if (code === '000000') throw twoFactorInvalid();
        throw twoFactorLocked();
      });

      await expect(withTwoFactor(run)).rejects.toMatchObject({
        name: 'TwoFactorError',
        message: expect.stringContaining('refused unread')
      });

      // The password probe plus two codes — the third answer is never asked for.
      expect(run).toHaveBeenCalledTimes(3);
      expect(answers).toEqual(['222222']);
    });

    test('stops rather than prompting when a preset code earns the lock', async () => {
      const run = vi.fn(async () => { throw twoFactorLocked(); });

      await expect(withTwoFactor(run, { otpCode: '000000' })).rejects.toMatchObject({
        name: 'TwoFactorError'
      });

      expect(readlineState.interfacesCreated).toBe(0);
    });
  });

  test('prompts to replace a rejected preset code when there is a terminal', async () => {
    answers.push('123456');
    const run = vi.fn(async code => {
      if (code !== '123456') throw unauthorized();
      return 'token';
    });

    await expect(withTwoFactor(run, { otpCode: '000000' })).resolves.toBe('token');

    expect(run).toHaveBeenNthCalledWith(1, '000000');
    expect(run).toHaveBeenNthCalledWith(2, '123456');
  });

  test('explains what to set instead of prompting when stdin is not a terminal', async () => {
    process.stdin.isTTY = false;
    const run = vi.fn(async () => { throw twoFactorRequired(); });

    await expect(withTwoFactor(run)).rejects.toMatchObject({
      name: 'TwoFactorError',
      message: expect.stringContaining(OTP_CODE_ENV_VAR)
    });

    expect(run).toHaveBeenCalledTimes(1);
  });

  test('honours an explicit interactive:false even on a terminal (--json runs)', async () => {
    const run = vi.fn(async () => { throw twoFactorRequired(); });

    await expect(withTwoFactor(run, { interactive: false })).rejects.toMatchObject({
      name: 'TwoFactorError'
    });
  });

  test('aborts instead of looping when stdin closes at the prompt', async () => {
    const run = vi.fn(async () => { throw twoFactorRequired(); });

    await expect(withTwoFactor(run)).rejects.toMatchObject({ name: 'TwoFactorError' });

    expect(run).toHaveBeenCalledTimes(1);
  });

  test('re-prompts without spending an attempt when the answer is empty', async () => {
    answers.push('', '123456');
    const run = vi.fn(async code => {
      if (!code) throw twoFactorRequired();
      return 'token';
    });

    await expect(withTwoFactor(run)).resolves.toBe('token');

    // The empty line never reached the portal.
    expect(run).toHaveBeenCalledTimes(2);
  });

  test('propagates non-401 failures untouched', async () => {
    const run = vi.fn(async () => {
      throw Object.assign(new Error('Request failed with status 500'), {
        name: 'StatusCodeError',
        statusCode: 500
      });
    });

    await expect(withTwoFactor(run)).rejects.toMatchObject({ statusCode: 500 });

    expect(run).toHaveBeenCalledTimes(1);
  });

  test('does not spend attempts on a server error raised after a code was entered', async () => {
    answers.push('123456', '654321');
    const run = vi.fn(async code => {
      if (!code) throw twoFactorRequired();
      throw Object.assign(new Error('boom'), { name: 'StatusCodeError', statusCode: 500 });
    });

    await expect(withTwoFactor(run)).rejects.toMatchObject({ statusCode: 500 });

    expect(run).toHaveBeenCalledTimes(2);
    expect(answers).toEqual(['654321']);
  });
});

describe('Portal requests carry the code', () => {
  const PORTAL = 'https://portal.example.com';
  let Portal;

  beforeEach(async () => {
    process.env.PARTNER_PORTAL_HOST = PORTAL;
    Portal = (await import('#lib/portal.js')).default;
    nock.cleanAll();
  });

  afterEach(() => {
    delete process.env.PARTNER_PORTAL_HOST;
    nock.cleanAll();
  });

  test('GET /api/user_tokens sends the code in the UserOtpCode header', async () => {
    const scope = nock(PORTAL, {
      reqheaders: {
        UserAuthorization: 'user@example.com:secret',
        UserOtpCode: '123456'
      }
    }).get('/api/user_tokens').reply(200, [{ token: 'access-token' }]);

    await expect(Portal.login('user@example.com', 'secret', 'https://example.com/', '123456'))
      .resolves.toEqual([{ token: 'access-token' }]);

    scope.done();
  });

  test('GET /api/user_tokens omits the header when there is no code', async () => {
    const scope = nock(PORTAL, { badheaders: ['UserOtpCode'] })
      .get('/api/user_tokens').reply(200, [{ token: 'access-token' }]);

    await Portal.login('user@example.com', 'secret', 'https://example.com/');

    scope.done();
  });

  test('POST /api/authenticate sends the code as otp_code', async () => {
    const scope = nock(PORTAL)
      .post('/api/authenticate', body => /name="otp_code"[\s\S]*123456/.test(body))
      .reply(200, { auth_token: 'jwt' });

    await expect(Portal.jwtToken('user@example.com', 'secret', '123456'))
      .resolves.toEqual({ auth_token: 'jwt' });

    scope.done();
  });

  test('POST /api/authenticate omits otp_code when there is no code', async () => {
    const scope = nock(PORTAL)
      .post('/api/authenticate', body => !/name="otp_code"/.test(body))
      .reply(200, { auth_token: 'jwt' });

    await Portal.jwtToken('user@example.com', 'secret');

    scope.done();
  });
});
