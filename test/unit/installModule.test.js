import { describe, test, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { addNewModule, installModules } from '#lib/modules/install.js';
import { updateModule } from '#lib/modules/update.js';
import { parseModuleArg } from '#lib/modules/parseModuleArg.js';
import { makeGetVersions } from '#lib/modules/registry.js';
import { frozenInstall } from '#lib/modules/orchestrator.js';
import { downloadAllModules, modulesToDownload, modulesNotOnDisk } from '#lib/modules/downloadModule.js';
import { mod, makeRegistry } from '#test/utils/moduleRegistry.js';
import { withTmpDir } from '#test/utils/withTmpDir.js';
import { makeSpinner } from '#test/utils/spinnerMock.js';
import { makeFileHelpers } from '#test/utils/fileHelpers.js';

vi.mock('#lib/modules/downloadModule.js', () => ({
  downloadAllModules: vi.fn().mockResolvedValue(undefined),
  modulesToDownload: vi.fn().mockReturnValue({}),
  modulesNotOnDisk: vi.fn().mockReturnValue({})
}));

// Mocked so that installModules tests that trigger the resolve path do not
// make real network calls. Configured per-test via Portal.moduleVersions.mockResolvedValue().
vi.mock('#lib/portal.js', () => ({
  default: { moduleVersions: vi.fn() }
}));

const getTmpDir = withTmpDir('pos-cli-install-test-');

const REGISTRY = 'https://partners.platformos.com';

// ---------------------------------------------------------------------------
// addNewModule — install is conditional (unlike update)
// ---------------------------------------------------------------------------

describe('addNewModule', () => {
  test('returns null when module is already installed and no version is specified', async () => {
    const getVersions = makeRegistry(mod('tests', { '0.0.3': {}, '1.0.0': {} }));

    const result = await addNewModule('tests', undefined, { tests: '0.0.3' }, getVersions, REGISTRY);

    expect(result).toBeNull();
  });

  test('adds the module when it is not yet in localModules and no version is specified (stores caret range)', async () => {
    const getVersions = makeRegistry(mod('tests', { '0.0.3': {}, '1.0.0': {} }));

    const result = await addNewModule('tests', undefined, {}, getVersions, REGISTRY);

    expect(result).toEqual({ tests: '^1.0.0' });
  });

  test('updates the pinned version when an explicit version is specified, even if already installed', async () => {
    const getVersions = makeRegistry(mod('tests', { '0.0.3': {}, '1.0.0': {} }));

    const result = await addNewModule('tests', '0.0.3', { tests: '1.0.0' }, getVersions, REGISTRY);

    expect(result).toEqual({ tests: '0.0.3' });
  });

  test('throws with exact message including registry URL when module is not found', async () => {
    const getVersions = makeRegistry(); // empty registry

    await expect(
      addNewModule('nonexistent', undefined, {}, getVersions, REGISTRY)
    ).rejects.toMatchObject({ message: `Can't find module nonexistent (registry: ${REGISTRY})` });
  });

  test('throws with exact message including registry URL when requested version does not exist', async () => {
    const getVersions = makeRegistry(mod('tests', { '0.0.3': {} }));

    await expect(
      addNewModule('tests', '9.9.9', {}, getVersions, REGISTRY)
    ).rejects.toMatchObject({ message: `Can't find module tests with version 9.9.9 (registry: ${REGISTRY})` });
  });

  test('preserves other existing modules in the returned map', async () => {
    const getVersions = makeRegistry(mod('tests', { '1.0.0': {} }));

    const result = await addNewModule('tests', '1.0.0', { core: '2.0.0' }, getVersions, REGISTRY);

    expect(result).toEqual({ core: '2.0.0', tests: '1.0.0' });
  });

  test('stores caret range on resolved version when no version given for a 2.x module', async () => {
    const getVersions = makeRegistry(mod('core', { '2.1.5': {}, '2.3.1': {} }));

    const result = await addNewModule('core', undefined, {}, getVersions, REGISTRY);

    expect(result).toEqual({ core: '^2.3.1' });
  });

  test('stores explicit range as-is when given a range', async () => {
    const getVersions = makeRegistry(mod('core', { '2.0.0': {}, '2.3.1': {} }));

    const result = await addNewModule('core', '^2.0.0', {}, getVersions, REGISTRY);

    expect(result).toEqual({ core: '^2.0.0' });
  });

  test('throws when an explicit range resolves to nothing', async () => {
    const getVersions = makeRegistry(mod('core', { '1.0.0': {}, '1.5.0': {} }));

    await expect(
      addNewModule('core', '^3.0.0', {}, getVersions, REGISTRY)
    ).rejects.toMatchObject({ message: /Can't find module core with version \^3\.0\.0/ });
  });

  test('module already exists and new range is given → updates range in pos-modules.json', async () => {
    const getVersions = makeRegistry(mod('core', { '2.0.0': {}, '2.3.1': {}, '3.0.0': {} }));

    const result = await addNewModule('core', '^3.0.0', { core: '^2.0.0' }, getVersions, REGISTRY);

    expect(result).toEqual({ core: '^3.0.0' });
  });
});

// ---------------------------------------------------------------------------
// updateModule — always queries the registry (unlike addNewModule)
// ---------------------------------------------------------------------------

describe('updateModule', () => {
  test('updates an already-installed module to its latest stable version', async () => {
    const getVersions = makeRegistry(mod('tests', { '0.0.3': {}, '1.0.0': {} }));

    const result = await updateModule('tests', undefined, { tests: '0.0.3' }, getVersions, REGISTRY);

    expect(result).toEqual({ tests: '1.0.0' });
  });

  test('falls back to latest pre-release when module has no stable versions', async () => {
    const getVersions = makeRegistry(mod('oauth_github', { '1.0.0-beta': {}, '1.0.0-rc.1': {} }));

    const result = await updateModule('oauth_github', undefined, { 'oauth_github': '1.0.0-beta' }, getVersions, REGISTRY);

    expect(result).toEqual({ 'oauth_github': '1.0.0-rc.1' });
  });

  test('pins to an explicit version even if a newer one exists', async () => {
    const getVersions = makeRegistry(mod('tests', { '0.0.3': {}, '1.0.0': {} }));

    const result = await updateModule('tests', '0.0.3', { tests: '1.0.0' }, getVersions, REGISTRY);

    expect(result).toEqual({ tests: '0.0.3' });
  });

  test('throws with registry context when module is not found', async () => {
    const getVersions = makeRegistry(); // empty registry

    await expect(
      updateModule('nonexistent', undefined, {}, getVersions, REGISTRY)
    ).rejects.toMatchObject({ message: `Can't find module nonexistent (registry: ${REGISTRY})` });
  });

  test('throws with registry context when the requested version does not exist', async () => {
    const getVersions = makeRegistry(mod('tests', { '1.0.0': {} }));

    await expect(
      updateModule('tests', '9.9.9', {}, getVersions, REGISTRY)
    ).rejects.toMatchObject({ message: `Can't find module tests with version 9.9.9 (registry: ${REGISTRY})` });
  });

  test('preserves other modules in the returned map', async () => {
    const getVersions = makeRegistry(mod('tests', { '1.0.0': {} }));

    const result = await updateModule('tests', '1.0.0', { core: '2.0.0', tests: '0.0.3' }, getVersions, REGISTRY);

    expect(result).toEqual({ core: '2.0.0', tests: '1.0.0' });
  });

  test('updates to latest stable when module is not in localModules at all', async () => {
    const getVersions = makeRegistry(mod('core', { '1.0.0': {}, '2.0.0': {} }));

    const result = await updateModule('core', undefined, {}, getVersions, REGISTRY);

    expect(result).toEqual({ core: '2.0.0' });
  });

  test('no version given and existing entry is a range → range stays unchanged in pos-modules.json', async () => {
    const getVersions = makeRegistry(mod('core', { '2.0.0': {}, '2.3.1': {} }));

    const result = await updateModule('core', undefined, { core: '^2.0.0' }, getVersions, REGISTRY);

    expect(result).toEqual({ core: '^2.0.0' });
  });

  test('explicit range given → stores the new range in pos-modules.json', async () => {
    const getVersions = makeRegistry(mod('core', { '3.0.0': {}, '3.1.0': {} }));

    const result = await updateModule('core', '^3.0.0', { core: '^2.0.0' }, getVersions, REGISTRY);

    expect(result).toEqual({ core: '^3.0.0' });
  });

  test('explicit range that resolves to nothing throws', async () => {
    const getVersions = makeRegistry(mod('core', { '2.0.0': {}, '2.3.1': {} }));

    await expect(
      updateModule('core', '^5.0.0', { core: '^2.0.0' }, getVersions, REGISTRY)
    ).rejects.toMatchObject({ message: /Can't find module core with version \^5\.0\.0/ });
  });
});

// ---------------------------------------------------------------------------
// devDependencies routing — callers pass the correct section map to each function
// ---------------------------------------------------------------------------

describe('devDependencies routing via addNewModule', () => {
  test('adding to devDependencies map works identically to adding to dependencies map', async () => {
    const getVersions = makeRegistry(mod('tests', { '1.0.0': {} }));
    const devModules = {};
    const result = await addNewModule('tests', undefined, devModules, getVersions, REGISTRY);
    expect(result).toEqual({ tests: '^1.0.0' });
  });

  test('no-op when module already in devDependencies and no version specified', async () => {
    const getVersions = makeRegistry(mod('tests', { '1.0.1': {} }));
    const result = await addNewModule('tests', undefined, { tests: '1.0.0' }, getVersions, REGISTRY);
    expect(result).toBeNull();
  });

  test('updating version in devDependencies map works identically to dependencies', async () => {
    const getVersions = makeRegistry(mod('tests', { '1.0.0': {}, '1.0.1': {} }));
    const result = await updateModule('tests', undefined, { tests: '1.0.0' }, getVersions, REGISTRY);
    expect(result).toEqual({ tests: '1.0.1' });
  });
});

// ---------------------------------------------------------------------------
// parseModuleArg
// ---------------------------------------------------------------------------

describe('parseModuleArg', () => {
  test('splits name@version at the last @', () => {
    expect(parseModuleArg('core@2.0.0')).toEqual(['core', '2.0.0']);
  });

  test('returns [name, undefined] when no @ present', () => {
    expect(parseModuleArg('core')).toEqual(['core', undefined]);
  });

  test('splits scoped package at the version @, not the scope @', () => {
    expect(parseModuleArg('@scope/core@2.0.0')).toEqual(['@scope/core', '2.0.0']);
  });

  test('returns scoped name unchanged when no version is given', () => {
    expect(parseModuleArg('@scope/core')).toEqual(['@scope/core', undefined]);
  });

  test('handles pre-release version strings', () => {
    expect(parseModuleArg('tests@1.0.0-beta.1')).toEqual(['tests', '1.0.0-beta.1']);
  });

  test('handles range argument (install core@^2.0.0)', () => {
    expect(parseModuleArg('core@^2.0.0')).toEqual(['core', '^2.0.0']);
  });

  test('treats trailing @ with no version as no version (returns undefined)', () => {
    expect(parseModuleArg('core@')).toEqual(['core', undefined]);
  });
});

// ---------------------------------------------------------------------------
// makeGetVersions — multi-registry routing
// ---------------------------------------------------------------------------

describe('makeGetVersions', () => {
  test('routes all modules to default URL when no per-module overrides', async () => {
    const fetch = vi.fn().mockResolvedValue([{ module: 'core', versions: { '1.0.0': {} } }]);
    const getVersions = makeGetVersions(fetch, 'https://default.example.com', {});
    await getVersions(['core']);
    expect(fetch).toHaveBeenCalledWith(['core'], 'https://default.example.com');
  });

  test('routes module to its override URL', async () => {
    const fetch = vi.fn().mockResolvedValue([]);
    const getVersions = makeGetVersions(fetch, 'https://default.example.com', {
      'custom-mod': 'https://custom.example.com'
    });
    await getVersions(['custom-mod']);
    expect(fetch).toHaveBeenCalledWith(['custom-mod'], 'https://custom.example.com');
  });

  test('batches modules sharing the same registry URL into a single call', async () => {
    const fetch = vi.fn().mockResolvedValue([]);
    const getVersions = makeGetVersions(fetch, 'https://default.example.com', {});
    await getVersions(['core', 'user', 'tests']);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      ['core', 'user', 'tests'],
      'https://default.example.com'
    );
  });

  test('splits modules with different registries into separate fetches', async () => {
    const fetch = vi.fn().mockResolvedValue([]);
    const getVersions = makeGetVersions(fetch, 'https://default.example.com', {
      'custom-mod': 'https://custom.example.com'
    });
    await getVersions(['core', 'custom-mod']);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(['core'], 'https://default.example.com');
    expect(fetch).toHaveBeenCalledWith(['custom-mod'], 'https://custom.example.com');
  });

  test('flattens results from multiple registry fetches into a single array', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce([{ module: 'core', versions: {} }])
      .mockResolvedValueOnce([{ module: 'custom-mod', versions: {} }]);
    const getVersions = makeGetVersions(fetch, 'https://default.example.com', {
      'custom-mod': 'https://custom.example.com'
    });
    const result = await getVersions(['core', 'custom-mod']);
    expect(result).toEqual([
      { module: 'core', versions: {} },
      { module: 'custom-mod', versions: {} },
    ]);
  });

  test('throws with combined message when one registry fails', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce([{ module: 'core', versions: {} }])
      .mockRejectedValueOnce(new Error('Connection refused'));
    const getVersions = makeGetVersions(fetch, 'https://default.example.com', {
      'custom-mod': 'https://unreachable.example.com'
    });
    await expect(getVersions(['core', 'custom-mod'])).rejects.toThrow(/Registry fetch failed.*Connection refused/);
  });

  test('still attempts all registries even when one fails (allSettled semantics)', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error('first failed'))
      .mockRejectedValueOnce(new Error('second failed'));
    const getVersions = makeGetVersions(fetch, 'https://default.example.com', {
      'custom-mod': 'https://other.example.com'
    });
    await expect(getVersions(['core', 'custom-mod'])).rejects.toThrow(/first failed.*second failed|second failed.*first failed/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// frozenInstall
// ---------------------------------------------------------------------------

const { writeLock } = makeFileHelpers(getTmpDir);

const spinner = makeSpinner();

describe('frozenInstall', () => {
  beforeEach(() => vi.clearAllMocks());

  test('throws when lock file is absent', async () => {
    await expect(
      frozenInstall(spinner, { core: '2.0.0' }, {})
    ).rejects.toThrow(/missing or empty/);
  });

  test('throws when lock file has both sections empty', async () => {
    writeLock({ dependencies: {}, devDependencies: {} });
    await expect(
      frozenInstall(spinner, { core: '2.0.0' }, {})
    ).rejects.toThrow(/missing or empty/);
  });

  test('throws with list of missing deps when manifest dep not in lock', async () => {
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });
    await expect(
      frozenInstall(spinner, { core: '2.0.0', user: '5.0.0' }, {})
    ).rejects.toThrow(/out of date.*user/);
  });

  test('succeeds when all manifest deps are present in lock', async () => {
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });
    await expect(
      frozenInstall(spinner, { core: '2.0.0' }, {})
    ).resolves.toMatchObject({ resolvedProd: { core: '2.0.0' }, resolvedDev: {} });
    expect(spinner.succeed).toHaveBeenCalledWith('Using frozen lock file');
    expect(downloadAllModules).toHaveBeenCalledWith({}, expect.any(Function));
  });

  test('validates devDependencies when devModules is non-empty', async () => {
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: { tests: '1.0.1' } });
    await expect(
      frozenInstall(spinner, { core: '2.0.0' }, { tests: '1.0.1' }, REGISTRY, { includeDev: true })
    ).resolves.toMatchObject({ resolvedProd: { core: '2.0.0' }, resolvedDev: { tests: '1.0.1' } });
  });

  test('throws when devModules entry is missing from lock devDependencies', async () => {
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });
    await expect(
      frozenInstall(spinner, { core: '2.0.0' }, { tests: '1.0.1' }, REGISTRY, { includeDev: true })
    ).rejects.toThrow(/out of date.*tests/);
  });

  test('returns resolvedProd and resolvedDev from lock, never from registry', async () => {
    writeLock({
      dependencies: { core: '2.0.6' },
      devDependencies: { tests: '1.0.1' },
      registries: { tests: 'https://custom.example.com' }
    });
    const result = await frozenInstall(spinner, { core: '2.0.6' }, { tests: '1.0.1' }, REGISTRY, { includeDev: true });
    expect(result).toMatchObject({ resolvedProd: { core: '2.0.6' }, resolvedDev: { tests: '1.0.1' } });
  });

  test('succeeds with only devDependencies in lock when prod is empty', async () => {
    writeLock({ dependencies: {}, devDependencies: { tests: '1.0.1' } });
    // Lock is non-empty (dev section has entries) → should not throw missing/empty
    await expect(
      frozenInstall(spinner, {}, { tests: '1.0.1' }, REGISTRY, { includeDev: true })
    ).resolves.toMatchObject({ resolvedProd: {}, resolvedDev: { tests: '1.0.1' } });
  });

  test('skip count only counts prod modules when devModules is empty', async () => {
    // Lock has 3 modules total but only 1 is prod; skipped count must reflect prod only
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: { tests: '1.0.1', oauth: '0.5.0' } });
    await frozenInstall(spinner, { core: '2.0.0' }, {});
    expect(spinner.succeed).toHaveBeenCalledWith('Modules downloaded successfully (1 already up-to-date)');
  });

  test('uses modulesNotOnDisk (not modulesToDownload) to decide what to download', async () => {
    // frozenInstall has no "previous lock" to diff against — the lock IS the truth.
    // It should use the disk-only check, not the version-diff check.
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });

    await frozenInstall(spinner, { core: '2.0.0' }, {});

    expect(modulesNotOnDisk).toHaveBeenCalledWith({ core: '2.0.0' });
    expect(modulesToDownload).not.toHaveBeenCalled();
  });

  test('uses modulesNotOnDisk for both prod and dev sections when devModules is non-empty', async () => {
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: { tests: '1.0.1' } });

    await frozenInstall(spinner, { core: '2.0.0' }, { tests: '1.0.1' }, REGISTRY, { includeDev: true });

    expect(modulesNotOnDisk).toHaveBeenCalledWith({ core: '2.0.0' });
    expect(modulesNotOnDisk).toHaveBeenCalledWith({ tests: '1.0.1' });
  });

  test('uses provided registryUrl as fallback for modules without explicit lock entry', async () => {
    const customRegistry = 'https://custom.registry.example.com';
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {}, registries: {} });
    modulesNotOnDisk.mockReturnValueOnce({ core: '2.0.0' });

    await frozenInstall(spinner, { core: '2.0.0' }, {}, customRegistry);

    const getRegistryUrl = downloadAllModules.mock.calls[0][1];
    expect(getRegistryUrl('core')).toBe(customRegistry);
  });

  test('uses lock registries entry over provided registryUrl', async () => {
    const customRegistry = 'https://custom.registry.example.com';
    const lockRegistry = 'https://lock.registry.example.com';
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {}, registries: { core: lockRegistry } });
    modulesNotOnDisk.mockReturnValueOnce({ core: '2.0.0' });

    await frozenInstall(spinner, { core: '2.0.0' }, {}, customRegistry);

    const getRegistryUrl = downloadAllModules.mock.calls[0][1];
    expect(getRegistryUrl('core')).toBe(lockRegistry);
  });
});

import Portal from '#lib/portal.js';

const { writeManifest: writeManifestForRouting } = makeFileHelpers(getTmpDir);

// ---------------------------------------------------------------------------
// installModules — manifest not updated on resolution failure
// ---------------------------------------------------------------------------

describe('installModules — manifest not updated on resolution failure', () => {
  beforeEach(() => vi.clearAllMocks());

  test('does not update pos-module.json when resolution fails with a conflict', async () => {
    // core@^2.0.0 is existing; user@5.1.2 requires core@^1.0.0 (incompatible).
    // The install should fail and pos-module.json must remain unchanged.
    writeManifestForRouting({ dependencies: { core: '^2.0.0' } });

    Portal.moduleVersions.mockResolvedValue([
      { module: 'core', versions: { '2.0.0': { dependencies: {} } } },
      { module: 'user', versions: { '5.1.2': { dependencies: { core: '^1.0.0' } } } },
    ]);

    await expect(installModules(spinner, 'user@5.1.2', {})).rejects.toThrow(/No version of "core" satisfies/);

    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest.dependencies).toEqual({ core: '^2.0.0' });
  });
});

// ---------------------------------------------------------------------------
// installModules — routing: frozen path vs resolve path
// ---------------------------------------------------------------------------

describe('installModules — routing', () => {
  beforeEach(() => vi.clearAllMocks());

  test('no-arg + valid lock → takes frozen path (no registry calls)', async () => {
    writeManifestForRouting({ dependencies: { core: '^2.0.0' } });
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });

    await installModules(spinner, undefined, {});

    expect(spinner.succeed).toHaveBeenCalledWith('Using frozen lock file');
    expect(Portal.moduleVersions).not.toHaveBeenCalled();
  });

  test('no-arg + absent lock → takes resolve path (hits registry)', async () => {
    writeManifestForRouting({ dependencies: { core: '^2.0.0' } });
    // No lock file written — smartInstall falls through to resolveAndDownload
    Portal.moduleVersions.mockResolvedValue([
      { module: 'core', versions: { '2.0.0': { dependencies: {} } } }
    ]);

    await installModules(spinner, undefined, {});

    expect(spinner.start).toHaveBeenCalledWith('Resolving module dependencies');
    expect(spinner.succeed).not.toHaveBeenCalledWith('Using frozen lock file');
  });

  test('named module (already installed) + valid lock → always takes resolve path', async () => {
    writeManifestForRouting({ dependencies: { core: '^2.0.0' } });
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });
    Portal.moduleVersions.mockResolvedValue([
      { module: 'core', versions: { '2.0.0': { dependencies: {} } } }
    ]);

    // 'core' is already in dependencies with no version → addNewModule returns null (no-op),
    // but moduleNameWithVersion is truthy so install.js routes to resolveAndDownload directly.
    await installModules(spinner, 'core', {});

    expect(spinner.start).toHaveBeenCalledWith('Resolving module dependencies');
    expect(spinner.succeed).not.toHaveBeenCalledWith('Using frozen lock file');
  });
});
