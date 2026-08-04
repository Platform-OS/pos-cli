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
import { getStagingBase } from '#lib/modules/staging.js';
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

// Staging directories are named `pos-cli-unpack-<moduleName>-<random>`; recover the
// module name so one unzip stub can serve a whole batch of concurrent downloads.
const moduleNameFromStagingDir = (dest) =>
  path.basename(dest).replace(/^pos-cli-unpack-/, '').replace(/-\w+$/, '');

/**
 * Stubs unzip the way the real one behaves: writing <dest>/<moduleName>/…
 * downloadModule verifies that root exists before it touches modules/<moduleName>,
 * so a no-op stub would (correctly) be rejected as a malformed archive.
 */
const extractsModule = (files = {}) => async (_zipPath, dest) => {
  const name = moduleNameFromStagingDir(dest);
  const root = path.join(dest, name);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'pos-module.json'), JSON.stringify({ machine_name: name }));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
};

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
    unzip.mockImplementation(extractsModule());
  });

  test('calls Portal.moduleVersionsSearch with name@version and registryUrl', async () => {
    await downloadModule('core', '2.0.6', 'https://custom.registry.example.com');

    expect(Portal.moduleVersionsSearch).toHaveBeenCalledWith(
      'core@2.0.6',
      'https://custom.registry.example.com'
    );
  });

  test('downloads the archive into the staging directory it is unzipped in', async () => {
    await downloadModule('core', '2.0.6');

    const [, dest] = unzip.mock.calls[0];
    expect(downloadFile).toHaveBeenCalledWith(
      'https://example.com/core-2.0.6.zip',
      path.join(dest, 'archive.zip')
    );
  });

  test('extracts to a staging directory outside modules/, never over the installed module', async () => {
    await downloadModule('core', '2.0.6');

    const [, dest] = unzip.mock.calls[0];
    expect(path.basename(dest)).toMatch(/^pos-cli-unpack-core-\w+$/);
    expect(path.dirname(dest)).toBe(getStagingBase());
    expect(getStagingBase().startsWith(path.join(process.cwd(), 'modules'))).toBe(false);
  });

  test('removes its staging directory on success', async () => {
    await downloadModule('core', '2.0.6');
    const [, dest] = unzip.mock.calls[0];

    expect(fs.existsSync(dest)).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'modules', 'core'))).toBe(true);
    expect(fs.readdirSync(path.join(process.cwd(), 'modules'))).toEqual(['core']);
  });

  test('removes its staging directory when the swap fails', async () => {
    unzip.mockImplementation(async (_zip, dest) => {
      fs.mkdirSync(path.join(dest, 'wrong-root'), { recursive: true });
    });

    await expect(downloadModule('core', '2.0.6')).rejects.toThrow();

    const [, dest] = unzip.mock.calls[0];
    expect(fs.existsSync(dest)).toBe(false);
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

  test('removes the downloaded archive with the staging directory when the download fails', async () => {
    downloadFile.mockImplementation(async (_url, dest) => {
      fs.writeFileSync(dest, 'partial');
      throw new Error('Network error');
    });

    await expect(downloadModule('core', '2.0.6')).rejects.toThrow('Network error');

    const [, archive] = downloadFile.mock.calls[0];
    expect(fs.existsSync(path.dirname(archive))).toBe(false);
  });

  test('replaces the old module directory wholesale — no leftovers from the old version', async () => {
    fs.mkdirSync(path.join(process.cwd(), 'modules', 'core'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'modules', 'core', 'old-file.txt'), 'old');
    unzip.mockImplementation(extractsModule({ 'new-file.txt': 'new' }));

    await downloadModule('core', '2.0.6');

    expect(fs.existsSync(path.join(process.cwd(), 'modules', 'core', 'old-file.txt'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'modules', 'core', 'new-file.txt'))).toBe(true);
  });

  test('rejects an archive whose root directory is not <moduleName>/ and keeps the installed module', async () => {
    fs.mkdirSync(path.join(process.cwd(), 'modules', 'core'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'modules', 'core', 'existing-file.txt'), 'keep me');
    unzip.mockImplementation(async (_zip, dest) => {
      fs.mkdirSync(path.join(dest, 'pos-module-core'), { recursive: true });
    });

    await expect(downloadModule('core', '2.0.6')).rejects.toThrow(
      /archive does not contain a "core\/" directory \(archive contains: pos-module-core\)/
    );

    // The previously installed module must survive a malformed archive untouched.
    expect(fs.existsSync(path.join(process.cwd(), 'modules', 'core', 'existing-file.txt'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'modules', 'pos-module-core'))).toBe(false);
  });

  test('does NOT delete the module directory when extraction fails midway', async () => {
    fs.mkdirSync(path.join(process.cwd(), 'modules', 'core'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'modules', 'core', 'existing-file.txt'), 'keep me');
    unzip.mockImplementation(async (_zip, dest) => {
      // Partial extraction: the manifest lands, then the process dies.
      const root = path.join(dest, 'core');
      fs.mkdirSync(root, { recursive: true });
      fs.writeFileSync(path.join(root, 'pos-module.json'), JSON.stringify({ version: '2.0.6' }));
      throw new Error('Unexpected end of archive');
    });

    await expect(downloadModule('core', '2.0.6')).rejects.toThrow('Unexpected end of archive');

    // The half-extracted tree must never reach modules/core — that is the state that
    // used to look up-to-date forever while missing files.
    expect(fs.existsSync(path.join(process.cwd(), 'modules', 'core', 'existing-file.txt'))).toBe(true);
    expect(readInstalledVersion('core')).toBeNull();
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
  withTmpDir();

  let Portal, downloadFile, unzip;

  beforeEach(async () => {
    Portal = (await import('#lib/portal.js')).default;
    downloadFile = (await import('#lib/downloadFile.js')).default;
    unzip = (await import('#lib/unzip.js')).unzip;

    vi.clearAllMocks();
    Portal.moduleVersionsSearch.mockResolvedValue({ public_archive: 'https://example.com/module.zip' });
    downloadFile.mockResolvedValue(undefined);
    unzip.mockImplementation(extractsModule());
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

    // downloads start concurrently, so both modules are queried
    expect(Portal.moduleVersionsSearch).toHaveBeenCalledTimes(2);
  });

  test('waits for every download to settle before rejecting — no work outlives the failure', async () => {
    // Bug guard: with Promise.all the command reported failure while sibling modules
    // were still being replaced on disk, so a Ctrl-C at the error prompt could leave a
    // module half-installed.
    let slowFinished = false;
    Portal.moduleVersionsSearch.mockImplementation(async (nameWithVersion) => {
      if (nameWithVersion.startsWith('broken')) throw new Error('Not Found');
      return { public_archive: 'https://example.com/module.zip' };
    });
    unzip.mockImplementation(async (zipPath, dest) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      await extractsModule()(zipPath, dest);
      slowFinished = true;
    });

    await expect(
      downloadAllModules({ core: '2.0.6', broken: '1.0.0' }, getRegistryUrl)
    ).rejects.toThrow('Not Found');

    expect(slowFinished).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'modules', 'core'))).toBe(true);
  });

  test('reports every failure, not just the first', async () => {
    Portal.moduleVersionsSearch.mockImplementation(async (nameWithVersion) => {
      throw new Error(`boom for ${nameWithVersion}`);
    });

    await expect(
      downloadAllModules({ core: '2.0.6', user: '5.1.2' }, getRegistryUrl)
    ).rejects.toThrow(/Failed to download 2 modules[\s\S]*core@2\.0\.6[\s\S]*user@5\.1\.2/);
  });

  test('removes the staging directory once all downloads settle', async () => {
    await downloadAllModules({ core: '2.0.6', user: '5.1.2' }, getRegistryUrl);

    expect(fs.readdirSync(path.join(process.cwd(), 'modules')).sort()).toEqual(['core', 'user']);
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
