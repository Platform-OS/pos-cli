import { describe, test, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { uninstallModule } from '#lib/modules/uninstall.js';
import { mod, makeRegistry } from '#test/utils/moduleRegistry.js';
import { withTmpDir } from '#test/utils/withTmpDir.js';
import { makeSpinner } from '#test/utils/spinnerMock.js';
import { makeFileHelpers } from '#test/utils/fileHelpers.js';

vi.mock('#lib/modules/downloadModule.js', () => ({
  downloadAllModules: vi.fn().mockResolvedValue(undefined),
  modulesToDownload: vi.fn().mockReturnValue({}),
  modulesNotOnDisk: vi.fn().mockReturnValue({}),
}));

vi.mock('#lib/portal.js', () => ({
  default: { moduleVersions: vi.fn() },
}));

const getTmpDir = withTmpDir('pos-cli-uninstall-test-');
const { writeManifest, writeLock } = makeFileHelpers(getTmpDir);
const spinner = makeSpinner();

// Helper: creates a modules/<name> directory in the tmpDir to simulate a downloaded module.
const createModuleDir = (name) => {
  fs.mkdirSync(path.join(getTmpDir(), 'modules', name), { recursive: true });
};

// Helper: reads pos-module.json from the tmpDir.
const readManifest = () =>
  JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));

// Helper: reads pos-module.lock.json from the tmpDir.
const readLock = () =>
  JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.lock.json'), 'utf8'));

import Portal from '#lib/portal.js';

// A minimal registry response for a single module with no transitive deps.
const mockRegistryWith = (...mods) => {
  Portal.moduleVersions.mockResolvedValue(mods.map(m => m));
};

// ---------------------------------------------------------------------------
// Error cases — module not found / wrong section
// ---------------------------------------------------------------------------

describe('uninstallModule — error cases', () => {
  beforeEach(() => vi.clearAllMocks());

  test('throws when module is not installed at all', async () => {
    writeManifest({ dependencies: { core: '2.0.0' } });
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });

    await expect(
      uninstallModule(spinner, 'nonexistent', {})
    ).rejects.toThrow(/Module "nonexistent" is not installed/);
  });

  test('throws with --dev hint when module is in dependencies but --dev is not used', async () => {
    writeManifest({ devDependencies: { tests: '1.0.0' } });
    writeLock({ dependencies: {}, devDependencies: { tests: '1.0.0' } });

    await expect(
      uninstallModule(spinner, 'tests', { dev: false })
    ).rejects.toThrow(/Use --dev/);
  });

  test('throws with hint to omit --dev when module is in dependencies but --dev is passed', async () => {
    writeManifest({ dependencies: { core: '2.0.0' } });
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });

    await expect(
      uninstallModule(spinner, 'core', { dev: true })
    ).rejects.toThrow(/Omit --dev/);
  });
});

// ---------------------------------------------------------------------------
// Removing from dependencies
// ---------------------------------------------------------------------------

describe('uninstallModule — remove from dependencies', () => {
  beforeEach(() => vi.clearAllMocks());

  test('removes module from pos-module.json dependencies', async () => {
    writeManifest({ dependencies: { core: '2.0.0', user: '3.0.0' } });
    writeLock({ dependencies: { core: '2.0.0', user: '3.0.0' }, devDependencies: {} });
    mockRegistryWith(mod('user', { '3.0.0': {} }));

    await uninstallModule(spinner, 'core', {});

    const manifest = readManifest();
    expect(manifest.dependencies).not.toHaveProperty('core');
    expect(manifest.dependencies).toHaveProperty('user', '3.0.0');
  });

  test('succeeds with a success message', async () => {
    writeManifest({ dependencies: { core: '2.0.0', user: '3.0.0' } });
    writeLock({ dependencies: { core: '2.0.0', user: '3.0.0' }, devDependencies: {} });
    mockRegistryWith(mod('user', { '3.0.0': {} }));

    await uninstallModule(spinner, 'core', {});

    expect(spinner.succeed).toHaveBeenCalledWith(
      expect.stringMatching(/Uninstalled module: core/)
    );
    expect(spinner.succeed).toHaveBeenCalledWith(
      expect.stringMatching(/dependencies/)
    );
  });

  test('deletes module directory from disk', async () => {
    writeManifest({ dependencies: { core: '2.0.0', user: '3.0.0' } });
    writeLock({ dependencies: { core: '2.0.0', user: '3.0.0' }, devDependencies: {} });
    createModuleDir('core');
    mockRegistryWith(mod('user', { '3.0.0': {} }));

    await uninstallModule(spinner, 'core', {});

    expect(fs.existsSync(path.join(getTmpDir(), 'modules', 'core'))).toBe(false);
  });

  test('does not delete directory of other installed modules', async () => {
    writeManifest({ dependencies: { core: '2.0.0', user: '3.0.0' } });
    writeLock({ dependencies: { core: '2.0.0', user: '3.0.0' }, devDependencies: {} });
    createModuleDir('core');
    createModuleDir('user');
    mockRegistryWith(mod('user', { '3.0.0': {} }));

    await uninstallModule(spinner, 'core', {});

    expect(fs.existsSync(path.join(getTmpDir(), 'modules', 'user'))).toBe(true);
  });

  test('succeeds even when module directory does not exist on disk', async () => {
    writeManifest({ dependencies: { core: '2.0.0', user: '3.0.0' } });
    writeLock({ dependencies: { core: '2.0.0', user: '3.0.0' }, devDependencies: {} });
    // No createModuleDir call — directory is absent
    mockRegistryWith(mod('user', { '3.0.0': {} }));

    await expect(uninstallModule(spinner, 'core', {})).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Removing from devDependencies
// ---------------------------------------------------------------------------

describe('uninstallModule — remove from devDependencies', () => {
  beforeEach(() => vi.clearAllMocks());

  test('removes module from pos-module.json devDependencies', async () => {
    writeManifest({ dependencies: { core: '2.0.0' }, devDependencies: { tests: '1.0.0' } });
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: { tests: '1.0.0' } });
    mockRegistryWith(mod('core', { '2.0.0': {} }));

    await uninstallModule(spinner, 'tests', { dev: true });

    const manifest = readManifest();
    expect(manifest.devDependencies ?? {}).not.toHaveProperty('tests');
    expect(manifest.dependencies).toHaveProperty('core', '2.0.0');
  });

  test('deletes devDependency module directory from disk', async () => {
    writeManifest({ dependencies: { core: '2.0.0' }, devDependencies: { tests: '1.0.0' } });
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: { tests: '1.0.0' } });
    createModuleDir('tests');
    mockRegistryWith(mod('core', { '2.0.0': {} }));

    await uninstallModule(spinner, 'tests', { dev: true });

    expect(fs.existsSync(path.join(getTmpDir(), 'modules', 'tests'))).toBe(false);
  });

  test('succeeds with a success message mentioning devDependencies', async () => {
    writeManifest({ dependencies: { core: '2.0.0' }, devDependencies: { tests: '1.0.0' } });
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: { tests: '1.0.0' } });
    mockRegistryWith(mod('core', { '2.0.0': {} }));

    await uninstallModule(spinner, 'tests', { dev: true });

    expect(spinner.succeed).toHaveBeenCalledWith(
      expect.stringMatching(/devDependencies/)
    );
  });
});

// ---------------------------------------------------------------------------
// Last module removed — lock file should be cleared
// ---------------------------------------------------------------------------

describe('uninstallModule — last module removed', () => {
  beforeEach(() => vi.clearAllMocks());

  test('writes an empty lock file when no modules remain', async () => {
    writeManifest({ dependencies: { core: '2.0.0' } });
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });

    await uninstallModule(spinner, 'core', {});

    const lock = readLock();
    expect(lock.dependencies).toEqual({});
    expect(lock.devDependencies).toEqual({});
  });

  test('writes an empty lock file when last devDependency is removed', async () => {
    writeManifest({ devDependencies: { tests: '1.0.0' } });
    writeLock({ dependencies: {}, devDependencies: { tests: '1.0.0' } });

    await uninstallModule(spinner, 'tests', { dev: true });

    const lock = readLock();
    expect(lock.dependencies).toEqual({});
    expect(lock.devDependencies).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Manifest preservation — other fields must not be lost
// ---------------------------------------------------------------------------

describe('uninstallModule — manifest field preservation', () => {
  beforeEach(() => vi.clearAllMocks());

  test('preserves name, machine_name, version, repository_url after uninstall', async () => {
    writeManifest({
      name: 'My Module',
      machine_name: 'my_module',
      version: '1.2.3',
      repository_url: 'https://partners.platformos.com',
      dependencies: { core: '2.0.0', user: '3.0.0' },
    });
    writeLock({ dependencies: { core: '2.0.0', user: '3.0.0' }, devDependencies: {} });
    mockRegistryWith(mod('user', { '3.0.0': {} }));

    await uninstallModule(spinner, 'core', {});

    const manifest = readManifest();
    expect(manifest.name).toBe('My Module');
    expect(manifest.machine_name).toBe('my_module');
    expect(manifest.version).toBe('1.2.3');
    expect(manifest.repository_url).toBe('https://partners.platformos.com');
  });
});
