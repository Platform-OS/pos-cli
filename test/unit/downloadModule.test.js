import { describe, test, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  modulesToDownload,
  modulesNotOnDisk,
  readInstalledVersion,
  downloadModule,
  downloadAllModules,
} from '#lib/modules/downloadModule.js';
import { withTmpDir } from '#test/utils/withTmpDir.js';

vi.mock('#lib/portal.js', () => ({
  default: { moduleVersionsSearch: vi.fn() }
}));

vi.mock('#lib/downloadFile.js', () => ({
  default: vi.fn()
}));

vi.mock('#lib/unzip.js', () => ({
  unzip: vi.fn()
}));

// Simulates a previously-downloaded module by writing its manifest with a
// `version` field, mirroring what unzip actually leaves on disk. Defaults to
// pos-module.json (the current convention); pass file: 'template-values.json'
// to simulate a legacy-format module (version only in template-values.json,
// no pos-module.json at all — how many currently-published registry modules,
// e.g. real "core" releases, are actually laid out on disk today).
const writeInstalledManifest = (name, version, { file = 'pos-module.json', extra = {} } = {}) => {
  const dir = path.join(process.cwd(), 'modules', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), JSON.stringify({ machine_name: name, version, ...extra }, null, 2));
};

const installModuleOnDisk = (name, version, extra) => writeInstalledManifest(name, version, { extra });
const installLegacyModuleOnDisk = (name, version, extra) =>
  writeInstalledManifest(name, version, { file: 'template-values.json', extra });

// readInstalledVersion reads modules/<name>/pos-module.json's `version` field,
// falling back to modules/<name>/template-values.json for legacy modules.
describe('readInstalledVersion', () => {
  withTmpDir();

  test('returns null when the module directory does not exist', () => {
    expect(readInstalledVersion('core')).toBeNull();
  });

  test('returns null when the directory exists but neither manifest file is present', () => {
    fs.mkdirSync(path.join(process.cwd(), 'modules', 'core'), { recursive: true });
    expect(readInstalledVersion('core')).toBeNull();
  });

  test('returns null when pos-module.json exists but is not valid JSON, and no fallback exists', () => {
    fs.mkdirSync(path.join(process.cwd(), 'modules', 'core'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'modules', 'core', 'pos-module.json'), '{ not json');
    expect(readInstalledVersion('core')).toBeNull();
  });

  test('returns null when pos-module.json has no version field and no fallback exists', () => {
    installModuleOnDisk('core', undefined);
    // installModuleOnDisk writes version: undefined, which JSON.stringify drops entirely
    expect(readInstalledVersion('core')).toBeNull();
  });

  test('returns the version recorded in pos-module.json', () => {
    installModuleOnDisk('core', '2.0.6');
    expect(readInstalledVersion('core')).toBe('2.0.6');
  });

  // Regression test: real published modules on the registry (e.g. core@1.5.5)
  // predate the pos-module.json convention and only ship template-values.json.
  test('falls back to template-values.json when pos-module.json does not exist', () => {
    installLegacyModuleOnDisk('core', '1.5.5');
    expect(readInstalledVersion('core')).toBe('1.5.5');
  });

  test('falls back to template-values.json when pos-module.json has no version field', () => {
    const dir = path.join(process.cwd(), 'modules', 'core');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'pos-module.json'), JSON.stringify({ machine_name: 'core' }));
    fs.writeFileSync(path.join(dir, 'template-values.json'), JSON.stringify({ version: '1.5.5' }));
    expect(readInstalledVersion('core')).toBe('1.5.5');
  });

  test('prefers pos-module.json version over template-values.json when both are present', () => {
    installModuleOnDisk('core', '2.0.6');
    fs.writeFileSync(
      path.join(process.cwd(), 'modules', 'core', 'template-values.json'),
      JSON.stringify({ version: '1.5.5' })
    );
    expect(readInstalledVersion('core')).toBe('2.0.6');
  });

  test('returns null when template-values.json exists but is not valid JSON', () => {
    const dir = path.join(process.cwd(), 'modules', 'core');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'template-values.json'), '{ not json');
    expect(readInstalledVersion('core')).toBeNull();
  });

  test('returns null when template-values.json exists but has no version field', () => {
    const dir = path.join(process.cwd(), 'modules', 'core');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'template-values.json'), JSON.stringify({ machine_name: 'core' }));
    expect(readInstalledVersion('core')).toBeNull();
  });
});

// modulesToDownload checks the installed version of each module on disk against
// the newly resolved version, not just directory existence.
describe('modulesToDownload', () => {
  withTmpDir();

  test('returns empty object when the locked set is empty', () => {
    expect(modulesToDownload({}, {})).toEqual({});
  });

  test('includes a module when it is new (not in previous lock)', () => {
    const result = modulesToDownload({ core: '2.0.6' }, {});
    expect(result).toEqual({ core: '2.0.6' });
  });

  test('includes a module when its version changed', () => {
    installModuleOnDisk('core', '2.0.6');
    const result = modulesToDownload({ core: '2.0.7' }, { core: '2.0.6' });
    expect(result).toEqual({ core: '2.0.7' });
  });

  test('includes a module when version matches but directory is missing from disk', () => {
    // modules/core does not exist in tmpDir
    const result = modulesToDownload({ core: '2.0.6' }, { core: '2.0.6' });
    expect(result).toEqual({ core: '2.0.6' });
  });

  test('skips a module when version matches and the installed module is at that version', () => {
    installModuleOnDisk('core', '2.0.6');

    const result = modulesToDownload({ core: '2.0.6' }, { core: '2.0.6' });
    expect(result).toEqual({});
  });

  // Regression test for the bug where `pos-cli modules install` silently did nothing
  // even though a module's lock version had moved on: the module directory existed
  // (from an older install) but its content was still at the old version.
  test('includes a module when the lock version is unchanged but the on-disk module is stale', () => {
    installModuleOnDisk('chat', '1.3.4');

    const result = modulesToDownload({ chat: '2.0.2' }, { chat: '2.0.2' });
    expect(result).toEqual({ chat: '2.0.2' });
  });

  test('handles a mix: skips up-to-date, includes changed, missing, or stale', () => {
    // core: up-to-date and installed at the right version → skip
    // user: version bumped → download
    // tests: lock version matches but directory missing → download
    // chat: lock version matches but installed version is stale → download
    installModuleOnDisk('core', '2.0.6');
    installModuleOnDisk('chat', '1.3.4');

    const locked   = { core: '2.0.6', user: '5.1.3', tests: '1.2.0', chat: '2.0.2' };
    const previous = { core: '2.0.6', user: '5.1.2', tests: '1.2.0', chat: '2.0.2' };

    const result = modulesToDownload(locked, previous);
    expect(result).toEqual({ user: '5.1.3', tests: '1.2.0', chat: '2.0.2' });
  });

  test('includes all modules when previous lock is empty (first install)', () => {
    installModuleOnDisk('core', '2.0.6');

    // Even though core is installed at the target version, no previous lock → treat as fresh install
    const result = modulesToDownload({ core: '2.0.6', user: '5.1.2' }, {});
    expect(result).toEqual({ core: '2.0.6', user: '5.1.2' });
  });

  test('skips all modules when every version matches and every module is installed correctly', () => {
    installModuleOnDisk('core', '2.0.6');
    installModuleOnDisk('user', '5.1.2');

    const modules = { core: '2.0.6', user: '5.1.2' };
    const result = modulesToDownload(modules, modules);
    expect(result).toEqual({});
  });

  // Regression test: a transitive dependency already on disk in the legacy
  // template-values.json-only format (as real published modules like core are
  // laid out today) must be recognized as installed and skipped, not re-downloaded.
  test('skips a legacy-format module (version only in template-values.json) at the target version', () => {
    installLegacyModuleOnDisk('core', '1.5.5');

    const result = modulesToDownload({ core: '1.5.5' }, { core: '1.5.5' });
    expect(result).toEqual({});
  });
});

// modulesNotOnDisk checks the installed version of each module against the target
// version — used by frozenInstall (--frozen CI, and smartInstall's fast path) where
// there is no previous lock to diff against, only the current disk state.
describe('modulesNotOnDisk', () => {
  withTmpDir();

  test('returns empty object when the module set is empty', () => {
    expect(modulesNotOnDisk({})).toEqual({});
  });

  test('includes a module missing from disk entirely', () => {
    const result = modulesNotOnDisk({ core: '2.0.6' });
    expect(result).toEqual({ core: '2.0.6' });
  });

  test('skips a module installed at the target version', () => {
    installModuleOnDisk('core', '2.0.6');
    expect(modulesNotOnDisk({ core: '2.0.6' })).toEqual({});
  });

  // Regression test for the reported bug: modules/chat existed on disk at 1.3.4
  // while pos-module.lock.json recorded 2.0.2 — `pos-cli modules install` must
  // still redownload it instead of treating "directory exists" as "up to date".
  test('includes a module whose installed version does not match the target version', () => {
    installModuleOnDisk('chat', '1.3.4');

    const result = modulesNotOnDisk({ chat: '2.0.2' });
    expect(result).toEqual({ chat: '2.0.2' });
  });

  test('handles a mix of up-to-date, stale, and missing modules', () => {
    installModuleOnDisk('core', '2.0.6');
    installModuleOnDisk('chat', '1.3.4');

    const result = modulesNotOnDisk({ core: '2.0.6', chat: '2.0.2', user: '5.1.2' });
    expect(result).toEqual({ chat: '2.0.2', user: '5.1.2' });
  });

  // Regression test mirroring the real integration scenario: a transitive dep
  // (core) already installed in the legacy template-values.json-only format
  // must be recognized as up-to-date under --frozen / smartInstall's fast path.
  test('skips a legacy-format module (version only in template-values.json) at the target version', () => {
    installLegacyModuleOnDisk('core', '1.5.5');

    expect(modulesNotOnDisk({ core: '1.5.5' })).toEqual({});
  });
});

// downloadModule downloads a single module archive and extracts it.
// Uses mocked Portal, downloadFile, and unzip to avoid real network/filesystem ops.
describe('downloadModule', () => {
  withTmpDir();

  let Portal, downloadFile, unzip;

  beforeEach(async () => {
    Portal = (await import('#lib/portal.js')).default;
    downloadFile = (await import('#lib/downloadFile.js')).default;
    unzip = (await import('#lib/unzip.js')).unzip;

    Portal.moduleVersionsSearch.mockResolvedValue({ public_archive: 'https://example.com/core-2.0.6.zip' });
    downloadFile.mockResolvedValue(undefined);
    unzip.mockResolvedValue(undefined);
  });

  test('calls Portal.moduleVersionsSearch with name@version and registryUrl', async () => {
    await downloadModule('core', '2.0.6', 'https://custom.registry.example.com');

    expect(Portal.moduleVersionsSearch).toHaveBeenCalledWith(
      'core@2.0.6',
      'https://custom.registry.example.com'
    );
  });

  test('calls downloadFile with public_archive URL', async () => {
    await downloadModule('core', '2.0.6');

    expect(downloadFile).toHaveBeenCalledWith(
      'https://example.com/core-2.0.6.zip',
      expect.stringContaining('pos-module-core-')
    );
  });

  test('calls unzip to extract to modules/ directory', async () => {
    await downloadModule('core', '2.0.6');

    expect(unzip).toHaveBeenCalledWith(
      expect.any(String),
      path.join(process.cwd(), 'modules')
    );
  });

  test('throws formatted error message on 404', async () => {
    const err = new Error('Not Found');
    err.statusCode = 404;
    Portal.moduleVersionsSearch.mockRejectedValue(err);

    await expect(downloadModule('core', '2.0.6')).rejects.toThrow('core@2.0.6: 404 not found');
  });

  test('throws formatted error message for non-404 errors', async () => {
    Portal.moduleVersionsSearch.mockRejectedValue(new Error('Service Unavailable'));

    await expect(downloadModule('core', '2.0.6')).rejects.toThrow('core@2.0.6: Service Unavailable');
  });

  test('cleans up temp file in finally block even when an error is thrown', async () => {
    Portal.moduleVersionsSearch.mockRejectedValue(new Error('Service Unavailable'));
    const rmSpy = vi.spyOn(fs.promises, 'rm');

    await expect(downloadModule('core', '2.0.6')).rejects.toThrow();

    // The finally block must call fs.promises.rm on the temp file path (force: true).
    const cleanupCall = rmSpy.mock.calls.find(([p, opts]) =>
      typeof p === 'string' && p.includes('pos-module-core-') && opts?.force === true
    );
    expect(cleanupCall).toBeDefined();

    rmSpy.mockRestore();
  });

  test('removes old module directory before downloading', async () => {
    fs.mkdirSync(path.join(process.cwd(), 'modules', 'core'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'modules', 'core', 'old-file.txt'), 'old');

    await downloadModule('core', '2.0.6');

    // unzip was called, meaning the old directory was removed and download proceeded
    expect(unzip).toHaveBeenCalled();
    // The old directory should be gone (removed before download, not re-created by mock)
    expect(fs.existsSync(path.join(process.cwd(), 'modules', 'core', 'old-file.txt'))).toBe(false);
  });

  test('does NOT delete module directory when downloadFile fails', async () => {
    // Bug guard: rm must happen AFTER download, not before.
    // If download fails, the existing module directory must remain intact.
    fs.mkdirSync(path.join(process.cwd(), 'modules', 'core'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'modules', 'core', 'existing-file.txt'), 'keep me');
    downloadFile.mockRejectedValue(new Error('Network error'));

    await expect(downloadModule('core', '2.0.6')).rejects.toThrow('Network error');

    // The existing module directory must still be on disk
    expect(fs.existsSync(path.join(process.cwd(), 'modules', 'core', 'existing-file.txt'))).toBe(true);
  });

  test('does NOT delete module directory when Portal.moduleVersionsSearch fails', async () => {
    fs.mkdirSync(path.join(process.cwd(), 'modules', 'core'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'modules', 'core', 'existing-file.txt'), 'keep me');
    Portal.moduleVersionsSearch.mockRejectedValue(new Error('Service Unavailable'));

    await expect(downloadModule('core', '2.0.6')).rejects.toThrow('Service Unavailable');

    expect(fs.existsSync(path.join(process.cwd(), 'modules', 'core', 'existing-file.txt'))).toBe(true);
  });
});

// downloadAllModules iterates all modules and calls downloadModule for each.
describe('downloadAllModules', () => {
  let Portal, downloadFile, unzip;

  beforeEach(async () => {
    Portal = (await import('#lib/portal.js')).default;
    downloadFile = (await import('#lib/downloadFile.js')).default;
    unzip = (await import('#lib/unzip.js')).unzip;

    vi.clearAllMocks();
    Portal.moduleVersionsSearch.mockResolvedValue({ public_archive: 'https://example.com/module.zip' });
    downloadFile.mockResolvedValue(undefined);
    unzip.mockResolvedValue(undefined);
  });

  const REGISTRY = 'https://custom.registry.example.com';
  const getRegistryUrl = () => REGISTRY;

  test('calls downloadModule for each module in the map', async () => {
    await downloadAllModules({ core: '2.0.6', user: '5.1.2' }, getRegistryUrl);

    expect(Portal.moduleVersionsSearch).toHaveBeenCalledTimes(2);
    expect(Portal.moduleVersionsSearch).toHaveBeenCalledWith('core@2.0.6', REGISTRY);
    expect(Portal.moduleVersionsSearch).toHaveBeenCalledWith('user@5.1.2', REGISTRY);
  });

  test('rejects when any module download fails', async () => {
    const err = new Error('Not Found');
    err.statusCode = 404;
    Portal.moduleVersionsSearch.mockRejectedValue(err);

    await expect(
      downloadAllModules({ core: '2.0.6', user: '5.1.2' }, getRegistryUrl)
    ).rejects.toThrow(/404 not found/);

    // Promise.all starts all downloads concurrently, so both modules are queried
    expect(Portal.moduleVersionsSearch).toHaveBeenCalledTimes(2);
  });

  test('passes registryUrl to every download call', async () => {
    await downloadAllModules(
      { core: '2.0.6', user: '5.1.2', tests: '1.0.0' },
      getRegistryUrl
    );

    for (const call of Portal.moduleVersionsSearch.mock.calls) {
      expect(call[1]).toBe(REGISTRY);
    }
  });
});
