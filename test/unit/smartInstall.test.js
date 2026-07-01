/**
 * Unit tests for:
 *   - lockIsNonEmpty          (pure)
 *   - lockCoversManifestDeps  (pure)
 *   - isLockValidForInstall   (pure)
 *   - smartInstall            (behavioural: which path is taken)
 *   - frozenInstall           (constraint satisfaction validation)
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  lockIsNonEmpty,
  lockCoversManifestDeps,
  isLockValidForInstall,
  smartInstall,
  frozenInstall,
} from '#lib/modules/orchestrator.js';
import { mod, makeRegistry } from '#test/utils/moduleRegistry.js';
import { withTmpDir } from '#test/utils/withTmpDir.js';
import { makeSpinner } from '#test/utils/spinnerMock.js';
import { makeFileHelpers } from '#test/utils/fileHelpers.js';
import { modulesToDownload, modulesNotOnDisk } from '#lib/modules/downloadModule.js';

vi.mock('#lib/modules/downloadModule.js', () => ({
  downloadAllModules: vi.fn().mockResolvedValue(undefined),
  modulesToDownload: vi.fn().mockReturnValue({}),
  modulesNotOnDisk: vi.fn().mockReturnValue({}),
}));

const REGISTRY = 'https://partners.platformos.com';

// ---------------------------------------------------------------------------
// lockIsNonEmpty — check that the lock has at least one entry
// ---------------------------------------------------------------------------

describe('lockIsNonEmpty', () => {
  const empty = { dependencies: {}, devDependencies: {}, registries: {} };

  test('returns false when both sections are empty', () => {
    expect(lockIsNonEmpty(empty)).toBe(false);
  });

  test('returns true when prod section has entries', () => {
    expect(lockIsNonEmpty({ ...empty, dependencies: { core: '2.0.0' } })).toBe(true);
  });

  test('returns true when only dev section has entries', () => {
    expect(lockIsNonEmpty({ ...empty, devDependencies: { tests: '1.0.0' } })).toBe(true);
  });

  test('returns true when both sections have entries', () => {
    expect(lockIsNonEmpty({ dependencies: { core: '2.0.0' }, devDependencies: { tests: '1.0.0' } })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// lockCoversManifestDeps — check that every manifest dep has a lock entry
// ---------------------------------------------------------------------------

describe('lockCoversManifestDeps', () => {
  const lock = {
    dependencies: { core: '2.0.0' },
    devDependencies: { tests: '1.0.0' },
  };

  test('returns true when manifest is empty (nothing to check)', () => {
    expect(lockCoversManifestDeps(lock, {}, {}, false)).toBe(true);
  });

  test('returns true when all prod deps are covered by the lock', () => {
    expect(lockCoversManifestDeps(lock, { core: '^2.0.0' }, {}, false)).toBe(true);
  });

  test('returns false when a prod dep is absent from the lock', () => {
    expect(lockCoversManifestDeps(lock, { core: '^2.0.0', user: '^5.0.0' }, {}, false)).toBe(false);
  });

  test('returns true when includeDev is false and a dev dep is missing (dev not checked)', () => {
    expect(lockCoversManifestDeps(
      { dependencies: { core: '2.0.0' }, devDependencies: {} },
      { core: '^2.0.0' },
      { tests: '^1.0.0' },
      false
    )).toBe(true);
  });

  test('returns false when includeDev is true and a dev dep is absent from the lock', () => {
    expect(lockCoversManifestDeps(
      { dependencies: { core: '2.0.0' }, devDependencies: {} },
      { core: '^2.0.0' },
      { tests: '^1.0.0' },
      true
    )).toBe(false);
  });

  test('returns true when includeDev is true and all prod + dev deps are covered', () => {
    expect(lockCoversManifestDeps(lock, { core: '^2.0.0' }, { tests: '^1.0.0' }, true)).toBe(true);
  });

  test('lock entry for a dep is valid regardless of version string mismatch', () => {
    // The check is key-only: manifest says "^2.0.0", lock says "2.0.3" — still valid.
    expect(lockCoversManifestDeps(
      { dependencies: { core: '2.0.3' }, devDependencies: {} },
      { core: '^2.0.0' },
      {},
      false
    )).toBe(true);
  });

  test('a dep covered by the dev lock section satisfies a prod check when searching allLock', () => {
    // Transitive dep resolved into dev section — covered by { ...lockProd, ...lockDev }
    expect(lockCoversManifestDeps(
      { dependencies: {}, devDependencies: { core: '2.0.0' } },
      { core: '^2.0.0' },
      {},
      false
    )).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isLockValidForInstall — conjunction of the two checks above
// ---------------------------------------------------------------------------

describe('isLockValidForInstall', () => {
  test('returns false when lock is empty even if manifest is also empty', () => {
    const emptyLock = { dependencies: {}, devDependencies: {} };
    expect(isLockValidForInstall(emptyLock, {}, {}, false)).toBe(false);
  });

  test('returns false when lock is non-empty but a manifest dep is missing', () => {
    const lock = { dependencies: { core: '2.0.0' }, devDependencies: {} };
    expect(isLockValidForInstall(lock, { core: '^2.0.0', user: '^5.0.0' }, {}, false)).toBe(false);
  });

  test('returns true when lock is non-empty and covers all prod deps', () => {
    const lock = { dependencies: { core: '2.0.0' }, devDependencies: {} };
    expect(isLockValidForInstall(lock, { core: '^2.0.0' }, {}, false)).toBe(true);
  });

  test('returns false when includeDev is true and a dev dep is absent from the lock', () => {
    const lock = { dependencies: { core: '2.0.0' }, devDependencies: {} };
    expect(isLockValidForInstall(lock, { core: '^2.0.0' }, { tests: '^1.0.0' }, true)).toBe(false);
  });

  test('returns true when includeDev is true and lock covers all prod + dev deps', () => {
    const lock = { dependencies: { core: '2.0.0' }, devDependencies: { tests: '1.0.0' } };
    expect(isLockValidForInstall(lock, { core: '^2.0.0' }, { tests: '^1.0.0' }, true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// smartInstall — behavioural: which path is taken (frozen vs resolve)
// ---------------------------------------------------------------------------

const getTmpDir = withTmpDir('pos-cli-smart-install-test-');
const { writeLock } = makeFileHelpers(getTmpDir);
const spinner = makeSpinner();

describe('smartInstall', () => {
  beforeEach(() => vi.clearAllMocks());

  test('valid lock → takes frozen path (no registry calls)', async () => {
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });
    const getVersions = vi.fn();

    await smartInstall(spinner, { core: '^2.0.0' }, {}, REGISTRY, getVersions);

    expect(spinner.succeed).toHaveBeenCalledWith('Using frozen lock file');
    expect(getVersions).not.toHaveBeenCalled();
  });

  test('absent lock → takes resolve path (hits registry)', async () => {
    // No lock file written — lock is absent
    const getVersions = makeRegistry(mod('core', { '2.0.0': {} }));

    await smartInstall(spinner, { core: '^2.0.0' }, {}, REGISTRY, getVersions);

    expect(spinner.start).toHaveBeenCalledWith('Resolving module dependencies');
    expect(spinner.succeed).not.toHaveBeenCalledWith('Using frozen lock file');
  });

  test('stale lock (manifest dep not in lock) → takes resolve path', async () => {
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });
    // Manifest now also requires 'user', which is not in the lock
    const getVersions = makeRegistry(
      mod('core', { '2.0.0': {} }),
      mod('user', { '5.0.0': {} })
    );

    await smartInstall(spinner, { core: '^2.0.0', user: '^5.0.0' }, {}, REGISTRY, getVersions);

    expect(spinner.start).toHaveBeenCalledWith('Resolving module dependencies');
    expect(spinner.succeed).not.toHaveBeenCalledWith('Using frozen lock file');
  });

  test('valid lock with dev deps + includeDev → takes frozen path', async () => {
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: { tests: '1.0.0' } });
    const getVersions = vi.fn();

    await smartInstall(spinner, { core: '^2.0.0' }, { tests: '^1.0.0' }, REGISTRY, getVersions, { includeDev: true });

    expect(spinner.succeed).toHaveBeenCalledWith('Using frozen lock file');
    expect(getVersions).not.toHaveBeenCalled();
  });

  test('lock covers prod but not dev, includeDev:true → takes resolve path', async () => {
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });
    const getVersions = makeRegistry(
      mod('core', { '2.0.0': {} }),
      mod('tests', { '1.0.0': {} })
    );

    await smartInstall(spinner, { core: '^2.0.0' }, { tests: '^1.0.0' }, REGISTRY, getVersions, { includeDev: true });

    expect(spinner.start).toHaveBeenCalledWith('Resolving module dependencies');
  });

  test('lock covers prod but not dev, includeDev:false → takes frozen path (dev not checked)', async () => {
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });
    const getVersions = vi.fn();

    await smartInstall(spinner, { core: '^2.0.0' }, { tests: '^1.0.0' }, REGISTRY, getVersions, { includeDev: false });

    expect(spinner.succeed).toHaveBeenCalledWith('Using frozen lock file');
    expect(getVersions).not.toHaveBeenCalled();
  });

  test('returns resolvedProd and resolvedDev from the frozen path', async () => {
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });

    const result = await smartInstall(spinner, { core: '^2.0.0' }, {}, REGISTRY, vi.fn());

    expect(result).toMatchObject({ resolvedProd: { core: '2.0.0' }, resolvedDev: {} });
  });

  test('returns resolvedProd and resolvedDev from the resolve path', async () => {
    // No lock file — takes resolve path
    const getVersions = makeRegistry(mod('core', { '2.0.0': {} }));

    const result = await smartInstall(spinner, { core: '^2.0.0' }, {}, REGISTRY, getVersions);

    expect(result).toHaveProperty('resolvedProd');
    expect(result).toHaveProperty('resolvedDev');
  });

  test('frozen path returns path: "frozen"', async () => {
    writeLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });

    const result = await smartInstall(spinner, { core: '^2.0.0' }, {}, REGISTRY, vi.fn());

    expect(result.path).toBe('frozen');
  });

  test('resolve path returns path: "resolved"', async () => {
    // No lock file — takes resolve path
    const getVersions = makeRegistry(mod('core', { '2.0.0': {} }));

    const result = await smartInstall(spinner, { core: '^2.0.0' }, {}, REGISTRY, getVersions);

    expect(result.path).toBe('resolved');
  });
});

// ---------------------------------------------------------------------------
// frozenInstall — version constraint satisfaction validation
// ---------------------------------------------------------------------------

describe('frozenInstall — constraint validation', () => {
  const { writeLock: writeLocalLock } = makeFileHelpers(getTmpDir);
  beforeEach(() => vi.clearAllMocks());

  test('succeeds when locked version satisfies manifest range constraint', async () => {
    writeLocalLock({ dependencies: { core: '2.1.0' }, devDependencies: {} });

    await expect(
      frozenInstall(spinner, { core: '^2.0.0' }, {})
    ).resolves.toMatchObject({ resolvedProd: { core: '2.1.0' } });
  });

  test('throws when locked version does not satisfy manifest range constraint', async () => {
    writeLocalLock({ dependencies: { core: '1.5.0' }, devDependencies: {} });

    await expect(
      frozenInstall(spinner, { core: '^2.0.0' }, {})
    ).rejects.toThrow(/version constraint mismatch.*core is locked at 1\.5\.0 which does not satisfy \^2\.0\.0/);
  });

  test('throws mentioning all mismatched constraints, not just the first', async () => {
    writeLocalLock({ dependencies: { core: '1.5.0', user: '3.0.0' }, devDependencies: {} });

    await expect(
      frozenInstall(spinner, { core: '^2.0.0', user: '^5.0.0' }, {})
    ).rejects.toThrow(/core.*user|user.*core/);
  });

  test('passes when manifest uses an exact pin and lock matches exactly', async () => {
    writeLocalLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });

    await expect(
      frozenInstall(spinner, { core: '2.0.0' }, {})
    ).resolves.toMatchObject({ resolvedProd: { core: '2.0.0' } });
  });

  test('throws with hint to run install when constraint is violated', async () => {
    writeLocalLock({ dependencies: { core: '1.0.0' }, devDependencies: {} });

    await expect(
      frozenInstall(spinner, { core: '^2.0.0' }, {})
    ).rejects.toThrow(/Run pos-cli modules install/);
  });
});

// ---------------------------------------------------------------------------
// `downloaded` field — names of modules actually fetched this run.
// This is what install.js feeds to printPostInstallMessages, so the contents
// (not just the presence of the key) matter.
// ---------------------------------------------------------------------------

describe('downloaded field', () => {
  const { writeLock: writeDownloadedLock } = makeFileHelpers(getTmpDir);
  beforeEach(() => vi.clearAllMocks());

  test('resolve path reports the keys of modulesToDownload', async () => {
    // No lock → resolve path. modulesToDownload decides what is actually fetched.
    modulesToDownload.mockReturnValue({ core: '2.0.0', user: '5.0.0' });
    const getVersions = makeRegistry(
      mod('core', { '2.0.0': {} }),
      mod('user', { '5.0.0': {} })
    );

    const result = await smartInstall(spinner, { core: '^2.0.0', user: '^5.0.0' }, {}, REGISTRY, getVersions);

    expect(result.downloaded).toEqual(['core', 'user']);
  });

  test('resolve path reports [] when nothing needs downloading (all up to date)', async () => {
    modulesToDownload.mockReturnValue({}); // everything already on disk at the right version
    const getVersions = makeRegistry(mod('core', { '2.0.0': {} }));

    const result = await smartInstall(spinner, { core: '^2.0.0' }, {}, REGISTRY, getVersions);

    expect(result.downloaded).toEqual([]);
  });

  test('frozen path reports the keys of modulesNotOnDisk', async () => {
    writeDownloadedLock({ dependencies: { core: '2.0.0' }, devDependencies: {} });
    modulesNotOnDisk.mockReturnValueOnce({ core: '2.0.0' });

    const result = await frozenInstall(spinner, { core: '^2.0.0' }, {});

    expect(result.downloaded).toEqual(['core']);
  });
});
