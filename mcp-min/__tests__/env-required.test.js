/**
 * TASK-31: a call that can change an instance has to name it.
 *
 * `resolveAuth`'s fourth step takes whichever entry happens to be first in `.pos` — a file the
 * model has never seen. These drive whole tools through `runTool`, the way both transports do, so
 * what is checked is the policy the invoker derives and not the helper in isolation.
 */
import { describe, test, expect } from 'vitest';
import registry from '../tools.js';
import { runTool } from '../run-tool.js';
import { resolveAuth } from '../auth.js';

const TWO_ENVIRONMENTS = {
  prod: { url: 'https://prod.example.com', email: 'e@x', token: 'prod-token' },
  staging: { url: 'https://staging.example.com', email: 'e@x', token: 'staging-token' }
};

/** Answers anything, so a tool that gets past the guard reaches something rather than hanging. */
const Reaches = class {
  constructor() { return new Proxy(this, { get: () => async () => ({}) }); }
};

const context = (config = TWO_ENVIRONMENTS) => ({
  files: { getConfig: () => config, getAssets: async () => [], getIgnoreList: () => [] },
  settings: { settingsFromDotPos: name => config[name] },
  Gateway: Reaches,
  request: async () => ({ statusCode: 200, body: '{}' })
});

/**
 * Derived, not listed: the guard covers every tool that authenticates and is not `readOnlyHint`,
 * so a tool added later is covered by declaring what it is. The list is discovered by calling each
 * tool and seeing which ones resolve credentials at all — a source scan would miss `job-status`,
 * which reaches `resolveAuth` through `authForJob`.
 */
const callWithNothing = async (name, config = TWO_ENVIRONMENTS) => {
  const env = { ...process.env };
  delete process.env.MPKIT_URL;
  delete process.env.MPKIT_EMAIL;
  delete process.env.MPKIT_TOKEN;
  try {
    return await runTool(registry.get(name), {}, context(config));
  } finally {
    Object.assign(process.env, env);
  }
};

// Kept out of the sweep below, which calls each tool and looks at what came back. These would
// lint, archive or walk the repository if one ever got past the guard, and a test must not depend
// on the thing it is testing to stay harmless. The dangerous ones among them are asserted by name
// further down instead, where the assertion itself proves nothing else ran.
const TOUCHES_THE_TREE = new Set(['check-run', 'generators-list', 'generators-help', 'generators-run', 'data-validate', 'data-import', 'deploy-start', 'deploy-dry-run', 'uploads-push', 'sync-file']);

const CANDIDATES = [...registry.keys()].filter(name => !TOUCHES_THE_TREE.has(name));

describe('the guard covers what it should, derived from the registry', () => {
  test.each(CANDIDATES)('%s', async (name) => {
    const tool = registry.get(name);
    const result = await callWithNothing(name);
    const refused = result.ok === false && result.error.code === 'ENV_REQUIRED';

    // A tool that never authenticates cannot be guarded, and that is not a gap: it reaches no
    // instance to change. What must not happen is a tool that *does* authenticate, *can* change
    // an instance, and still resolves one by position.
    const authenticated = Boolean(result.meta.auth) || refused;
    if (!authenticated) return;

    expect(refused, `${name} resolved an instance by position although it may change one`)
      .toBe(tool.annotations?.readOnlyHint !== true);
  });

  // Without this the assertion above passes for a registry in which nothing is guarded.
  test('the check is not vacuous: some tools are guarded and some are exempt', async () => {
    const results = await Promise.all(CANDIDATES.map(async name => [name, await callWithNothing(name)]));
    const guarded = results.filter(([, r]) => r.ok === false && r.error.code === 'ENV_REQUIRED');
    const exempt = results.filter(([, r]) => r.ok !== false || r.error.code !== 'ENV_REQUIRED').filter(([, r]) => r.meta.auth);

    expect(guarded.length).toBeGreaterThan(3);
    expect(exempt.map(([name]) => name)).toEqual(['logs-fetch', 'migrations-list', 'constants-list']);
  });
});

/**
 * The four that matter most, by name. Each resolves credentials before it reads the working tree
 * (`sync-file` checks its own `filePath` first, so it is given one), which is what makes the guard
 * the thing that stops them — the refusal is proof the archive, the upload and the lint never ran.
 */
describe('the tools that would do the most damage on the wrong instance', () => {
  test.each([
    ['deploy-start', {}],
    ['deploy-dry-run', {}],
    ['data-import', { jsonData: { records: [] } }],
    ['uploads-push', { filePath: 'uploads.zip' }],
    ['sync-file', { filePath: 'app/views/pages/index.liquid' }]
  ])('%s refuses rather than guessing an instance', async (name, params) => {
    const env = { ...process.env };
    delete process.env.MPKIT_URL;
    delete process.env.MPKIT_EMAIL;
    delete process.env.MPKIT_TOKEN;
    try {
      const result = await runTool(registry.get(name), params, context());

      expect(result).toMatchObject({ ok: false, error: { kind: 'input', code: 'ENV_REQUIRED' } });
    } finally {
      Object.assign(process.env, env);
    }
  });
});

describe('what a guarded call answers', () => {
  test('it fails before the instance is asked anything', async () => {
    const calls = [];
    const config = TWO_ENVIRONMENTS;
    const result = await runTool(registry.get('constants-unset'), { name: 'A' }, {
      files: { getConfig: () => config },
      settings: { settingsFromDotPos: name => config[name] },
      Gateway: class { graph(...args) { calls.push(args); return {}; } }
    });

    expect(result).toMatchObject({ ok: false, error: { kind: 'input', code: 'ENV_REQUIRED' } });
    expect(calls, 'the guard has to run before the request, not instead of reporting one').toEqual([]);
  });

  test('naming the environment is all it takes', async () => {
    const result = await runTool(registry.get('constants-list'), { env: 'staging' }, context());

    expect(result.ok).toBe(true);
    expect(result.meta.auth.url).toBe(TWO_ENVIRONMENTS.staging.url);
  });
});

describe('job-status is not caught by this', () => {
  // It is read-only, and authForJob already resolves the ambiguity better: it takes the .pos
  // environment whose origin matches the job's, rather than the one that happens to be first.
  test('it resolves the environment pointing at the job, with two configured', async () => {
    const { mint } = await import('../jobs/handle.js');
    const result = await runTool(registry.get('job-status'), {
      job_id: mint({ kind: 'deploy', id: '41', origin: TWO_ENVIRONMENTS.staging.url, flags: { assets: false } })
    }, { ...context(), pollIntervalMs: 1 });

    expect(result.ok, JSON.stringify(result.error)).toBe(true);
    expect(result.meta.auth.url).toBe(TWO_ENVIRONMENTS.staging.url);
  });
});

describe('the policy belongs to the tool, not to the caller', () => {
  test('a context cannot switch the guard off for a tool that may change an instance', async () => {
    const config = TWO_ENVIRONMENTS;
    const result = await runTool(registry.get('constants-set'), { name: 'A', value: '1' }, {
      ...context(config),
      mayChangeInstance: false
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'ENV_REQUIRED' } });
  });

  // resolveAuth on its own is a helper with no tool in sight; the guard is opt-in there so that
  // lib callers and the CLI are unaffected by a rule about MCP tools.
  test('resolveAuth used directly is unguarded, which is what keeps non-tool callers working', async () => {
    const auth = await resolveAuth({}, { files: { getConfig: () => TWO_ENVIRONMENTS } });

    expect(auth.source).toBe('.pos(prod)');
  });
});
