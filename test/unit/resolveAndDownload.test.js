/**
 * Unit tests for resolveAndDownload — dev dependency section isolation.
 *
 * These tests verify the lock-file write/skip logic and dev-section isolation.
 * downloadAllModules is mocked so no network calls are made.
 */
import { describe, test, expect, vi } from 'vitest';
import fs from 'fs';
import { resolveAndDownload } from '#lib/modules/orchestrator.js';
import { writePosModulesLock, readPosModulesLock } from '#lib/modules/configFiles.js';
import { mod, makeRegistry } from '#test/utils/moduleRegistry.js';
import { withTmpDir } from '#test/utils/withTmpDir.js';
import { makeSpinner } from '#test/utils/spinnerMock.js';

vi.mock('#lib/modules/downloadModule.js', () => ({
  downloadAllModules: vi.fn().mockResolvedValue(undefined),
  modulesToDownload: vi.fn().mockReturnValue({}),
  modulesNotOnDisk: vi.fn().mockReturnValue({})
}));

const REGISTRY = 'https://partners.platformos.com';

const spinner = makeSpinner();

withTmpDir('pos-cli-rad-test-');

describe('resolveAndDownload — devDependencies section isolation', () => {
  test('when devModules is empty, existing dev lock section is preserved unchanged', async () => {
    writePosModulesLock({ core: '2.0.0' }, { tests: '1.0.0' }, { core: REGISTRY, tests: REGISTRY });
    const getVersions = makeRegistry(mod('core', { '2.0.0': {} }));

    await resolveAndDownload(spinner, { core: '^2.0.0' }, {}, REGISTRY, getVersions);

    const lock = readPosModulesLock();
    expect(lock.devDependencies).toEqual({ tests: '1.0.0' });
  });

  test('dev deps resolved as delta over prod — modules in prod are not duplicated in dev lock', async () => {
    const core  = mod('core',  { '2.0.0': {} });
    const tests = mod('tests', { '1.0.0': { core: '^2.0.0' } });
    const getVersions = makeRegistry(core, tests);

    await resolveAndDownload(
      spinner,
      { core: '^2.0.0' },
      { tests: '^1.0.0' },
      REGISTRY,
      getVersions,
      { includeDev: true }
    );

    const lock = readPosModulesLock();
    expect(lock.dependencies).toHaveProperty('core');
    expect(lock.devDependencies).not.toHaveProperty('core');
    expect(lock.devDependencies).toHaveProperty('tests');
  });

  test('lock file is not rewritten when resolved versions and registries match previous lock exactly', async () => {
    writePosModulesLock(
      { core: '2.0.0' },
      { tests: '1.0.0' },
      { core: REGISTRY, tests: REGISTRY }
    );
    const getVersions = makeRegistry(
      mod('core',  { '2.0.0': {} }),
      mod('tests', { '1.0.0': {} })
    );
    const writeSpy = vi.spyOn(fs, 'writeFileSync');

    await resolveAndDownload(
      spinner,
      { core: '2.0.0' },
      { tests: '1.0.0' },
      REGISTRY,
      getVersions,
      { includeDev: true }
    );

    expect(writeSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('pos-module.lock.json'),
      expect.anything()
    );
  });

  test('dev modules in previous lock are not shown as removed when devModules is empty', async () => {
    writePosModulesLock({ core: '2.0.0' }, { tests: '1.0.0' }, { core: REGISTRY, tests: REGISTRY });
    const getVersions = makeRegistry(mod('core', { '2.0.0': {} }));
    const writeSpy = vi.spyOn(process.stdout, 'write');

    await resolveAndDownload(spinner, { core: '2.0.0' }, {}, REGISTRY, getVersions);

    const removedLines = writeSpy.mock.calls
      .flatMap(([s]) => s.split('\n'))
      .filter(line => line.startsWith('-'));
    expect(removedLines).toHaveLength(0);
  });

  test('all resolved modules get explicit registry entries written to lock file', async () => {
    const getVersions = makeRegistry(mod('core', { '2.0.0': {} }));

    await resolveAndDownload(spinner, { core: '2.0.0' }, {}, REGISTRY, getVersions);

    const lock = readPosModulesLock();
    expect(lock.registries).toEqual({ core: REGISTRY });
  });

  test('per-module registry override is written to lock file', async () => {
    const getVersions = makeRegistry(mod('core', { '2.0.0': {} }));

    await resolveAndDownload(
      spinner,
      { core: '^2.0.0' },
      {},
      REGISTRY,
      getVersions,
      { registries: { core: 'https://custom.registry.example.com' } }
    );

    const lock = readPosModulesLock();
    expect(lock.registries).toEqual({ core: 'https://custom.registry.example.com' });
  });

  test('orphan registry entries for removed prod modules are not preserved in lock', async () => {
    // Previous lock contains 'old-module' which has since been removed from pos-module.json.
    writePosModulesLock(
      { core: '2.0.0', 'old-module': '1.0.0' },
      {},
      { core: REGISTRY, 'old-module': REGISTRY }
    );
    const getVersions = makeRegistry(mod('core', { '2.0.0': {} }));

    await resolveAndDownload(spinner, { core: '2.0.0' }, {}, REGISTRY, getVersions);

    const lock = readPosModulesLock();
    expect(lock.registries).not.toHaveProperty('old-module');
    expect(lock.registries).toHaveProperty('core');
  });

  test('dev registries for still-present dev modules are preserved during prod-only run', async () => {
    writePosModulesLock(
      { core: '2.0.0' },
      { tests: '1.0.0' },
      { core: REGISTRY, tests: 'https://custom-dev.example.com' }
    );
    const getVersions = makeRegistry(mod('core', { '2.0.0': {} }));

    // prod-only run: includeDev defaults to false
    await resolveAndDownload(spinner, { core: '2.0.0' }, {}, REGISTRY, getVersions);

    const lock = readPosModulesLock();
    // tests is still in the dev lock section so its registry entry must be preserved
    expect(lock.registries).toHaveProperty('tests', 'https://custom-dev.example.com');
  });

  test('clearing devDependencies in manifest removes dev modules from lock on includeDev:true run', async () => {
    writePosModulesLock(
      { core: '2.0.0' },
      { tests: '1.0.0' },
      { core: REGISTRY, tests: REGISTRY }
    );
    const getVersions = makeRegistry(mod('core', { '2.0.0': {} }));

    // Dev section in manifest is now empty, but includeDev:true triggers dev resolution
    await resolveAndDownload(
      spinner,
      { core: '2.0.0' },
      {},   // devModules cleared
      REGISTRY,
      getVersions,
      { includeDev: true }
    );

    const lock = readPosModulesLock();
    expect(lock.devDependencies).toEqual({});
    expect(lock.registries).not.toHaveProperty('tests');
  });

  test('lock file is rewritten when registries change even if resolved versions are unchanged', async () => {
    // Bug guard: if isLockUnchanged only checks versions, a registries change silently goes
    // unwritten — --frozen would then use stale registry URLs for downloads.
    writePosModulesLock({ core: '2.0.0' }, {}, {});
    const getVersions = makeRegistry(mod('core', { '2.0.0': {} }));
    const writeSpy = vi.spyOn(fs, 'writeFileSync');

    await resolveAndDownload(
      spinner,
      { core: '2.0.0' },
      {},
      REGISTRY,
      getVersions,
      { registries: { core: 'https://custom.registry.example.com' } }  // registries changed from {}
    );

    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('pos-module.lock.json'),
      expect.anything()
    );
    const lock = readPosModulesLock();
    expect(lock.registries).toEqual({ core: 'https://custom.registry.example.com' });
  });
});
