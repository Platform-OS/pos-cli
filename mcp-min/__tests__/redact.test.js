/**
 * What the log is allowed to say.
 *
 * `~/.pos-cli/logs/mcp-min.log` is append-only, shared by every session on the machine, and
 * `DEBUG=1` is the first thing anyone does when an MCP client misbehaves — which is exactly when
 * credentials are moving through the server. These tests pin what may reach it.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { redact, mask, scrubString, REDACTED, MAX_DEPTH, MAX_STRING_LENGTH, MAX_ARRAY_LENGTH, MAX_ENTRIES } from '../redact.js';
import { maskToken } from '../auth.js';
import { supportsPosixPermissions, permissionsOf } from '../../lib/filePermissions.js';

const SECRET = 'sk-live-0123456789abcdefghij';

describe('keys whose value is a credential', () => {
  test.each([
    'authorization', 'Authorization', 'proxy-authorization',
    'cookie', 'Set-Cookie',
    'password', 'passwd', 'secret', 'client_secret', 'clientSecret', 'private_key',
    'api_key', 'apiKey', 'x-api-key', 'X_API_KEY',
    'refresh_token', 'credentials', 'two_factor_session',
    'device_code', 'user_code', 'UserTemporaryToken'
  ])('%s is replaced entirely', (key) => {
    expect(redact({ [key]: SECRET })).toEqual({ [key]: REDACTED });
  });

  // Half a password is still a password's worth of clues, and a Cookie header can carry several
  // credentials at once — there is nothing in either worth keeping.
  test('nothing of the value survives', () => {
    const line = JSON.stringify(redact({ cookie: `session=${SECRET}; other=1` }));

    expect(line).not.toContain(SECRET);
    expect(line).not.toContain(SECRET.slice(0, 3));
  });
});

describe('keys that name a credential', () => {
  // A session id names a stream on a transport that has no authentication: knowing one gains
  // nothing that reaching the port does not, and it is what ties a log line to a session.
  test.each(['session', 'sessionId', 'Mcp-Session-Id', 'x-session-id'])('%s is masked, so a log can still be followed', (key) => {
    expect(redact({ [key]: SECRET })).toEqual({ [key]: 'sk-...hij' });
  });

  test.each(['token', 'access_token', 'accessToken', 'api_token', 'auth_token', 'MPKIT_TOKEN', 'jwt'])(
    '%s is masked, not printed',
    (key) => {
      const redacted = redact({ [key]: SECRET });

      expect(redacted[key]).toBe('sk-...hij');
      expect(redacted[key]).not.toContain('live');
    }
  );

  // Masking says *which* credential without handing it over; three characters of a short one
  // would hand over most of it.
  test('a short value is redacted rather than masked', () => {
    expect(redact({ token: 'abc12345' })).toEqual({ token: REDACTED });
    expect(mask('abc12345')).toBe(REDACTED);
    expect(mask('abcdefghijkl')).toBe('abc...jkl');
  });

  // The pattern this exists for: a tool logs `tokenProvided: true` instead of the token.
  test.each([true, false])('a boolean under a credential name is the fact, not the credential (%s)', (given) => {
    expect(redact({ tokenProvided: given, hasPassword: given })).toEqual({ tokenProvided: given, hasPassword: given });
  });

  test('an absent or empty token is reported as it is: "none was sent" is information', () => {
    expect(redact({ token: '', accessToken: null, refreshedToken: undefined }))
      .toEqual({ token: '', accessToken: null });
  });

  test('an object under a token key is redacted whole, since its shape is unknown', () => {
    expect(redact({ token: { value: SECRET } })).toEqual({ token: REDACTED });
  });

  // The log line and the `meta.auth.token` a tool returns must look the same, or reading one
  // against the other is guesswork. maskToken is the tool-side definition.
  test('masking matches maskToken, the one tools already use', () => {
    for (const value of [SECRET, 'abcdefghijklmnop', 'x'.repeat(64)]) {
      expect(mask(value)).toBe(maskToken(value));
    }
  });
});

describe('names nobody has added to the list yet', () => {
  // The next credential will arrive under a name this module has not heard of — an `X-Auth-Token`
  // header, a `portalApiKey` setting — so the tail of the name is matched as well as the whole.
  test.each([
    ['x-auth-token', 'sk-...hij'],
    ['instanceToken', 'sk-...hij'],
    ['tokens', REDACTED]
  ])('%s is masked by its ending', (key, expected) => {
    expect(redact({ [key]: key === 'tokens' ? [SECRET] : SECRET })).toEqual({ [key]: expected });
  });

  test.each(['portalApiKey', 'admin_password', 'CLIENT_SECRET', 'appCookie', 'password_hint'])(
    '%s is redacted by the word in it',
    (key) => {
      expect(redact({ [key]: SECRET })).toEqual({ [key]: REDACTED });
    }
  );

  // The deliberate cost of matching anywhere in the name rather than only at its end: a field
  // that merely mentions a credential is treated as one. Losing a `tokenExpiry` to the log is
  // cheaper than publishing a `token_value`, so this is the way round to be wrong.
  test.each(['tokenExpiry', 'tokenCount', 'secretary'])('%s is caught too, which is the accepted cost', (key) => {
    expect(redact({ [key]: 'plain text' })).not.toEqual({ [key]: 'plain text' });
  });

  test('a key that mentions no credential is untouched', () => {
    expect(redact({ description: 'a token is needed', status: 'ok' })).toEqual({ description: 'a token is needed', status: 'ok' });
  });

  // refresh_token is a secret in its own right: the suffix rule must not downgrade it to masking.
  test('a key in both sets is treated as the stricter one', () => {
    expect(redact({ refresh_token: SECRET })).toEqual({ refresh_token: REDACTED });
  });
});

describe('credentials inside strings', () => {
  test('a credential in a URL\'s userinfo is scrubbed', () => {
    expect(scrubString('https://deploy:hunter2secret@app.example.com/x')).toBe('https://deploy:[redacted]@app.example.com/x');
  });

  // "Device token exchange failed" is prose, not a credential: the rule wants something long
  // enough and with a digit in it, which every token these servers issue has.
  test.each(['Device token exchange failed', 'Bearer authorization required', 'token expired'])(
    'ordinary prose is left alone: %s',
    (text) => {
      expect(scrubString(text)).toBe(text);
    }
  );

  test.each([
    ['an Authorization value', `Token ${SECRET}`, 'Token [redacted]'],
    ['a Basic scheme', `Basic ${SECRET}`, 'Basic [redacted]'],
    ['a Bearer scheme', `Bearer ${SECRET}`, 'Bearer [redacted]'],
    ['one inside a sentence', `sent Authorization: Token ${SECRET} upstream`, 'sent Authorization: Token [redacted] upstream']
  ])('%s is scrubbed', (_label, text, expected) => {
    expect(scrubString(text)).toBe(expected);
  });

  test.each([
    ['a device code', `https://portal.example.com/oauth?device_code=${SECRET}&x=1`, 'device_code=[redacted]&x=1'],
    ['an access token', `https://x.example.com/api?access_token=${SECRET}`, 'access_token=[redacted]'],
    ['a password', `https://x.example.com/?user=a&password=${SECRET}#frag`, 'password=[redacted]#frag']
  ])('%s in a URL is scrubbed', (_label, url, expectedEnding) => {
    const scrubbed = scrubString(url);

    expect(scrubbed).toContain(expectedEnding);
    expect(scrubbed).not.toContain(SECRET);
  });

  test('a string that only looks like a scheme is left alone', () => {
    expect(scrubString('token expired')).toBe('token expired');
    expect(scrubString('Bearer with no credential')).toBe('Bearer with no credential');
  });

  test('scrubbing reaches strings anywhere in the structure', () => {
    const line = JSON.stringify(redact({ requests: [{ note: `curl -H 'Authorization: Token ${SECRET}'` }] }));

    expect(line).not.toContain(SECRET);
  });
});

describe('the shape of what is logged', () => {
  test('anything not named as a credential is kept as it is', () => {
    const data = { method: 'POST', url: '/mcp', status: 403, ok: false, headers: { 'user-agent': 'curl/8.5' } };

    expect(redact(data)).toEqual(data);
  });

  test('a value inside itself is reported, not followed', () => {
    const cyclic = { name: 'loop' };
    cyclic.self = cyclic;

    expect(redact(cyclic)).toEqual({ name: 'loop', self: '[circular]' });
  });

  // Two references to one object are ordinary — a tool result and its meta often share one — and
  // must not be mistaken for a cycle.
  test('the same object twice is not a cycle', () => {
    const shared = { keep: 'me' };

    expect(redact({ a: shared, b: shared })).toEqual({ a: { keep: 'me' }, b: { keep: 'me' } });
  });

  test('nesting stops at a bounded depth', () => {
    let deep = 'bottom';
    for (let n = 0; n < MAX_DEPTH + 3; n++) deep = { deep };

    expect(JSON.stringify(redact(deep))).toContain('[deep]');
  });

  test('a long value is kept, bounded, and says how much was dropped', () => {
    const long = 'a'.repeat(MAX_STRING_LENGTH + 500);

    const redacted = redact({ body: long });

    expect(redacted.body).toHaveLength(MAX_STRING_LENGTH + '… (500 more characters)'.length);
    expect(redacted.body.startsWith('a'.repeat(100))).toBe(true);
    expect(redacted.body).toContain('(500 more characters)');
  });

  // A 10 MB upload is an object of numeric keys to JSON: without this, one log line per byte.
  test.each([
    ['a Buffer', { body: Buffer.from('a'.repeat(300)) }, { body: '[Buffer(300 bytes)]' }],
    ['a typed array', { view: new Uint8Array(16) }, { view: '[Uint8Array(16 bytes)]' }],
    ['an ArrayBuffer', { raw: new ArrayBuffer(32) }, { raw: '[ArrayBuffer(32 bytes)]' }]
  ])('%s is summarised, not spelled out', (_label, data, expected) => {
    expect(redact(data)).toEqual(expected);
  });

  test('a long list is kept, bounded, and says how much was dropped', () => {
    const redacted = redact({ rows: Array.from({ length: MAX_ARRAY_LENGTH + 40 }, (_, i) => i) });

    expect(redacted.rows).toHaveLength(MAX_ARRAY_LENGTH + 1);
    expect(redacted.rows[0]).toBe(0);
    expect(redacted.rows.at(-1)).toBe('… (40 more items)');
  });

  test.each([
    ['a bigint, which JSON.stringify throws on', { n: 10n }, { n: '10' }],
    ['an Error, which JSON.stringify empties', { err: new TypeError('bad input') }, { err: { error: 'TypeError: bad input' } }],
    ['a Date', { at: new Date('2026-01-02T03:04:05Z') }, { at: '2026-01-02T03:04:05.000Z' }],
    ['a Map', { m: new Map([['a', 1]]) }, { m: '[Map(1)]' }],
    ['a Set', { s: new Set([1, 2]) }, { s: '[Set(2)]' }],
    ['a function', { fn: () => {} }, { fn: '[function]' }]
  ])('%s survives serialisation', (_label, data, expected) => {
    const redacted = redact(data);

    expect(redacted).toEqual(expected);
    expect(() => JSON.stringify(redacted)).not.toThrow();
  });

  test('an error carrying a credential in its message is scrubbed too', () => {
    expect(redact({ err: new Error(`request failed: Token ${SECRET}`) }))
      .toEqual({ err: { error: 'Error: request failed: Token [redacted]' } });
  });

  // `fetch failed` says nothing; the code that says what happened sits two or three `cause`
  // levels down (CLAUDE.md, Network Error Handling), so the chain is kept.
  test('an error keeps its cause chain and its code', () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { code: 'ECONNREFUSED' });
    const failure = Object.assign(new TypeError('fetch failed'), { cause });

    expect(redact({ err: failure })).toEqual({
      err: {
        error: 'TypeError: fetch failed',
        cause: { error: 'Error: connect ECONNREFUSED 127.0.0.1:443', code: 'ECONNREFUSED' }
      }
    });
  });

  test('an API error keeps the status code the instance answered with', () => {
    expect(redact({ err: Object.assign(new Error('Request failed with status 422'), { statusCode: 422 }) }))
      .toEqual({ err: { error: 'Error: Request failed with status 422', statusCode: 422 } });
  });

  // What a tool's params look like when they arrive: JSON.parse makes `__proto__` an ordinary own
  // key, and assigning it would set a prototype — the field would vanish from the line, and the
  // object handed to JSON.stringify would carry whatever was in it.
  test('a __proto__ key is logged as a field, not applied as a prototype', () => {
    const parsed = JSON.parse('{"__proto__": {"polluted": true}, "env": "staging"}');

    const redacted = redact(parsed);

    expect(Object.hasOwn(redacted, '__proto__')).toBe(true);
    expect(redacted.polluted).toBeUndefined();
    // Compared as text: an object literal with `__proto__` in it sets a prototype rather than a
    // key, so it cannot express what is being asserted here.
    expect(JSON.stringify(redacted)).toBe('{"__proto__":{"polluted":true},"env":"staging"}');
    expect({}.polluted).toBeUndefined();
  });

  test('other prototype member names are ordinary fields', () => {
    const redacted = redact({ constructor: 'text', toString: 'text' });

    expect(redacted.constructor).toBe('text');
    expect(redacted.toString).toBe('text');
  });

  test('an object with more keys than the cap is bounded, and says how many were dropped', () => {
    const wide = Object.fromEntries(Array.from({ length: MAX_ENTRIES + 25 }, (_, i) => [`field${i}`, i]));

    const redacted = redact(wide);

    expect(Object.keys(redacted)).toHaveLength(MAX_ENTRIES + 1);
    expect(redacted['…']).toBe('(25 more keys)');
  });

  test('undefined data stays undefined, so a line with no data still has none', () => {
    expect(redact(undefined)).toBeUndefined();
  });

  test('a bare string or number is handled, not only an object', () => {
    expect(redact(`Token ${SECRET}`)).toBe('Token [redacted]');
    expect(redact(42)).toBe(42);
  });
});

describe('the logger writes what redact allows, and nothing else', () => {
  let dir;
  let logFile;

  const loadLog = async ({ debug } = {}) => {
    vi.resetModules();
    vi.stubEnv('MCP_MIN_LOG_FILE', logFile);
    vi.stubEnv('DEBUG', debug ? '1' : '');
    vi.stubEnv('MCP_MIN_DEBUG', '');
    return (await import('../log.js')).default;
  };

  const written = () => (fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '');

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-min-log-'));
    logFile = path.join(dir, 'mcp-min.log');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('a header a client sent reaches neither the file nor stderr', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const log = await loadLog({ debug: true });

    log.debug('HTTP request', {
      method: 'POST',
      url: '/mcp',
      headers: { authorization: `Token ${SECRET}`, cookie: `s=${SECRET}`, 'user-agent': 'curl/8.5' }
    });

    const onStderr = stderr.mock.calls.map(([line]) => line).join('');
    for (const sink of [written(), onStderr]) {
      expect(sink).not.toContain(SECRET);
      expect(sink).toContain('"authorization":"[redacted]"');
      // Still worth reading: the request is described, only the credentials are not.
      expect(sink).toContain('"method":"POST"');
      expect(sink).toContain('"user-agent":"curl/8.5"');
    }
  });

  test('a credential in the message itself is scrubbed', async () => {
    const log = await loadLog();

    log.info(`upstream rejected Token ${SECRET}`);

    expect(written()).toContain('upstream rejected Token [redacted]');
    expect(written()).not.toContain(SECRET);
  });

  // A log line must never be the thing that fails a request.
  test('data that cannot be serialised does not throw', async () => {
    const log = await loadLog();
    const cyclic = {};
    cyclic.self = cyclic;

    expect(() => log.info('cyclic', cyclic)).not.toThrow();
    expect(() => log.info('bigint', { n: 1n })).not.toThrow();
    expect(written()).toContain('[circular]');
  });

  // Reading a value can fail — a lazy getter on a request object, for instance — and the caller
  // was logging, not serialising. It gets a line saying so, and its own work stands.
  test('a value that throws when read is reported, not propagated', async () => {
    const log = await loadLog();
    const hostile = { get boom() { throw new Error('do not read me'); } };

    expect(() => log.info('hostile value', hostile)).not.toThrow();

    expect(written()).toContain('hostile value');
    expect(written()).toContain('[unserialisable]');
  });

  // A `toJSON` that throws never gets the chance: redaction reads own properties and writes the
  // method out as a marker, so the hazard is gone before JSON.stringify sees it.
  test('a toJSON that throws is defused rather than invoked', async () => {
    const log = await loadLog();

    expect(() => log.info('hostile toJSON', { nested: { toJSON() { throw new Error('never called'); } } })).not.toThrow();

    expect(written()).toContain('"toJSON":"[function]"');
  });

  test('debug lines stay gated on DEBUG', async () => {
    const log = await loadLog({ debug: false });

    log.debug('not written', { a: 1 });
    log.info('written', { a: 1 });

    expect(written()).not.toContain('not written');
    expect(written()).toContain('written');
  });

  test.skipIf(!supportsPosixPermissions)('a new log file is owner-only', async () => {
    const log = await loadLog();

    log.info('first line');

    expect(permissionsOf(logFile)).toBe(0o600);
  });

  // Every log written before this change could hold an Authorization header verbatim.
  test.skipIf(!supportsPosixPermissions)('a log left behind by an earlier version is tightened', async () => {
    fs.writeFileSync(logFile, 'old line\n', { mode: 0o644 });
    fs.chmodSync(logFile, 0o644);

    const log = await loadLog();
    log.info('new line');

    expect(permissionsOf(logFile)).toBe(0o600);
    expect(written()).toContain('old line');
  });
});
