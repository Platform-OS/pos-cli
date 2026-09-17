/**
 * Which tools a server exposes: (profile ∪ --include-tools) − --exclude-tools − config-disabled,
 * in registry order, with every ambiguous selection refused.
 */
import { describe, test, expect } from 'vitest';
import registry from '../tools.js';
import { resolveTools, selectTools, findTool, describeSelection } from '../tool-selection.js';
import { DEFAULT_PROFILE, PROFILE_NAMES, profileTools } from '../profiles.js';

// A registry small enough to reason about; `full` and `none` are computed from whatever
// registry they are given, so every rule can be checked on it.
const fake = new Map(['a', 'b', 'c', 'd', 'e'].map(name => [name, { description: `tool ${name}`, handler: async () => ({}) }]));
const CONFIG_PATH = '/cfg/tools.config.json';
const noConfig = { tools: {} };

const resolve = (options, { config = noConfig, reg = fake } = {}) =>
  resolveTools({ registry: reg, config, configPath: CONFIG_PATH, ...options });

const names = selection => [...selection.tools.keys()];

// Assert the error type and exact message: a selection refused for the wrong reason is a bug too.
const refusal = (options, context) => {
  try {
    resolve(options, context);
  } catch (err) {
    expect(err.name).toBe('ToolsConfigError');
    return err.message;
  }
  throw new Error(`expected ${JSON.stringify(options)} to be refused`);
};

const PROTOTYPE_NAMES = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'];

// Exactly what pos-cli-mcp exposed before profiles existed (captured from 6.5.1 over stdio).
const PRE_PROFILES_TOOLS = [
  'envs-list', 'logs-fetch', 'liquid-exec', 'graphql-exec', 'generators-list', 'generators-help', 'generators-run',
  'migrations-list', 'migrations-generate', 'migrations-run', 'deploy-start', 'deploy-status', 'deploy-wait',
  'data-import', 'data-import-status', 'data-export', 'data-export-status', 'data-clean', 'data-clean-status',
  'data-validate', 'unit-tests-run', 'tests-run-async', 'tests-run-async-result', 'check-run', 'sync-file',
  'uploads-push', 'constants-list', 'constants-set', 'constants-unset', 'instance-create', 'partners-list',
  'partner-get', 'endpoints-list', 'env-add'
];

const DEV_TOOLS_IN_REGISTRY_ORDER = [
  'envs-list', 'logs-fetch', 'liquid-exec', 'graphql-exec', 'deploy-start', 'deploy-status', 'deploy-wait',
  'unit-tests-run', 'tests-run-async', 'tests-run-async-result', 'check-run'
];

describe('resolveTools', () => {
  test('defaults to the full profile: every tool, in registry order', () => {
    expect(DEFAULT_PROFILE).toBe('full');
    const selection = resolve({});

    expect(names(selection)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(selection).toMatchObject({ profile: 'full', include: [], exclude: [], hidden: [] });
  });

  test('`none` plus --include-tools is an allowlist, listed in registry order rather than flag order', () => {
    expect(names(resolve({ profile: 'none', include: ['d', 'a'] }))).toEqual(['a', 'd']);
  });

  test('--include-tools adds to a profile and --exclude-tools removes from it', () => {
    const selection = resolve({ profile: 'dev', include: ['sync-file'], exclude: ['deploy-wait'] }, { reg: registry });
    const expected = new Set([...DEV_TOOLS_IN_REGISTRY_ORDER, 'sync-file']);
    expected.delete('deploy-wait');

    expect(names(selection)).toEqual([...registry.keys()].filter(name => expected.has(name)));
    expect(names(selection)).toContain('sync-file');
    expect(names(selection)).not.toContain('deploy-wait');
  });

  test('including a tool already in the profile, or excluding one that is not, changes nothing and is allowed', () => {
    expect(names(resolve({ include: ['a'], exclude: [] }))).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(names(resolve({ profile: 'none', include: ['a'], exclude: ['b'] }))).toEqual(['a']);
  });

  test('repeated names within one flag count once', () => {
    const selection = resolve({ profile: 'none', include: ['b', 'a', 'b'], exclude: ['c', 'c'] });

    expect(selection.include).toEqual(['b', 'a']);
    expect(selection.exclude).toEqual(['c']);
    expect(names(selection)).toEqual(['a', 'b']);
  });

  test('the tools config disables tools and replaces descriptions, without touching the registry', () => {
    const config = { tools: { b: { enabled: false }, c: { description: 'configured' }, d: { enabled: true } } };
    const selection = resolve({}, { config });

    expect(names(selection)).toEqual(['a', 'c', 'd', 'e']);
    expect(selection.tools.get('c').description).toBe('configured');
    expect(selection.tools.get('c').handler).toBe(fake.get('c').handler);
    expect(fake.get('c').description).toBe('tool c');
    expect(selection.tools.get('a')).toBe(fake.get('a'));
  });

  test('every tool that is not exposed is reported once, with the first reason that removed it', () => {
    const config = { tools: { a: { enabled: false }, c: { enabled: false } } };

    // Outside the profile, whatever else is true of it.
    const allowlist = resolve({ profile: 'none', include: ['b', 'd'] }, { config });
    expect(names(allowlist)).toEqual(['b', 'd']);
    expect(allowlist.hidden).toEqual([
      { name: 'a', reason: 'profile' },
      { name: 'c', reason: 'profile' },
      { name: 'e', reason: 'profile' }
    ]);

    // Excluded before disabled.
    const trimmed = resolve({ exclude: ['a', 'e'] }, { config });
    expect(names(trimmed)).toEqual(['b', 'd']);
    expect(trimmed.hidden).toEqual([
      { name: 'a', reason: 'excluded' },
      { name: 'c', reason: 'disabled' },
      { name: 'e', reason: 'excluded' }
    ]);
  });

  describe('refuses', () => {
    test.each(['devv', 'Full', '', ...PROTOTYPE_NAMES])('the unknown profile %j', (profile) => {
      expect(refusal({ profile })).toBe(`--profile ${profile}: no such profile. Available profiles: full, dev, none.`);
    });

    test.each(PROTOTYPE_NAMES)('%s as a tool name in either flag', (name) => {
      expect(refusal({ include: [name] })).toBe(`--include-tools: no such tool: ${name}.`);
      expect(refusal({ exclude: [name] })).toBe(`--exclude-tools: no such tool: ${name}.`);
    });

    test('unknown tool names, all of them from both flags in one message, with close matches', () => {
      expect(refusal({ include: ['deploy-strt', 'b', 'zzz'], exclude: ['data-exprt', 'c'] }, { reg: registry })).toBe(
        '--include-tools: no such tool: deploy-strt (did you mean deploy-start?), b, zzz; ' +
        '--exclude-tools: no such tool: data-exprt (did you mean data-export?), c.'
      );
    });

    test('a name in both flags', () => {
      expect(refusal({ include: ['a', 'b', 'c'], exclude: ['c', 'a'] }))
        .toBe('Named in both --include-tools and --exclude-tools: a, c. Name each tool in only one of them.');
    });

    test('including a tool the tools config disables, which would otherwise do nothing', () => {
      const config = { tools: { b: { enabled: false }, d: { enabled: false } } };

      expect(refusal({ include: ['a', 'b', 'd'] }, { config })).toBe(
        `--include-tools names tools disabled in the tools config at ${CONFIG_PATH}: b, d. ` +
        'Enable them there, or remove them from --include-tools.'
      );
      // Only an explicit include is refused; a disabled tool that merely belongs to the profile is hidden.
      expect(names(resolve({}, { config }))).toEqual(['a', 'c', 'e']);
    });

    test.each([
      [{ profile: 'none' }, noConfig, 'profile none with --include-tools (none) and --exclude-tools (none)'],
      [{ exclude: ['a', 'b', 'c', 'd', 'e'] }, noConfig, 'profile full with --include-tools (none) and --exclude-tools a, b, c, d, e'],
      [{}, { tools: Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map(n => [n, { enabled: false }])) }, 'profile full with --include-tools (none) and --exclude-tools (none)']
    ])('an empty result: %j', (options, config, detail) => {
      expect(refusal(options, { config })).toBe(
        `No tools to expose: ${detail} leaves none enabled. Choose another profile or name tools with --include-tools.`
      );
    });

    test('checks in a fixed order: profile, names, overlap, disabled includes, emptiness', () => {
      const config = { tools: { a: { enabled: false } } };

      expect(refusal({ profile: 'x', include: ['zzz', 'a'], exclude: ['a'] }, { config })).toMatch(/^--profile x:/);
      expect(refusal({ include: ['zzz', 'a'], exclude: ['a'] }, { config })).toMatch(/^--include-tools: no such tool: zzz/);
      expect(refusal({ include: ['a'], exclude: ['a'] }, { config })).toMatch(/^Named in both/);
      expect(refusal({ profile: 'none', include: ['a'] }, { config })).toMatch(/^--include-tools names tools disabled/);
    });
  });
});

describe('built-in profiles', () => {
  test('are full, dev and none', () => {
    expect(PROFILE_NAMES).toEqual(['full', 'dev', 'none']);
  });

  test('full is computed from the registry, so a new tool reaches it without an edit', () => {
    const grown = new Map([...fake, ['f', { description: 'new' }]]);

    expect(names(resolve({ profile: 'full' }, { reg: grown }))).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(profileTools('full', grown.keys())).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  test('dev is exactly the documented coding-agent loop, and every member is registered', () => {
    const dev = profileTools('dev', registry.keys());

    expect([...dev].sort()).toEqual([...DEV_TOOLS_IN_REGISTRY_ORDER].sort());
    expect(dev.filter(name => !registry.has(name))).toEqual([]);
    expect(names(selectTools({ profile: 'dev', env: {} }))).toEqual(DEV_TOOLS_IN_REGISTRY_ORDER);
  });

  test('none is empty', () => {
    expect(profileTools('none', registry.keys())).toEqual([]);
  });

  test('bare selection under the bundled config exposes exactly what pos-cli-mcp exposed before profiles', () => {
    const selection = selectTools({ env: {} });

    expect(names(selection)).toEqual(PRE_PROFILES_TOOLS);
    expect(selection.hidden).toEqual([{ name: 'check', reason: 'disabled' }]);
    expect(selection.configFile.source).toBe('bundled');
  });

  test('a profile list is copied, so a caller cannot change the profile for the next one', () => {
    profileTools('dev', registry.keys()).push('sync-file');

    expect(profileTools('dev', registry.keys())).not.toContain('sync-file');
  });
});

// A description that tells the model to use a tool it cannot see sends it after a tool that
// does not exist. Checked on everything tools/list publishes for a tool: its description and
// its schema's text.
describe('descriptions only name tools exposed alongside them', () => {
  // A hyphenated tool name cannot be an ordinary word, so a match is a reference. A single-word
  // name can: "the directory to check" is not a reference to the disabled `check` tool.
  const referable = [...registry.keys()].filter(name => name.includes('-'));
  const mentions = (text, self) => referable.filter(
    name => name !== self && new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(text)
  );

  test('the only registered tool name that is an ordinary word is check', () => {
    expect([...registry.keys()].filter(name => !name.includes('-'))).toEqual(['check']);
  });

  test('the reference finder sees a tool name, but not a longer name that contains it', () => {
    expect(mentions('Use tests-run-async-result to poll.', 'x')).toEqual(['tests-run-async-result']);
    expect(mentions('Start with tests-run-async.', 'x')).toEqual(['tests-run-async']);
    expect(mentions('see data-export-status', 'x')).toEqual(['data-export-status']);
  });

  test.each(PROFILE_NAMES.filter(profile => profileTools(profile, registry.keys()).length > 0))(
    'in the %s profile',
    (profile) => {
      const { tools } = selectTools({ profile, env: {} });
      const dangling = [...tools]
        .flatMap(([name, tool]) => mentions(JSON.stringify({ description: tool.description, inputSchema: tool.inputSchema }), name)
          .filter(mentioned => !tools.has(mentioned))
          .map(mentioned => `${name} → ${mentioned}`));

      expect(dangling).toEqual([]);
    }
  );
});

describe('findTool', () => {
  const { tools } = selectTools({ profile: 'none', include: ['envs-list'], env: {} });

  test('finds an exposed tool', () => {
    expect(findTool(tools, 'envs-list')).toBe(tools.get('envs-list'));
  });

  test.each([
    ['a registered tool that is not exposed', 'deploy-start'],
    ['a tool the config disables', 'check'],
    ...PROTOTYPE_NAMES.map(name => [`the inherited name ${name}`, name]),
    ['undefined', undefined],
    ['null', null],
    ['a number', 1],
    ['an array holding a tool name', ['envs-list']],
    ['an object', { toString: () => 'envs-list' }]
  ])('finds nothing for %s', (_label, name) => {
    expect(findTool(tools, name)).toBeUndefined();
  });
});

test('describeSelection names what was exposed and why', () => {
  expect(describeSelection(selectTools({ profile: 'dev', include: ['sync-file'], exclude: ['deploy-wait'], env: {} })))
    .toBe(`mcp-min: exposing 11 of ${registry.size} tools (profile dev; --include-tools sync-file; --exclude-tools deploy-wait)`);
  expect(describeSelection(selectTools({ env: {} })))
    .toBe(`mcp-min: exposing 34 of ${registry.size} tools (profile full; --include-tools (none); --exclude-tools (none))`);
});
