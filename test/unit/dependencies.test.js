import { resolveDependencies, findModuleVersion } from '#lib/modules/dependencies';
import { mod, makeRegistry } from '#test/utils/moduleRegistry.js';

// spyRegistry wraps makeRegistry to record every batch of names requested,
// enabling assertions about how many registry fetches were made (memoisation tests).
const spyRegistry = (...modules) => {
  const inner = makeRegistry(...modules);
  const calls = [];
  const fn = async (names) => { calls.push([...names]); return inner(names); };
  fn.calls = calls;
  return fn;
};

// ---------------------------------------------------------------------------
// resolveDependencies — happy paths
// ---------------------------------------------------------------------------

test('resolves a simple two-level dependency chain', async () => {
  const core = mod('core', { '1.0.0': {}, '1.2.0': {} });
  const app  = mod('app',  { '1.0.0': { core: '^1.0.0' } });

  const data = await resolveDependencies({ app: '1.0.0' }, makeRegistry(app, core));

  expect(data).toEqual({ app: '1.0.0', core: '1.2.0' });
});

test('resolves diamond dependency — all constraints from all levels satisfied simultaneously', async () => {
  // payments_stripe and tests both need core (different lower bounds).
  // payments@1.0.0 pins core to exactly 1.6.0 — that must win for everyone.
  const core            = mod('core',           { '1.0.0': {}, '1.5.0': {}, '1.6.0': {}, '1.8.0': {} });
  const payments        = mod('payments',        { '1.0.0': { core: '1.6.0' } });
  const payments_stripe = mod('payments_stripe', { '1.0.6': { payments: '^1.0.0', core: '^1.0.0' } });
  const tests           = mod('tests',           { '1.0.7': { core: '^1.5.0' } });
  const a               = mod('a',               { '1.0.0': { b: '1.0.0' } });
  const b               = mod('b',               { '1.0.0': { c: '1.0.0' } });
  const c               = mod('c',               { '1.0.0': {} });

  const data = await resolveDependencies(
    { payments_stripe: '1.0.6', tests: '1.0.7', a: '1.0.0' },
    makeRegistry(payments_stripe, tests, a, payments, core, b, c)
  );

  expect(data).toEqual({
    payments_stripe: '1.0.6', tests: '1.0.7', a: '1.0.0',
    payments: '1.0.0', core: '1.6.0', b: '1.0.0', c: '1.0.0'
  });
});

test('picks the highest version satisfying all constraints when multiple modules require the same dep', async () => {
  const core    = mod('core',     { '1.5.0': {}, '1.6.0': {}, '1.8.0': {} });
  const moduleA = mod('module-a', { '1.0.0': { core: '^1.5.0' } });
  const moduleB = mod('module-b', { '1.0.0': { core: '^1.6.0' } });

  const data = await resolveDependencies(
    { 'module-a': '1.0.0', 'module-b': '1.0.0' },
    makeRegistry(moduleA, moduleB, core)
  );

  expect(data['core']).toBe('1.8.0');
});

test('respects a root-pinned version that satisfies all transitive constraints', async () => {
  // root pins core@1.6.1; tests requires ^1.6.0 — 1.6.1 satisfies it, keep the pin
  const core  = mod('core',  { '1.6.0': {}, '1.6.1': {}, '1.8.0': {} });
  const tests = mod('tests', { '1.0.7': { core: '^1.6.0' } });

  const data = await resolveDependencies({ tests: '1.0.7', core: '1.6.1' }, makeRegistry(tests, core));

  expect(data).toEqual({ tests: '1.0.7', core: '1.6.1' });
});

test('resolves a deep transitive chain (4 levels)', async () => {
  const d = mod('d', { '1.0.0': {} });
  const c = mod('c', { '1.0.0': { d: '1.0.0' } });
  const b = mod('b', { '1.0.0': { c: '1.0.0' } });
  const a = mod('a', { '1.0.0': { b: '1.0.0' } });

  const data = await resolveDependencies({ a: '1.0.0' }, makeRegistry(a, b, c, d));

  expect(data).toEqual({ a: '1.0.0', b: '1.0.0', c: '1.0.0', d: '1.0.0' });
});

test('resolves nothing extra when root module has no dependencies', async () => {
  const leaf = mod('leaf', { '1.0.0': {} });

  const data = await resolveDependencies({ leaf: '1.0.0' }, makeRegistry(leaf));

  expect(data).toEqual({ leaf: '1.0.0' });
});

test('returns empty object for empty input', async () => {
  expect(await resolveDependencies({}, makeRegistry())).toEqual({});
});

// ---------------------------------------------------------------------------
// resolveDependencies — BFS global constraint resolution
// (cases the old level-by-level recursive approach could not handle correctly)
// ---------------------------------------------------------------------------

test('detects conflict between constraints at different levels of the tree', async () => {
  // A requires D@^1.5.0 directly AND B@^1.0.0 which requires D@1.3.0 (exact).
  // The two constraints on D have no intersection → error.
  const d = mod('d', { '1.3.0': {}, '1.5.0': {}, '1.8.0': {} });
  const b = mod('b', { '1.5.0': { d: '1.3.0' } });
  const a = mod('a', { '1.0.0': { b: '^1.0.0', d: '^1.5.0' } });

  await expect(
    resolveDependencies({ a: '1.0.0' }, makeRegistry(a, b, d))
  ).rejects.toThrow(/No version of "d" satisfies all constraints/);
});

test('downgrades a transitive dep when a later-discovered constraint narrows the range', async () => {
  // A requires D@^1.2.0 → initially resolves to 1.8.0 (highest satisfying).
  // B@1.5.0 (dep of A) then requires D@>=1.4.0 <1.8.0.
  // Combined constraints eliminate 1.8.0 → 1.7.0 is the correct answer.
  const d = mod('d', { '1.2.0': {}, '1.4.0': {}, '1.7.0': {}, '1.8.0': {} });
  const b = mod('b', { '1.5.0': { d: '>=1.4.0 <1.8.0' } });
  const a = mod('a', { '1.0.0': { b: '^1.0.0', d: '^1.2.0' } });

  const data = await resolveDependencies({ a: '1.0.0' }, makeRegistry(a, b, d));

  expect(data['d']).toBe('1.7.0');
});

test('cleans up stale constraints after a version downgrade', async () => {
  // D@1.8.0 requires E@^2.0.0.  D@1.7.0 requires E@^1.0.0.
  // The algorithm initially resolves D to 1.8.0, then B's constraint (>=1.4.0 <1.8.0)
  // forces a downgrade to 1.7.0.  Without stale-constraint cleanup, the constraints
  // map would contain both {^2.0.0 from D@1.8.0} and {^1.0.0 from D@1.7.0} for E —
  // these ranges don't intersect → false "no satisfying version" error.
  // With cleanup, only {^1.0.0 from D@1.7.0} remains → E@1.0.0.
  const e = mod('e', { '1.0.0': {}, '2.0.0': {} });
  const d = mod('d', { '1.4.0': {}, '1.7.0': { e: '^1.0.0' }, '1.8.0': { e: '^2.0.0' } });
  const b = mod('b', { '1.5.0': { d: '>=1.4.0 <1.8.0' } });
  const a = mod('a', { '1.0.0': { b: '^1.0.0', d: '^1.4.0' } });

  const data = await resolveDependencies({ a: '1.0.0' }, makeRegistry(a, b, d, e));

  expect(data['d']).toBe('1.7.0');
  expect(data['e']).toBe('1.0.0');
});

test('does not install a phantom dep when its only requiring version is downgraded away (same round)', async () => {
  // D@1.8.0 requires E, but D gets downgraded to 1.0.0 which has no E dependency.
  // The downgrade and E's tentative resolution happen in the same BFS round —
  // the three-pass Phase 2 ordering must prevent E from being committed.
  const e = mod('e', { '1.0.0': {} });
  const d = mod('d', { '1.0.0': {}, '1.8.0': { e: '^1.0.0' } });
  const b = mod('b', { '1.5.0': { d: '<1.5.0' } });
  const a = mod('a', { '1.0.0': { b: '^1.0.0', d: '^1.0.0' } });

  const data = await resolveDependencies({ a: '1.0.0' }, makeRegistry(a, b, d, e));

  expect(data['d']).toBe('1.0.0');
  expect(data['e']).toBeUndefined();
});

test('does not install a phantom dep committed in an earlier round when its requirer is later downgraded', async () => {
  // Multi-round phantom dep: E is resolved and committed in round 2 (as D@1.8.0's dep),
  // but the narrowing constraint that forces D to downgrade arrives only in round 3
  // (via C → F → D@<1.5.0). After the downgrade, D@1.0.0 has no E dep, so E is
  // unreachable from root. The post-BFS reachability walk must remove it.
  const e = mod('e', { '1.0.0': {} });
  const d = mod('d', { '1.0.0': {}, '1.8.0': { e: '^1.0.0' } });
  const f = mod('f', { '1.0.0': { d: '<1.5.0' } });
  const c = mod('c', { '1.0.0': { f: '^1.0.0' } });
  const a = mod('a', { '1.0.0': { d: '^1.0.0', c: '^1.0.0' } });

  const data = await resolveDependencies({ a: '1.0.0' }, makeRegistry(a, c, d, e, f));

  expect(data['d']).toBe('1.0.0');
  expect(data['e']).toBeUndefined();
});

test('combines compatible constraints across all levels to pick the tightest satisfying version', async () => {
  // Three modules at different levels each put a lower bound on core.
  // All three must be satisfied simultaneously → pick the highest.
  const core    = mod('core',     { '1.0.0': {}, '1.4.0': {}, '1.6.0': {}, '1.9.0': {} });
  const moduleA = mod('module-a', { '1.0.0': { core: '^1.0.0' } });
  const moduleB = mod('module-b', { '1.0.0': { core: '^1.4.0' } });
  const moduleC = mod('module-c', { '1.0.0': { core: '^1.6.0' } });

  const data = await resolveDependencies(
    { 'module-a': '1.0.0', 'module-b': '1.0.0', 'module-c': '1.0.0' },
    makeRegistry(moduleA, moduleB, moduleC, core)
  );

  expect(data['core']).toBe('1.9.0');
});

// ---------------------------------------------------------------------------
// resolveDependencies — pre-release version handling
// ---------------------------------------------------------------------------

test('does not select a pre-release version to satisfy a range constraint', async () => {
  // ^1.0.0 must not match 1.5.0-beta.1 even though it is numerically greater than 1.0.0.
  // This matches standard npm behaviour: pre-releases are excluded from range matching.
  const dep = mod('dep', { '1.0.0': {}, '1.5.0-beta.1': {} });
  const app = mod('app', { '1.0.0': { dep: '^1.0.0' } });

  const data = await resolveDependencies({ app: '1.0.0' }, makeRegistry(app, dep));

  expect(data['dep']).toBe('1.0.0');
});

test('resolves a pre-release version when it is pinned explicitly as a transitive dep', async () => {
  // When a module explicitly names an exact pre-release, it should be installed.
  const dep = mod('dep', { '0.9.0': {}, '1.0.0-beta.1': {} });
  const app = mod('app', { '1.0.0': { dep: '1.0.0-beta.1' } });

  const data = await resolveDependencies({ app: '1.0.0' }, makeRegistry(app, dep));

  expect(data['dep']).toBe('1.0.0-beta.1');
});

// ---------------------------------------------------------------------------
// resolveDependencies — circular dependency guard
// ---------------------------------------------------------------------------

test('handles a two-module circular dependency without infinite recursion', async () => {
  const a = mod('a', { '1.0.0': { b: '1.0.0' } });
  const b = mod('b', { '1.0.0': { a: '1.0.0' } });

  const data = await resolveDependencies({ a: '1.0.0' }, makeRegistry(a, b));

  expect(data).toEqual({ a: '1.0.0', b: '1.0.0' });
});

test('handles a three-module circular dependency without infinite recursion', async () => {
  const a = mod('a', { '1.0.0': { b: '1.0.0' } });
  const b = mod('b', { '1.0.0': { c: '1.0.0' } });
  const c = mod('c', { '1.0.0': { a: '1.0.0' } });

  const data = await resolveDependencies({ a: '1.0.0' }, makeRegistry(a, b, c));

  expect(data).toEqual({ a: '1.0.0', b: '1.0.0', c: '1.0.0' });
});

// ---------------------------------------------------------------------------
// resolveDependencies — version conflict errors
// ---------------------------------------------------------------------------

test('throws when a root-pinned version conflicts with a transitive constraint', async () => {
  // community requires core ^2.0.0 but root pins core@1.5.5
  const core      = mod('core',      { '1.5.5': {}, '2.0.0': {}, '2.0.6': {} });
  const community = mod('community', { '1.3.8': { core: '^2.0.0' } });

  await expect(
    resolveDependencies({ community: '1.3.8', core: '1.5.5' }, makeRegistry(community, core))
  ).rejects.toThrow(/Version conflict.*core@1\.5\.5.*\^2\.0\.0.*community@1\.3\.8/);
});

test('throws when two transitive dependencies require mutually incompatible versions', async () => {
  const core    = mod('core',     { '1.5.5': {}, '2.0.0': {} });
  const moduleA = mod('module-a', { '1.0.0': { core: '^2.0.0' } });
  const moduleB = mod('module-b', { '1.0.0': { core: '1.5.5'  } });

  await expect(
    resolveDependencies({ 'module-a': '1.0.0', 'module-b': '1.0.0' }, makeRegistry(moduleA, moduleB, core))
  ).rejects.toThrow(/No version of "core" satisfies all constraints/);
});

test('error message names every module that contributed a conflicting constraint', async () => {
  const core    = mod('core',     { '1.0.0': {}, '2.0.0': {} });
  const moduleA = mod('module-a', { '1.0.0': { core: '^2.0.0' } });
  const moduleB = mod('module-b', { '1.0.0': { core: '1.0.0'  } });

  await expect(
    resolveDependencies({ 'module-a': '1.0.0', 'module-b': '1.0.0' }, makeRegistry(moduleA, moduleB, core))
  ).rejects.toThrow(/module-a@1\.0\.0.*module-b@1\.0\.0|module-b@1\.0\.0.*module-a@1\.0\.0/);
});

test('annotates root modules in conflict error and appends a hint', async () => {
  // Both module-a and module-b are root modules; their conflicting core constraints
  // should be labelled "root module" and a hint listing both should appear.
  const core    = mod('core',     { '1.0.0': {}, '2.0.0': {} });
  const moduleA = mod('module-a', { '1.0.0': { core: '^2.0.0' } });
  const moduleB = mod('module-b', { '1.0.0': { core: '1.0.0'  } });

  const err = await resolveDependencies(
    { 'module-a': '1.0.0', 'module-b': '1.0.0' }, makeRegistry(moduleA, moduleB, core)
  ).catch(e => e);

  expect(err.message).toMatch(/root module/);
  expect(err.message).toMatch(/Conflicting root modules:/);
  expect(err.message).toMatch(/module-a/);
  expect(err.message).toMatch(/module-b/);
  expect(err.message).toMatch(/Try updating them one at a time/);
});

test('does not add root module hint when the conflict involves only transitive deps', async () => {
  // a is the single root; b and c are transitive deps that conflict on d.
  // Only one root module is involved (a), so no hint should appear.
  const d = mod('d', { '1.0.0': {}, '2.0.0': {} });
  const b = mod('b', { '1.0.0': { d: '^2.0.0' } });
  const c = mod('c', { '1.0.0': { d: '1.0.0'  } });
  const a = mod('a', { '1.0.0': { b: '^1.0.0', c: '^1.0.0' } });

  const err = await resolveDependencies(
    { a: '1.0.0' }, makeRegistry(a, b, c, d)
  ).catch(e => e);

  expect(err.message).toMatch(/No version of "d" satisfies all constraints/);
  expect(err.message).not.toMatch(/Conflicting root modules/);
});

test('throws when a required module is absent from the registry', async () => {
  const app = mod('app', { '1.0.0': { core: '^1.0.0' } });

  await expect(
    resolveDependencies({ app: '1.0.0' }, makeRegistry(app /* core missing */))
  ).rejects.toThrow(/Module "core" not found in the registry/);
});

test('throws when the requested module version does not exist in the registry', async () => {
  const app = mod('app', { '1.0.0': {} });

  await expect(
    resolveDependencies({ app: '9.9.9' }, makeRegistry(app))
  ).rejects.toThrow(/Version "9\.9\.9" not found for module "app"/);
});

test('throws when a dependency exists in the registry but has no published versions', async () => {
  const app  = mod('app',  { '1.0.0': { core: '^1.0.0' } });
  const core = mod('core', {});  // registered but no versions published yet

  await expect(
    resolveDependencies({ app: '1.0.0' }, makeRegistry(app, core))
  ).rejects.toThrow(/Module "core" has no published versions/);
});

test('handles a module version whose registry entry has no dependencies field', async () => {
  // Some older registry entries may omit the dependencies key entirely.
  // The resolver must treat that as an empty dependency list, not throw a TypeError.
  const registry = async () => [
    { module: 'app', versions: { '1.0.0': { /* no dependencies key */ } } }
  ];

  const data = await resolveDependencies({ app: '1.0.0' }, registry);

  expect(data).toEqual({ app: '1.0.0' });
});

// ---------------------------------------------------------------------------
// resolveDependencies — memoisation: no redundant registry fetches
// ---------------------------------------------------------------------------

test('fetches each module from the registry at most once per resolution run', async () => {
  // core appears as a dep of both tests and payments — it must be fetched only once
  const core     = mod('core',     { '1.6.0': {}, '1.8.0': {} });
  const tests    = mod('tests',    { '1.0.0': { core: '^1.6.0' } });
  const payments = mod('payments', { '1.0.0': { core: '^1.0.0' } });
  const registry = spyRegistry(tests, payments, core);

  await resolveDependencies({ tests: '1.0.0', payments: '1.0.0' }, registry);

  const allFetched = registry.calls.flat();
  expect(allFetched.filter(n => n === 'core')).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// findModuleVersion
// ---------------------------------------------------------------------------

test('returns the highest stable version when no version is specified', async () => {
  const core = mod('core', { '1.0.0': {}, '1.5.0': {} });

  expect(await findModuleVersion('core', null, makeRegistry(core))).toEqual({ core: '1.5.0' });
});

test('excludes pre-release versions from automatic resolution', async () => {
  const core = mod('core', { '1.0.0': {}, '1.5.0': {}, '1.5.1-beta.1': {} });

  expect(await findModuleVersion('core', null, makeRegistry(core))).toEqual({ core: '1.5.0' });
});

test('returns null when all available versions are pre-release and none is requested explicitly', async () => {
  // The module exists but has no stable release yet
  const core = mod('core', { '1.0.0-alpha.1': {}, '1.0.0-beta.1': {} });

  expect(await findModuleVersion('core', null, makeRegistry(core))).toBeNull();
});

test('returns the exact version when explicitly requested', async () => {
  const core = mod('core', { '1.0.0': {}, '1.5.0': {} });

  expect(await findModuleVersion('core', '1.0.0', makeRegistry(core))).toEqual({ core: '1.0.0' });
});

test('returns a pre-release version when explicitly requested', async () => {
  const core = mod('core', { '1.0.0-beta.1': {}, '1.5.0': {} });

  expect(await findModuleVersion('core', '1.0.0-beta.1', makeRegistry(core))).toEqual({ core: '1.0.0-beta.1' });
});

test('returns null when the requested version does not exist', async () => {
  const core = mod('core', { '1.0.0': {}, '1.5.0': {} });

  expect(await findModuleVersion('core', '1.0.1', makeRegistry(core))).toBeNull();
});

test('throws when the module itself is not found in the registry', async () => {
  await expect(
    findModuleVersion('nonexistent', null, makeRegistry())
  ).rejects.toThrow(/Can't find module nonexistent/);
});

test('returns null when the requested version is a semver range rather than an exact version', async () => {
  // Users occasionally pass ranges (e.g. "^1.0.0") when only exact versions are valid
  // as installable pins. The function must return null rather than crash or guess.
  const core = mod('core', { '1.0.0': {}, '1.5.0': {} });

  expect(await findModuleVersion('core', '^1.0.0', makeRegistry(core))).toBeNull();
});
