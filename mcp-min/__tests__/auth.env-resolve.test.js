import fs from 'fs';
import os from 'os';
import path from 'path';
import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

import { fetchSettings } from '../../lib/settings.js';
import { resolveAuth } from '../auth.js';

// Regression guard for the "env not found kills the MCP server" crash.
//
// The server resolves auth via resolveAuth -> fetchSettings. Historically
// fetchSettings did process.exit(1) on an unknown environment, which killed
// the whole in-process server before auth.js could throw its catchable error.
// The fix: fetchSettings(env, { exit:false }) returns null so resolveAuth can
// throw a normal Error the per-request handler turns into an MCP error.
// Not in the repository root: test files run in parallel, and a config there changes what other
// files see (see mcp-min/__tests__/helpers/dot-pos.js).
const CONFIG_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-auth-resolve-')), '.pos');

describe('env resolution never exits the process', () => {
  beforeAll(() => {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify({ staging: { url: 'https://staging.example.com', email: 'e@x', token: 't' } }, null, 2)
    );
    process.env.CONFIG_FILE_PATH = CONFIG_FILE;
  });

  afterAll(() => {
    fs.rmSync(path.dirname(CONFIG_FILE), { recursive: true, force: true });
    delete process.env.CONFIG_FILE_PATH;
  });

  beforeEach(() => {
    // MPKIT_* would short-circuit settingsFromEnv(); keep resolution on .pos.
    delete process.env.MPKIT_URL;
    delete process.env.MPKIT_EMAIL;
    delete process.env.MPKIT_TOKEN;
  });

  test('fetchSettings(unknown, {exit:false}) returns null instead of exiting', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit must not be called with {exit:false}');
    });

    const found = await fetchSettings('does-not-exist', { exit: false });
    expect(found).toBeNull();
    expect(exitSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  test('fetchSettings(known, {exit:false}) returns the settings', async () => {
    const found = await fetchSettings('staging', { exit: false });
    expect(found).toMatchObject({ url: 'https://staging.example.com' });
  });

  test('resolveAuth throws a catchable error for an unknown env (no exit)', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit must not be called from resolveAuth');
    });

    await expect(resolveAuth({ env: 'ps' })).rejects.toThrow(/Environment 'ps' not found/);
    expect(exitSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  test('resolveAuth resolves a known env from .pos', async () => {
    const auth = await resolveAuth({ env: 'staging' });
    expect(auth).toMatchObject({ url: 'https://staging.example.com', source: '.pos(staging)' });
  });

  test('explicit url/email/token params bypass .pos resolution', async () => {
    const auth = await resolveAuth({ url: 'https://direct', email: 'e@x', token: 'tok' });
    expect(auth).toMatchObject({ url: 'https://direct', source: 'params' });
  });
});

/**
 * The precedence itself.
 *
 * Every step was documented in the wrong order twice — in `auth.js`'s own JSDoc and in
 * docs/MCP_TOOLS.md — because nothing here distinguished them: the existing tests each offer one
 * source, and any order resolves those the same way. These offer all four at once, which is the
 * only arrangement that can tell the orders apart, and then check the comment against what the
 * function did.
 */
describe('resolveAuth precedence', () => {
  const PARAMS = { url: 'https://params.example.com', email: 'params@example.com', token: 'params-token' };
  const NAMED = { url: 'https://named.example.com', email: 'named@example.com', token: 'named-token' };
  const MPKIT = { url: 'https://mpkit.example.com', email: 'mpkit@example.com', token: 'mpkit-token' };
  const FIRST = { url: 'https://first.example.com', email: 'first@example.com', token: 'first-token' };
  const SECOND = { url: 'https://second.example.com', email: 'second@example.com', token: 'second-token' };

  // Every source available at once. A step is removed by dropping its input, never by changing
  // the others, so each case differs from the one before it by exactly one thing.
  const ctx = {
    settings: {
      settingsFromDotPos: (name) => {
        if (name === 'named') return { ...NAMED };
        // An entry with no credentials in it: present in .pos, but nothing to authenticate with.
        return name === 'hollow' ? {} : undefined;
      }
    },
    files: { getConfig: () => ({ first: { ...FIRST }, second: { ...SECOND } }) }
  };

  beforeEach(() => {
    vi.stubEnv('MPKIT_URL', MPKIT.url);
    vi.stubEnv('MPKIT_EMAIL', MPKIT.email);
    vi.stubEnv('MPKIT_TOKEN', MPKIT.token);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const withoutMpkit = () => {
    vi.stubEnv('MPKIT_URL', '');
    vi.stubEnv('MPKIT_EMAIL', '');
    vi.stubEnv('MPKIT_TOKEN', '');
  };

  test('1. explicit params win over everything else', async () => {
    const auth = await resolveAuth({ ...PARAMS, env: 'named' }, ctx);

    expect(auth).toMatchObject({ url: PARAMS.url, token: PARAMS.token, source: 'params' });
  });

  test('2. a named environment beats MPKIT_* and the first .pos entry', async () => {
    const auth = await resolveAuth({ env: 'named' }, ctx);

    expect(auth).toMatchObject({ url: NAMED.url, token: NAMED.token, source: '.pos(named)' });
  });

  test('3. MPKIT_* beats the first .pos entry when no environment is named', async () => {
    const auth = await resolveAuth({}, ctx);

    expect(auth).toMatchObject({ url: MPKIT.url, token: MPKIT.token, source: 'env' });
  });

  test('4. the first .pos entry is the last resort, and it is the first one in the file', async () => {
    withoutMpkit();

    const auth = await resolveAuth({}, ctx);

    expect(auth).toMatchObject({ url: FIRST.url, token: FIRST.token, source: '.pos(first)' });
  });

  test('nothing at all is an error naming both ways to fix it', async () => {
    withoutMpkit();

    await expect(resolveAuth({}, { ...ctx, files: { getConfig: () => ({}) } }))
      .rejects.toThrow(/AUTH_MISSING.*url,email,token.*MPKIT/s);
  });

  // The rule the wrong comment hid: naming an environment settles which instance is meant, so a
  // missing name fails rather than quietly resolving to whatever MPKIT_* happens to point at —
  // which on a developer machine is often a different instance entirely.
  test('a named environment that is not in .pos fails instead of falling back to MPKIT_*', async () => {
    await expect(resolveAuth({ env: 'missing' }, ctx)).rejects.toThrow(/Environment 'missing' not found/);
  });

  // Two of the three named an instance and would then have resolved a different one from .pos,
  // so the call would have gone somewhere the caller did not ask for.
  test('explicit params need all three parts, and a partial set is refused rather than ignored', async () => {
    await expect(resolveAuth({ url: PARAMS.url, token: PARAMS.token }, ctx))
      .rejects.toThrow(/need url, email and token together; missing: email/);
  });

  test.each([
    ['an entry with no credentials in it', 'hollow'],
    ['an entry that is not there', 'missing']
  ])('%s is an error, not something to authenticate with', async (_label, name) => {
    await expect(resolveAuth({ env: name }, ctx)).rejects.toThrow(/Environment '.+' (in \.pos has no url and token|not found)/);
  });

  test('MPKIT_* needs all three too; two of them fall through to .pos', async () => {
    vi.stubEnv('MPKIT_EMAIL', '');

    const auth = await resolveAuth({}, ctx);

    expect(auth).toMatchObject({ url: FIRST.url, source: '.pos(first)' });
  });
});

describe('the documented precedence is the implemented one', () => {
  // This is the drift guard, and it covers every place the order is written down: the same
  // mistake lived in auth.js's JSDoc and docs/MCP_TOOLS.md at once, so asserting behaviour alone
  // would not have caught it, and correcting one copy has already failed to correct the others.
  const REPO = path.resolve(import.meta.dirname, '../..');

  // Matched on the one word that distinguishes each step, because the three copies word them
  // differently on purpose — a reference, a JSDoc list and a user-facing section.
  const STEP_PATTERNS = [
    [/explicit/i, 'params'],
    [/named/i, '.pos(named)'],
    [/mpkit/i, 'env'],
    [/first/i, '.pos(first)']
  ];

  const RESOLUTION_ORDER = ['params', '.pos(named)', 'env', '.pos(first)'];

  // Where each copy lives: the file, the text the list follows, and how a numbered line looks.
  const DOCUMENTED = [
    ['mcp-min/auth.js', 'Resolve authentication from params', /^\s*\*\s*(\d)\.\s*(.+)$/gm],
    ['docs/MCP_TOOLS.md', '### Authentication Precedence', /^(\d)\.\s*(.+)$/gm],
    ['CLAUDE.md', 'resolves credentials in this order', /^(\d)\.\s*(.+)$/gm]
  ];

  test.each(DOCUMENTED)('%s lists the order resolveAuth resolves in', (file, after, pattern) => {
    const source = fs.readFileSync(path.join(REPO, file), 'utf8');
    const index = source.indexOf(after);
    expect(index, `${file} no longer contains "${after}"`).toBeGreaterThan(-1);

    const numbered = [...source.slice(index).matchAll(pattern)];
    const documented = numbered.slice(0, 4).map(([, step, text]) => ({ step: Number(step), text: text.trim() }));

    expect(documented.map(({ step }) => step), `${file} should number four steps 1-4`).toEqual([1, 2, 3, 4]);

    // Each line must be recognisable, or the mapping above needs updating along with it.
    const order = documented.map(({ text }) => {
      const match = STEP_PATTERNS.find(([regex]) => regex.test(text));
      expect(match, `"${text}" in ${file} matches none of the known steps`).toBeDefined();
      return match[1];
    });

    expect(order, `${file} documents a different order from the one resolveAuth implements`).toEqual(RESOLUTION_ORDER);
  });

  // The order above is not a constant copied from the source: it is what the tests in the
  // previous block observed the function doing, step by step.
  test('the order checked against the documents is the observed one', async () => {
    const ctx = {
      settings: { settingsFromDotPos: (name) => (name === 'named' ? { url: 'https://named.example.com', token: 'named-token' } : undefined) },
      files: { getConfig: () => ({ first: { url: 'https://first.example.com', token: 'first-token' } }) }
    };
    vi.stubEnv('MPKIT_URL', 'https://mpkit.example.com');
    vi.stubEnv('MPKIT_EMAIL', 'mpkit@example.com');
    vi.stubEnv('MPKIT_TOKEN', 'mpkit-token');
    try {
      const observed = [
        (await resolveAuth({ url: 'https://p', email: 'p@x', token: 't', env: 'named' }, ctx)).source,
        (await resolveAuth({ env: 'named' }, ctx)).source,
        (await resolveAuth({}, ctx)).source
      ];
      vi.stubEnv('MPKIT_URL', '');
      observed.push((await resolveAuth({}, ctx)).source);

      expect(observed).toEqual(RESOLUTION_ORDER);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

/**
 * The named environment, against the real `.pos` reader.
 *
 * The block above injects the settings seam, which is how the precedence was documented as
 * working and not how it worked: `resolveAuth` called the CLI's `fetchSettings`, and that answers
 * from `MPKIT_*` before it looks at `.pos`. So an MCP client naming an environment was given
 * whatever those variables pointed at — while `source` still named the environment it asked for —
 * and an environment that did not exist resolved instead of failing. These cases use the real
 * modules, with both sources present, because that is the only way to catch it.
 */
describe('a named environment is read from .pos, whatever MPKIT_* says', () => {
  const DOT_POS = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-auth-precedence-')), '.pos');
  const CONFIGURED = {
    staging: { url: 'https://staging.example.com/', email: 'staging@example.com', token: 'staging-token' },
    production: { url: 'https://production.example.com/', email: 'prod@example.com', token: 'prod-token' }
  };

  beforeAll(() => {
    fs.writeFileSync(DOT_POS, JSON.stringify(CONFIGURED, null, 2));
  });

  afterAll(() => {
    fs.rmSync(path.dirname(DOT_POS), { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.stubEnv('CONFIG_FILE_PATH', DOT_POS);
    vi.stubEnv('MPKIT_URL', 'https://mpkit.example.com');
    vi.stubEnv('MPKIT_EMAIL', 'mpkit@example.com');
    vi.stubEnv('MPKIT_TOKEN', 'mpkit-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test.each(['staging', 'production'])('%s resolves to itself, not to the environment variables', async (name) => {
    const auth = await resolveAuth({ env: name });

    expect(auth.url).toBe(CONFIGURED[name].url);
    expect(auth.token).toBe(CONFIGURED[name].token);
    expect(auth.source).toBe(`.pos(${name})`);
  });

  // The label is what every tool echoes in `meta.auth`, so a wrong one does not just mislead a
  // reader — it is the only record of where a deploy or an import actually went.
  test('the source names the instance the credentials belong to', async () => {
    const auth = await resolveAuth({ env: 'production' });

    expect(auth).toMatchObject({ url: CONFIGURED.production.url, token: CONFIGURED.production.token, source: '.pos(production)' });
  });

  test('an environment that is not in .pos fails instead of quietly using MPKIT_*', async () => {
    await expect(resolveAuth({ env: 'does-not-exist' })).rejects.toThrow(/Environment 'does-not-exist' not found/);
  });

  // The name comes from a model, so it can be anything at all.
  test.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'an environment named %s resolves nothing',
    async (name) => {
      await expect(resolveAuth({ env: name })).rejects.toThrow(`Environment '${name}' not found`);
    }
  );

  test('with no environment named, MPKIT_* is still what answers', async () => {
    const auth = await resolveAuth({});

    expect(auth).toMatchObject({ url: 'https://mpkit.example.com', source: 'env' });
  });

  // The CLI resolves the other way round on purpose: CI exports MPKIT_* and still names an
  // environment on the command line. Changing that would redirect those runs to .pos.
  test('the CLI resolver is deliberately the other way round, and stays that way', async () => {
    const fromCli = await fetchSettings('production', { exit: false });

    expect(fromCli).toMatchObject({ url: 'https://mpkit.example.com' });
  });
});
