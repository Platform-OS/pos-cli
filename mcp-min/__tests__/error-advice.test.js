/**
 * What a failure tells the agent it can do about it.
 *
 * The CLI routes every API failure through `lib/ServerError.js`, which has a handler per status and
 * a sentence of advice in each: the 50MB limit behind a 413, that a 5xx is already reported, which
 * host did not resolve, and that a Partner Portal outage says nothing about the token. `classify`
 * replaced that — it has to, since `ServerError` prints and exits — and kept the kind while
 * dropping the advice, so the same failures reached a model as a status code and `fetch failed`.
 *
 * Everything here goes through `runTool`, which is the only thing a client ever sees, and asserts
 * the field rather than the sentence: a code, a host, a remedy, a retry hint. Where the message is
 * the only place the advice can live it is the substance that is checked — the number, the host —
 * not the phrasing around it.
 */
import fs from 'fs';
import path from 'path';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { runTool } from '../run-tool.js';
import { resolveAuth } from '../auth.js';
import { ToolError } from '../tool-error.js';

/** A tool that throws whatever the case under test hands it; nothing else is in the way. */
const throwing = (error) => ({ handler: async () => { throw error; } });

const fails = (error) => runTool(throwing(error), {});

/** What `lib/apiRequest.js` throws for a response it did not like. */
const statusError = (status, { body, headers, uri = 'https://staging.example.com/api/app_builder/x' } = {}) =>
  Object.assign(new Error(`Request failed with status ${status}`), {
    name: 'StatusCodeError',
    statusCode: status,
    options: { uri },
    response: { statusCode: status, body, headers }
  });

/** What it throws when `fetch` itself rejected: the message is `fetch failed` and names nothing. */
const requestError = ({ uri, cause } = {}) =>
  Object.assign(new Error('fetch failed'), {
    name: 'RequestError',
    ...(uri !== undefined && { options: { uri } }),
    cause
  });

const systemError = (code, hostname) =>
  Object.assign(new Error(`${code} ${hostname ?? ''}`.trim()), { code, ...(hostname && { hostname }) });

describe('a status the CLI has advice for carries it', () => {
  // `ServerError.entityTooLarge`. The instance answers a 413 with a page, so without the limit the
  // model has a status code and nothing to change.
  test('413 says what the limit is, under a code of its own', async () => {
    const { error } = await fails(statusError(413));

    expect(error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(error.kind).toBe('instance');
    expect(error.message).toContain('50MB');
  });

  test('413 keeps what the instance said as well', async () => {
    const { error } = await fails(statusError(413, { body: 'Request Entity Too Large' }));

    expect(error.details).toMatchObject({ statusCode: 413, body: 'Request Entity Too Large' });
  });

  // `We have been notified about it`: worth a sentence because it stops an agent reporting a
  // platformOS incident to the user as something they did.
  test.each([500, 502, 504])('%i says it is already reported', async (status) => {
    const { error } = await fails(statusError(status));

    expect(error.kind).toBe('unavailable');
    expect(error.code).toBe('INSTANCE_UNAVAILABLE');
    expect(error.message).toMatch(/notified/);
  });

  // The table is the statuses pos-cli knows something extra about. Everything else keeps the bare
  // message, because prose that only restates a status the caller already has is tokens for nothing.
  test.each([
    [401, 'auth', 'UNAUTHORIZED'],
    [404, 'not_found', 'NOT_FOUND'],
    [422, 'instance', 'INSTANCE_REFUSED'],
    [429, 'unavailable', 'INSTANCE_UNAVAILABLE']
  ])('%i is classified as before and gains nothing', async (status, kind, code) => {
    const { error } = await fails(statusError(status));

    expect(error).toMatchObject({ kind, code, message: `Request failed with status ${status}` });
  });

  // A status arriving as a string must not reach Object.prototype and turn a refusal into
  // `undefined` advice, which is what a plain object keyed by status would have done.
  test('a status that is not a number in the table is left alone', async () => {
    const { error } = await fails(Object.assign(new Error('odd'), { statusCode: 'constructor' }));

    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('odd');
  });
});

/**
 * The 503 an instance explains. The Partner Portal validates every API token, so while it is down
 * the instance has no verdict at all — and the obvious next move, refreshing the token, is the one
 * that cannot help and costs a working credential.
 */
describe('a Partner Portal outage is told apart from every other 503', () => {
  const outage = (extra = {}) => statusError(503, {
    body: { error: 'partner_portal_unavailable', ...extra.body },
    headers: extra.headers
  });

  test('it has a code of its own, so an agent can branch on it', async () => {
    const { error } = await fails(outage());

    expect(error.code).toBe('PARTNER_PORTAL_UNAVAILABLE');
    expect(error.kind).toBe('unavailable');
  });

  test('it says the token is not the problem', async () => {
    const { error } = await fails(outage());

    expect(error.message).toMatch(/nothing is wrong with the token/i);
  });

  // On a private stack — a portal host that does not resolve, a URL stored without its port — the
  // instance's own sentence is the whole diagnosis, so it is passed through rather than replaced.
  test('what the instance said about it is kept', async () => {
    const { error } = await fails(outage({ body: { errors: ['portal.private-stack.online timed out after 5s'] } }));

    expect(error.message).toContain('portal.private-stack.online timed out after 5s');
  });

  test('it carries how long to wait, clamped rather than obeyed', async () => {
    const [soon, absurd, unstated] = await Promise.all([
      fails(outage({ headers: { 'retry-after': '0' } })),
      fails(outage({ headers: { 'retry-after': '3600' } })),
      fails(outage())
    ]);

    expect(soon.error.details.retryAfterSeconds).toBe(2);
    expect(absurd.error.details.retryAfterSeconds).toBe(30);
    expect(unstated.error.details.retryAfterSeconds).toBe(10);
  });

  // A 503 from a proxy in front of an instance that is itself down is a different problem, and the
  // body is what tells them apart — the status never could.
  test('a 503 with no such body stays the generic one', async () => {
    const { error } = await fails(statusError(503, { body: { error: 'something else' } }));

    expect(error.code).toBe('INSTANCE_UNAVAILABLE');
    expect(error.details).not.toHaveProperty('retryAfterSeconds');
  });
});

/**
 * `apiRequest` wraps the fetch failure and keeps its message, which is `fetch failed` — three words
 * that name neither the host nor what happened to it. An agent seeing them cannot tell an instance
 * that is down from a URL with a typo in it, and `lib/ServerError.addressNotFound` exists precisely
 * to put the host back.
 */
describe('a connection that never got an answer names the host', () => {
  const dns = 'https://typo.example.com/api/app_builder/releases';

  test('the host is a field, not only a sentence', async () => {
    const { error } = await fails(requestError({ uri: dns, cause: systemError('ENOTFOUND', 'typo.example.com') }));

    expect(error.details.host).toBe('https://typo.example.com');
    expect(error.message).toContain('https://typo.example.com');
  });

  // The origin, not the URI it was called with: whatever a tool put in a query string would
  // otherwise land in the model's context on every failure.
  test('only the origin is reported, never the path or query', async () => {
    const uri = 'https://staging.example.com/api/app_builder/logs?access_token=s3cr3t&lastId=9';
    const { error } = await fails(requestError({ uri, cause: systemError('ECONNREFUSED') }));

    expect(error.details.host).toBe('https://staging.example.com');
    expect(JSON.stringify(error)).not.toContain('s3cr3t');
  });

  // The two answers lead somewhere different: a name that does not resolve is a URL to check, and
  // a refused connection is a service that is not up.
  test('a name that did not resolve is told apart from a host that did not answer', async () => {
    const unresolved = await fails(requestError({ uri: dns, cause: systemError('ENOTFOUND', 'typo.example.com') }));
    const refused = await fails(requestError({ uri: dns, cause: systemError('ECONNREFUSED') }));

    expect(unresolved.error.code).toBe('ENOTFOUND');
    expect(refused.error.code).toBe('ECONNREFUSED');
    expect(unresolved.error.message).not.toBe(refused.error.message);
    expect(unresolved.error.message).toMatch(/resolve/);
  });

  // Node 22 wraps a fetch failure up to three `cause` levels deep, and Happy Eyeballs adds an
  // aggregate on top of that, so neither the code nor the hostname is at the top.
  test('the host is found through the cause chain when the request kept no URI', async () => {
    const buried = requestError({ cause: new Error('fetch failed', { cause: systemError('EAI_AGAIN', 'deep.example.com') }) });

    const { error } = await fails(buried);

    expect(error.details.host).toBe('deep.example.com');
    expect(error.code).toBe('EAI_AGAIN');
  });

  // Nothing is invented: with no host anywhere, the message stays exactly what it was rather than
  // gaining a sentence that says only what the code already says.
  test('a failure that names no host at all is left as it was', async () => {
    const { error } = await fails(requestError({ cause: systemError('ECONNREFUSED') }));

    expect(error.message).toBe('fetch failed');
    expect(error.details).toBeUndefined();
  });

  test('a URI that is not a URL falls back to the hostname underneath it', async () => {
    const { error } = await fails(requestError({ uri: 'not-a-url', cause: systemError('ETIMEDOUT', 'slow.example.com') }));

    expect(error.details.host).toBe('slow.example.com');
  });

  test('an error already classified by the tool that threw it is untouched', async () => {
    const { error } = await fails(ToolError.project('NO_DIRECTORIES', 'nothing to deploy'));

    expect(error).toMatchObject({ kind: 'project', code: 'NO_DIRECTORIES', message: 'nothing to deploy' });
  });
});

/**
 * `ENV_NOT_FOUND` had the environments in hand and did not say them, so the only move left to a
 * model — which cannot read `.pos` — was an `envs-list` round trip it may not have the tool for.
 * `ENV_REQUIRED` has answered this way since TASK-31.
 */
describe('a name that is not in .pos says which names are', () => {
  const CONFIG = {
    staging: { url: 'https://staging.example.com', email: 'a@b.c', token: 't1' },
    prod: { url: 'https://prod.example.com', email: 'a@b.c', token: 't2' }
  };

  /** Resolves credentials the way all nineteen authenticating tools do, and gets no further. */
  const authenticating = { annotations: { readOnlyHint: true }, handler: async (params, ctx) => resolveAuth(params, ctx) };

  const context = (config) => ({
    files: { getConfig: () => config },
    settings: { settingsFromDotPos: name => config[name] }
  });

  beforeEach(() => {
    vi.stubEnv('MPKIT_URL', undefined);
    vi.stubEnv('MPKIT_EMAIL', undefined);
    vi.stubEnv('MPKIT_TOKEN', undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  test('the configured environments are a field the caller can choose from', async () => {
    const { error } = await runTool(authenticating, { env: 'stagng' }, context(CONFIG));

    expect(error.code).toBe('ENV_NOT_FOUND');
    expect(error.details.environments).toEqual(['staging', 'prod']);
    expect(error.message).toContain('staging');
  });

  // With something to choose between, the list is the fix. A remedy on every mistyped name is how
  // a field an agent should act on becomes one it learns to skip.
  test('no command is offered when there is a name to pick instead', async () => {
    const { error } = await runTool(authenticating, { env: 'stagng' }, context(CONFIG));

    expect(error.details).not.toHaveProperty('remedy');
  });

  test('with nothing configured, the command that fixes it is named', async () => {
    const { error } = await runTool(authenticating, { env: 'staging' }, context({}));

    expect(error.details.environments).toEqual([]);
    expect(error.details.remedy.command).toContain('pos-cli env add staging');
  });

  // `--url` is required by the command and nobody here knows it, so the remedy is a person's to
  // finish — the same reason `refresh-token` says so.
  test('and says a person has to run it, so the agent does not', async () => {
    const { error } = await runTool(authenticating, { env: 'staging' }, context({}));

    expect(error.details.remedy.runBy).toMatch(/person/);
    expect(error.details.remedy.command).toContain('<instance url>');
  });

  // Reading .pos to list it is the error path; a second failure there would replace a name the
  // caller can act on with a stack trace they cannot.
  test('a .pos that cannot be read still answers with the error the caller asked about', async () => {
    const broken = { files: { getConfig: () => { throw new Error('EACCES'); } }, settings: { settingsFromDotPos: () => undefined } };

    const { error } = await runTool(authenticating, { env: 'staging' }, broken);

    expect(error.code).toBe('ENV_NOT_FOUND');
  });
});

/**
 * There are three places that build a remedy — a rejected `.pos` token, a name that is not in
 * `.pos`, and a missing tests module — and there will be more. `runBy` is the half that is easy to
 * leave off and the half that matters: without it the obvious move for an agent holding a shell is
 * to run a command that stops on a password prompt, which is the whole reason `refresh-token` is
 * not a tool.
 *
 * Found by the `command` a remedy offers rather than by the `remedy:` key it is sometimes stored
 * under — `refreshTokenRemedy` returns one and names it nothing — so a fourth producer is covered
 * by being written rather than by being added here.
 */
describe('every command this server offers an agent says who runs it', () => {
  const MCP_MIN = path.resolve(import.meta.dirname, '..');

  const sources = (dir = MCP_MIN) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(full);
    return entry.isFile() && entry.name.endsWith('.js') ? [full] : [];
  });

  // Comments first: `auth.js` documents the shape as `{{command: string, runBy: string}}`, and a
  // scan over raw source counts the documentation as a fourth site.
  const code = (text) => text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');

  /**
   * The object literal a `command:` sits in, brace-balanced rather than a fixed window: with a
   * window, a remedy that names no `runBy` passes on the one belonging to the next remedy below it.
   * Placeholders inside the template strings (`${env}`) are balanced, so they count for nothing.
   */
  const enclosing = (text, at) => {
    const start = text.lastIndexOf('{', at);
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1);
    }
    return text.slice(start);
  };

  /** Every command this server offers, with the object it is offered in. */
  const offers = () => sources().flatMap((file) => {
    const text = code(fs.readFileSync(file, 'utf8'));
    return [...text.matchAll(/(?<![\w.])command:/g)]
      .map(({ index }) => ({ file: path.relative(MCP_MIN, file), body: enclosing(text, index) }));
  });

  test('the scan finds the ones there are, so it is not passing on an empty list', () => {
    expect(offers().map(({ file }) => file).sort()).toEqual(['auth.js', 'auth.js', 'tests/module-check.js']);
  });

  test('none of them leaves out runBy', () => {
    const silent = offers().filter(({ body }) => !body.includes('runBy:')).map(({ file }) => file);

    expect(silent, 'a remedy is { command, runBy }: an agent must not run a command a person has to').toEqual([]);
  });
});
