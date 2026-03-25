import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { modulesToDownload, downloadModule, downloadAllModules } from '#lib/modules/downloadModule.js';

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Error: vi.fn(), Info: vi.fn(), Warn: vi.fn(), Success: vi.fn() }
}));

vi.mock('#lib/portal.js', () => ({
  default: { moduleVersionsSearch: vi.fn() }
}));

vi.mock('#lib/downloadFile.js', () => ({
  default: vi.fn()
}));

vi.mock('#lib/unzip.js', () => ({
  unzip: vi.fn()
}));

// modulesToDownload checks process.cwd()/modules/<name> for directory existence.
// Tests use a temporary directory to control what's "on disk" without side effects.
describe('modulesToDownload', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-test-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns empty object when the locked set is empty', () => {
    expect(modulesToDownload({}, {})).toEqual({});
  });

  test('includes a module when it is new (not in previous lock)', () => {
    const result = modulesToDownload({ core: '2.0.6' }, {});
    expect(result).toEqual({ core: '2.0.6' });
  });

  test('includes a module when its version changed', () => {
    const result = modulesToDownload({ core: '2.0.7' }, { core: '2.0.6' });
    expect(result).toEqual({ core: '2.0.7' });
  });

  test('includes a module when version matches but directory is missing from disk', () => {
    // modules/core does not exist in tmpDir
    const result = modulesToDownload({ core: '2.0.6' }, { core: '2.0.6' });
    expect(result).toEqual({ core: '2.0.6' });
  });

  test('skips a module when version matches and directory exists on disk', () => {
    fs.mkdirSync(path.join(tmpDir, 'modules', 'core'), { recursive: true });

    const result = modulesToDownload({ core: '2.0.6' }, { core: '2.0.6' });
    expect(result).toEqual({});
  });

  test('handles a mix: skips up-to-date, includes changed or missing', () => {
    // core: up-to-date and on disk → skip
    // user: version bumped → download
    // tests: version matches but directory missing → download
    fs.mkdirSync(path.join(tmpDir, 'modules', 'core'), { recursive: true });

    const locked   = { core: '2.0.6', user: '5.1.3', tests: '1.2.0' };
    const previous = { core: '2.0.6', user: '5.1.2', tests: '1.2.0' };

    const result = modulesToDownload(locked, previous);
    expect(result).toEqual({ user: '5.1.3', tests: '1.2.0' });
  });

  test('includes all modules when previous lock is empty (first install)', () => {
    fs.mkdirSync(path.join(tmpDir, 'modules', 'core'), { recursive: true });

    // Even though core directory exists, no previous lock → treat as fresh install
    const result = modulesToDownload({ core: '2.0.6', user: '5.1.2' }, {});
    expect(result).toEqual({ core: '2.0.6', user: '5.1.2' });
  });

  test('skips all modules when every version matches and every directory exists', () => {
    fs.mkdirSync(path.join(tmpDir, 'modules', 'core'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'modules', 'user'), { recursive: true });

    const modules = { core: '2.0.6', user: '5.1.2' };
    const result = modulesToDownload(modules, modules);
    expect(result).toEqual({});
  });
});

// downloadModule downloads a single module archive and extracts it.
// Uses mocked Portal, downloadFile, and unzip to avoid real network/filesystem ops.
describe('downloadModule', () => {
  let tmpDir;
  let originalCwd;
  let Portal;
  let downloadFile;
  let unzip;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-test-'));
    process.chdir(tmpDir);

    Portal = (await import('#lib/portal.js')).default;
    downloadFile = (await import('#lib/downloadFile.js')).default;
    unzip = (await import('#lib/unzip.js')).unzip;

    vi.clearAllMocks();
    Portal.moduleVersionsSearch.mockResolvedValue({ public_archive: 'https://example.com/core-2.0.6.zip' });
    downloadFile.mockResolvedValue(undefined);
    unzip.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
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
    fs.mkdirSync(path.join(tmpDir, 'modules', 'core'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'modules', 'core', 'old-file.txt'), 'old');

    await downloadModule('core', '2.0.6');

    // unzip was called, meaning the old directory was removed and download proceeded
    expect(unzip).toHaveBeenCalled();
    // The old directory should be gone (removed before download, not re-created by mock)
    expect(fs.existsSync(path.join(tmpDir, 'modules', 'core', 'old-file.txt'))).toBe(false);
  });
});

// downloadAllModules iterates all modules and calls downloadModule for each.
describe('downloadAllModules', () => {
  let Portal;
  let downloadFile;
  let unzip;

  beforeEach(async () => {
    Portal = (await import('#lib/portal.js')).default;
    downloadFile = (await import('#lib/downloadFile.js')).default;
    unzip = (await import('#lib/unzip.js')).unzip;

    vi.clearAllMocks();
    Portal.moduleVersionsSearch.mockResolvedValue({ public_archive: 'https://example.com/module.zip' });
    downloadFile.mockResolvedValue(undefined);
    unzip.mockResolvedValue(undefined);
  });

  test('calls downloadModule for each module in the map', async () => {
    await downloadAllModules({ core: '2.0.6', user: '5.1.2' }, 'https://custom.registry.example.com');

    expect(Portal.moduleVersionsSearch).toHaveBeenCalledTimes(2);
    expect(Portal.moduleVersionsSearch).toHaveBeenCalledWith('core@2.0.6', 'https://custom.registry.example.com');
    expect(Portal.moduleVersionsSearch).toHaveBeenCalledWith('user@5.1.2', 'https://custom.registry.example.com');
  });

  test('propagates error from first failing module and stops', async () => {
    const err = new Error('Not Found');
    err.statusCode = 404;
    Portal.moduleVersionsSearch.mockRejectedValue(err);

    await expect(
      downloadAllModules({ core: '2.0.6', user: '5.1.2' })
    ).rejects.toThrow('core@2.0.6: 404 not found');

    // Only one call because sequential execution stops on first error
    expect(Portal.moduleVersionsSearch).toHaveBeenCalledTimes(1);
  });

  test('passes registryUrl to every download call', async () => {
    await downloadAllModules(
      { core: '2.0.6', user: '5.1.2', tests: '1.0.0' },
      'https://custom.registry.example.com'
    );

    for (const call of Portal.moduleVersionsSearch.mock.calls) {
      expect(call[1]).toBe('https://custom.registry.example.com');
    }
  });
});
