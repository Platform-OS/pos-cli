/**
 * One envelope, enforced rather than agreed.
 *
 * Every result a client sees is built by `runTool`: `{ ok: true, data, meta }` or
 * `{ ok: false, error: { kind, code, message, details? }, meta }`, and the protocol layer derives
 * `isError` from `ok === false` in one place. Before that existed the shape was a convention, and
 * four tools had drifted off it — `migrations-*` answered `{ status }`, so a failed migration
 * reached clients as a successful call, and nobody noticed for a release.
 *
 * These are the checks that stop a thirty-sixth envelope being invented: a tool returns its data
 * and throws to fail, and anything else is caught here rather than in production.
 */
import fs from 'fs';
import path from 'path';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import registry from '../tools.js';
import { runTool } from '../run-tool.js';
import { resolveAuth } from '../auth.js';
import { ToolError, ERROR_KINDS, MAX_ERROR_BODY_LENGTH } from '../tool-error.js';

const MCP_MIN = path.resolve(import.meta.dirname, '..');

// Comments are stripped before anything is matched. This repository explains itself at length, and
// the explanation of a defect quotes the defect: `instructions.js` describes `{ status: 'ok' }` in
// prose, and a scan over raw source reported it as the thing it was warning about. Whole-line and
// block comments only, so a string containing `//` — every https URL — is left alone.
const code = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter(line => !/^\s*(\/\/|\*)/.test(line))
  .join('\n');

// The tool modules, and only those. Derived from what `tools.js` imports rather than by walking
// the tree: `data/validate.js`, `generators/utils.js` and `host-validation.js` are libraries whose
// own `{ ok }` return is their callers' business, and scanning everything reported them — and the
// instructions string, which ships the words `ok:false` to the model — as tools breaking the rule.
// Deriving the list from the registry's own imports also means a tool added later is covered
// without anyone remembering to add it here.
const toolModules = () => {
  const registrySource = fs.readFileSync(path.join(MCP_MIN, 'tools.js'), 'utf8');
  // Every tool lives in a directory of its own group; `./log.js` is the registry's own import for
  // the one tool defined inline.
  const imported = [...registrySource.matchAll(/^import \w+ from '\.\/(.+?)';$/gm)]
    .map(match => match[1])
    .filter(file => file.includes('/'));

  return [['tools.js', code(registrySource)], ...imported.map(file => [file, code(fs.readFileSync(path.join(MCP_MIN, file), 'utf8'))])];
};

describe('no tool builds a result itself', () => {
  // If this drifts, everything below is checking the wrong set of files and passing for that
  // reason. One tool (envs-list) is defined inline in the registry, so the imports are one fewer.
  test('the modules under test are the registered tools', () => {
    expect(toolModules().length).toBe(registry.size);
  });

  // Matched on the envelope's syntax, not the word: `graphql-exec`'s description tells the model
  // that "errors come back as ok:false", and a looser pattern reported that sentence as the defect
  // it warns about.
  //
  // There is no check for a `status: 'ok' | 'error'` envelope. It cannot do harm any more: a
  // handler no longer sets `ok`, so `runTool` reads whatever it returns as data and the protocol's
  // `isError` still comes out right — the old bug was that `status` *replaced* the failure signal.
  // Meanwhile `status` is ordinary vocabulary here (env-add's background waiter reports
  // success/timeout/error), so the check cost more in false alarms than it bought.
  test.each([
    ['an ok envelope', /\{\s*ok:\s*(true|false)\b/],
    ['its own timing meta', /\bstartedAt:\s*new Date\(\)/]
  ])('no module constructs %s', (_label, pattern) => {
    const offenders = toolModules().filter(([, text]) => pattern.test(text)).map(([file]) => file);

    expect(offenders, 'a handler returns its data and throws to fail; runTool builds the rest').toEqual([]);
  });

  // meta.auth is the invoker's, built from what resolveAuth recorded. Thirteen tools used to
  // assemble the same masked block, which is how one of them could quietly differ.
  test('no tool masks a token for its own result', () => {
    const offenders = toolModules()
      .filter(([file, text]) => file !== 'auth.js' && /maskToken/.test(text))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  /**
   * A kind says what the caller should do next about a failure the tool did not expect, so
   * choosing one is the taxonomy's job. `uploads-push` decided for itself that anything without an
   * HTTP status was `unavailable` — "the same call may work later" — which told an agent that a
   * TypeError of ours was worth retrying.
   *
   * So the kind handed to `new ToolError` has to come from something that decided it: `.kind` off
   * a classified error, or `kindForStatus` for the endpoints that answer with a status instead of
   * throwing. A literal or a bare local is someone choosing by hand.
   *
   * Matched on the argument's position rather than on kind names appearing in the source, which
   * was the first attempt and cannot work: `cancelled`, `input` and `instance` are ordinary words
   * here, and it fired on `env-add`'s waiter returning `{ status: 'cancelled' }`.
   *
   * It says nothing about `ToolError.<kind>()`, which is how a tool raises a condition it
   * recognises — `EMPTY_ARCHIVE`, `FILE_NOT_FOUND` — and is right to choose for itself. Whether
   * one of those is reached for inside a catch block is not something a scan can see; the
   * per-tool error tests are what cover that.
   */
  test('a kind handed to new ToolError comes from something that decided it', () => {
    const decided = /(\.kind|^kindForStatus\(.*\))$/;
    const offenders = toolModules().flatMap(([file, text]) =>
      [...text.matchAll(/new ToolError\(\s*([^,]+),/g)]
        .filter(([, kind]) => !decided.test(kind.trim()))
        .map(([, kind]) => `${file}: new ToolError(${kind.trim()}, …)`));

    expect(offenders, 'take the kind from classify(err).kind or kindForStatus(status)').toEqual([]);
  });

  test('every kind used anywhere is one the closed set defines', () => {
    const used = new Set();
    for (const [, text] of toolModules()) for (const [, kind] of text.matchAll(/ToolError\.([a-z_]+)\(/g)) used.add(kind);
    const unknown = [...used].filter(kind => !Object.hasOwn(ERROR_KINDS, kind));

    expect(unknown, `kinds are ${Object.keys(ERROR_KINDS).join(', ')}`).toEqual([]);
    expect(used.size, 'no tool classifies anything, which means the conversion did not happen').toBeGreaterThan(3);
  });

  // The call context hands tools one named object. A positional call was read as that object,
  // turned into NaN by the counter and written to the wire as `progress: null`; the reporter
  // throws on it now, and this is what catches a new call site no test exercises.
  test('every sendProgress call passes the one named object', () => {
    const calls = toolModules().flatMap(([file, text]) =>
      [...text.matchAll(/sendProgress(?:\?\.)?\(\s*(\S)/g)].map(([call, first]) => ({ file, call, first })));

    expect(calls.length, 'no tool reports progress, so this is checking nothing').toBeGreaterThan(0);
    expect(calls.filter(({ first }) => first !== '{').map(({ file, call }) => `${file}: ${call}`),
      'sendProgress({ progress, total?, message? })').toEqual([]);
  });
});

describe('runTool is the only thing that shapes a result', () => {
  test('a handler that still returns an envelope fails loudly instead of being wrapped twice', async () => {
    const halfConverted = { handler: async () => ({ ok: true, data: { x: 1 }, meta: {} }) };

    const result = await runTool(halfConverted, {});

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('DOUBLE_ENVELOPE');
  });

  // The drift this catches is otherwise silent, and there are thirty tools: an error that cannot
  // say which one half-converted is most of the way to no error at all. Every dispatch path knows
  // the registry key, so it passes it.
  test('it names the tool, which is the only thing that makes it actionable', async () => {
    const halfConverted = { handler: async () => ({ ok: false, error: {} }) };

    const result = await runTool(halfConverted, {}, { toolName: 'data-import' });

    expect(result.error.message).toContain('data-import');
  });

  // toolName is the dispatcher's, and the handler context is a documented shape.
  test('the name is not passed on to the handler', async () => {
    let seen;
    await runTool({ handler: async (_params, ctx) => { seen = ctx; } }, {}, { toolName: 'envs-list', transport: 'stdio' });

    expect(seen).not.toHaveProperty('toolName');
    expect(seen.transport).toBe('stdio');
  });

  // `status` on its own is ordinary payload — a release record and a job both carry one — so the
  // guard must not fire on it, or every deploy status becomes an internal error.
  test('a payload that merely has a status field is left alone', async () => {
    const result = await runTool({ handler: async () => ({ status: 'success', id: 41 }) }, {});

    expect(result).toMatchObject({ ok: true, data: { status: 'success', id: 41 } });
  });

  test('a handler that returns nothing still produces a well-formed result', async () => {
    const result = await runTool({ handler: async () => undefined }, {});

    expect(result.ok).toBe(true);
    expect(result.data).toBeNull();
    expect(result.meta.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('one call cannot carry its credentials into the next through a shared context', async () => {
    const ctx = {};
    await runTool({ handler: async (_p, c) => { c.resolvedAuth = { url: 'https://a.example.com', token: 'secret-value-1' }; } }, {}, ctx);
    const second = await runTool({ handler: async () => ({}) }, {}, ctx);

    expect(ctx.resolvedAuth).toBeUndefined();
    expect(second.meta.auth).toBeUndefined();
  });

  test.each(Object.keys(ERROR_KINDS))('a thrown %s error keeps its kind, code and message', async (kind) => {
    const result = await runTool({ handler: async () => { throw new ToolError(kind, 'A_CODE', 'what went wrong'); } }, {});

    expect(result).toMatchObject({ ok: false, error: { kind, code: 'A_CODE', message: 'what went wrong' } });
    expect(result.meta.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

/**
 * What an upstream failure costs the model. Measured against a real instance: a JSON or plain-text
 * error body is 10–27 bytes, an error page is 1,430 (404) to 2,062 (503), and the whole result of
 * the worst of those is 2,597 bytes. Nothing observed reaches the ceiling; it is there for the tail
 * one instance cannot show us, and it must not cost the reason.
 */
describe('an upstream error body is bounded, and stays readable', () => {
  const failing = (body) => ({
    handler: async () => {
      throw Object.assign(new Error('Request failed with status 503'), {
        statusCode: 503,
        response: { statusCode: 503, body }
      });
    }
  });

  test('a body far larger than the ceiling is cut, and says how much was dropped', async () => {
    const backtrace = `NoMethodError: ${'x'.repeat(40000)}`;

    const { error } = await runTool(failing(backtrace), {});

    expect(error.details.body.length).toBeLessThan(backtrace.length);
    expect(error.details.body).toMatch(/… \(\d+ more characters\)$/);
  });

  test('what it keeps is the head, which is where the reason is', async () => {
    const backtrace = `NoMethodError: undefined method 'id'\n${'x'.repeat(40000)}`;

    const { error } = await runTool(failing(backtrace), {});

    expect(error.details.body).toContain("undefined method 'id'");
    expect(error.details.statusCode).toBe(503);
  });

  /**
   * The two error pages this API serves are 1,430 and 2,062 bytes whose entire content is their
   * title; an evaluation measured a pair of them at 12% of everything it spent on the server. Both
   * sit under the truncation ceiling, so bounding alone never touched them.
   */
  test('an HTML error page is reduced to its title', async () => {
    const page = `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset='utf-8'>\n  <title>Oops (503)</title>\n</head>\n<body><style>.a{}</style></body>\n</html>`;

    const { error } = await runTool(failing(page), {});

    expect(error.details.body).toBe(`HTML error page: Oops (503) (${page.length} bytes, not shown)`);
    expect(error.details.body.length).toBeLessThan(page.length / 2);
  });

  test('an HTML page with no title still says what it was', async () => {
    const { error } = await runTool(failing('<html><body>nothing useful</body></html>'), {});

    expect(error.details.body).toMatch(/^HTML error page \(\d+ bytes, not shown\)$/);
  });

  // The `/_tests/*` endpoints answer with a status rather than throwing, so they build their own
  // error rather than going through `classify`. The bound is in `toResult`, so they get it too.
  test('a body a tool put in details itself is bounded the same way', async () => {
    const page = `<!DOCTYPE html><html><head><title>Aw, Snap!</title></head><body>${'z'.repeat(1400)}</body></html>`;
    const tool = { handler: async () => { throw ToolError.not_found('HTTP_ERROR', 'Request failed with status 404', { statusCode: 404, body: page }); } };

    const { error } = await runTool(tool, {});

    expect(error.details.body).toContain('Aw, Snap!');
    expect(error.details.body).not.toContain('zzz');
  });

  test('a body within the ceiling is untouched, which is every one measured', async () => {
    const realistic = 'HTTP Token: Access denied.';

    const { error } = await runTool(failing(realistic), {});

    expect(error.details.body).toBe(realistic);
  });

  // Parsed JSON is small, structured, and carries what a failed deploy names — the file it
  // objected to. Cutting it would leave the model a string that no longer parses.
  test('a JSON body is never cut, however long', async () => {
    const body = { error: 'deploy failed', details: { file_path: 'app/views/pages/index.liquid' }, noise: 'y'.repeat(MAX_ERROR_BODY_LENGTH * 2) };

    const { error } = await runTool(failing(body), {});

    expect(error.details.body).toEqual(body);
  });
});

describe('every registered tool answers in that shape', () => {
  // Called with nothing, against a gateway that refuses. Whatever each tool makes of that — a
  // missing argument, no credentials, the refusal itself — the answer has to be well formed.
  class Refuses {
    constructor() {
      return new Proxy(this, { get: () => async () => { const e = new Error('Unauthorized'); e.statusCode = 401; throw e; } });
    }
  }

  // Local tools that would read or walk the working tree if called with defaults; they are covered
  // by their own tests, and running them here would lint the repository.
  const READS_THE_TREE = new Set(['check-run', 'generators-list', 'generators-help', 'generators-run', 'data-validate', 'data-import']);

  test.each([...registry.keys()].filter(name => !READS_THE_TREE.has(name)))('%s', async (name) => {
    const result = await runTool(registry.get(name), {}, { Gateway: Refuses, request: async () => { throw new Error('offline'); } });

    expect(Object.keys(result).sort()).toEqual(result.ok ? ['data', 'meta', 'ok'] : ['error', 'meta', 'ok']);
    if (result.ok === false) {
      expect(Object.hasOwn(ERROR_KINDS, result.error.kind), `${name} reported kind ${result.error.kind}`).toBe(true);
      expect(typeof result.error.code).toBe('string');
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  }, 20000);
});

/**
 * The one failure a tool can name a fix for. An expired stored token answers `kind: auth`, which
 * an agent cannot act on by itself — `refresh-token` needs a password and a second factor, so it
 * is not an MCP tool. The command rides in `details`, and is attached to nothing else.
 */
describe('a rejected stored credential says how it is fixed', () => {
  const CONFIG = {
    staging: { url: 'https://staging.example.com', email: 'a@b.c', token: 'staging-token' },
    prod: { url: 'https://prod.example.com', email: 'a@b.c', token: 'prod-token' }
  };

  const unauthorized = () => Object.assign(new Error('Request failed with status 401'), {
    name: 'StatusCodeError',
    statusCode: 401,
    response: { statusCode: 401, body: { error: 'Unauthorized' } }
  });

  /** Resolves credentials the way all nineteen authenticating tools do, then is refused. */
  const refused = (fail = unauthorized) => ({
    annotations: { readOnlyHint: true },
    handler: async (params, ctx) => {
      await resolveAuth(params, ctx);
      throw fail();
    }
  });

  const context = (config = CONFIG) => ({
    files: { getConfig: () => config },
    settings: { settingsFromDotPos: name => config[name] }
  });

  beforeEach(() => {
    // resolveAuth reads MPKIT_* before the .pos fallback; a developer's own .env must not decide
    // which credential these resolve to.
    vi.stubEnv('MPKIT_URL', undefined);
    vi.stubEnv('MPKIT_EMAIL', undefined);
    vi.stubEnv('MPKIT_TOKEN', undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  test('the command names the environment that was actually rejected', async () => {
    const result = await runTool(refused(), { env: 'prod' }, context());

    expect(result.error.kind).toBe('auth');
    expect(result.error.details.remedy.command).toBe('pos-cli env refresh-token prod');
  });

  // Without this the obvious next move for an agent holding a shell is to run the command and hang
  // on the password prompt.
  test('it says a person has to run it, so the agent does not try', async () => {
    const result = await runTool(refused(), { env: 'staging' }, context());

    expect(result.error.details.remedy.runBy).toMatch(/person/);
  });

  test('it joins what the instance said rather than replacing it', async () => {
    const result = await runTool(refused(), { env: 'staging' }, context());

    expect(result.error.details).toMatchObject({ statusCode: 401, body: { error: 'Unauthorized' } });
  });

  // Refreshing a .pos entry would not touch a credential the caller passed in.
  test('credentials the caller supplied are not something refresh-token can fix', async () => {
    const params = { url: 'https://staging.example.com', email: 'a@b.c', token: 'supplied' };

    const result = await runTool(refused(), params, context());

    expect(result.error.kind).toBe('auth');
    expect(result.error.details).not.toHaveProperty('remedy');
  });

  // Nor would it touch the environment this server was started in.
  test('MPKIT_* credentials are not something refresh-token can fix either', async () => {
    vi.stubEnv('MPKIT_URL', 'https://staging.example.com');
    vi.stubEnv('MPKIT_EMAIL', 'a@b.c');
    vi.stubEnv('MPKIT_TOKEN', 'from-the-environment');

    const result = await runTool(refused(), {}, context());

    expect(result.error.kind).toBe('auth');
    expect(result.error.details).not.toHaveProperty('remedy');
  });

  // `auth` covers "there were no credentials" as well, and there is no environment to name there.
  test('an auth failure with nothing resolved names no command', async () => {
    const result = await runTool(refused(), {}, context({}));

    expect(result.error).toMatchObject({ kind: 'auth', code: 'AUTH_MISSING' });
    expect(result.error.details).toBeUndefined();
  });

  // The advice belongs to a rejected token and to nothing else: a 503 while the Partner Portal is
  // down is the case `lib/utils/partnerPortal.js` exists to stop answering with it.
  test.each(Object.keys(ERROR_KINDS).filter(kind => kind !== 'auth'))('a %s failure gains no remedy', async (kind) => {
    const result = await runTool(refused(() => new ToolError(kind, 'SOMETHING', 'it went wrong')), { env: 'staging' }, context());

    expect(result.error.kind).toBe(kind);
    expect(result.error.details).toBeUndefined();
  });
});
