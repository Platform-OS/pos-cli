import { describe, test, expect } from 'vitest';
import { addNewModule, updateAllModules } from '#lib/modules/installModule.js';
import { mod, makeRegistry } from '#test/utils/moduleRegistry.js';

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

  test('adds the module when it is not yet in localModules and no version is specified', async () => {
    const getVersions = makeRegistry(mod('tests', { '0.0.3': {}, '1.0.0': {} }));

    const result = await addNewModule('tests', undefined, {}, getVersions, REGISTRY);

    expect(result).toEqual({ tests: '1.0.0' });
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
});

// ---------------------------------------------------------------------------
// updateAllModules — updates every root module to its latest stable version
// ---------------------------------------------------------------------------

describe('updateAllModules', () => {
  test('updates all modules to their latest stable version', async () => {
    const getVersions = makeRegistry(
      mod('core', { '1.0.0': {}, '2.0.0': {} }),
      mod('tests', { '0.0.3': {}, '1.0.0': {} })
    );

    const result = await updateAllModules({ core: '1.0.0', tests: '0.0.3' }, getVersions, REGISTRY);

    expect(result).toEqual({ core: '2.0.0', tests: '1.0.0' });
  });

  test('returns empty object unchanged when there are no modules', async () => {
    const getVersions = makeRegistry();

    const result = await updateAllModules({}, getVersions, REGISTRY);

    expect(result).toEqual({});
  });

  test('skips pre-release versions', async () => {
    const getVersions = makeRegistry(
      mod('core', { '1.0.0': {}, '2.0.0-beta.1': {} })
    );

    const result = await updateAllModules({ core: '1.0.0' }, getVersions, REGISTRY);

    expect(result).toEqual({ core: '1.0.0' });
  });

  test('throws with registry context when a module is not found', async () => {
    const getVersions = makeRegistry(); // empty registry

    await expect(
      updateAllModules({ core: '1.0.0' }, getVersions, REGISTRY)
    ).rejects.toMatchObject({ message: `Can't find module core (registry: ${REGISTRY})` });
  });
});
