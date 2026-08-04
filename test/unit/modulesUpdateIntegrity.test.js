/**
 * End-to-end integrity tests for `pos-cli modules install/update`.
 *
 * Unlike the other module unit tests these drive real zip archives through the real
 * unzip and the real filesystem — only the registry HTTP calls are faked. They exist
 * because the failure they guard against is invisible to mocked-extraction tests: a
 * module directory whose manifest reports the target version while its contents are
 * incomplete is treated as up-to-date forever, so every later install and update
 * silently skips it and the app deploys stale code.
 */
import { describe, test, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import glob from 'fast-glob';
import prepareArchive from '#lib/prepareArchive.js';
import { withTmpDir } from '#test/utils/withTmpDir.js';
import { makeFileHelpers } from '#test/utils/fileHelpers.js';
import { makeSpinner } from '#test/utils/spinnerMock.js';
import { mod, makeRegistry } from '#test/utils/moduleRegistry.js';

// Fake registry archives: "name@version" -> zip path on disk.
const archives = new Map();

vi.mock('#lib/portal.js', () => ({
  default: {
    moduleVersionsSearch: vi.fn(async (nameWithVersion) => {
      const archive = archives.get(nameWithVersion);
      if (!archive) {
        const error = new Error('Not Found');
        error.statusCode = 404;
        throw error;
      }
      return { public_archive: `file://${archive}` };
    }),
    moduleVersions: vi.fn(),
  },
}));

// Serves the fake archives from disk instead of over HTTP.
vi.mock('#lib/downloadFile.js', () => ({
  default: vi.fn(async (url, dest) => {
    await fs.promises.copyFile(url.replace('file://', ''), dest);
  }),
}));

const { updateModules } = await import('#lib/modules/update.js');
const { installModules } = await import('#lib/modules/install.js');
const { writePosModulesLock, readPosModulesLock } = await import('#lib/modules/configFiles.js');
const registry = await import('#lib/modules/registry.js');

const REGISTRY = 'https://partners.platformos.com';
const spinner = makeSpinner();

/**
 * Publishes a zip to the fake registry, laid out the way `pos-cli modules push` builds it.
 * `root` overrides the archive's root directory, which is normally the module name.
 */
const publish = async (name, version, files, root = name) => {
  const zipPath = path.join(os.tmpdir(), `pos-cli-test-${name}-${version}-${process.pid}.zip`);
  const archive = prepareArchive(zipPath);
  archive.addBuffer(Buffer.from(JSON.stringify({ machine_name: name, version })), `${root}/pos-module.json`);
  for (const [rel, content] of Object.entries(files)) {
    archive.addBuffer(Buffer.from(content), `${root}/${rel}`);
  }
  archive.finalize();
  await archive.done;
  archives.set(`${name}@${version}`, zipPath);
};

const useRegistry = (...modules) =>
  vi.spyOn(registry, 'createGetVersions').mockReturnValue(makeRegistry(...modules));

const readManifest = () => JSON.parse(fs.readFileSync('pos-module.json', 'utf8'));

/** Writes a module to disk as a completed install would leave it. */
const installed = (name, version, files = {}) => {
  const dir = path.join(process.cwd(), 'modules', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'pos-module.json'), JSON.stringify({ machine_name: name, version }));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
};

/** Sorted list of files inside modules/<name>, or null when it does not exist. */
const filesOf = (name) => {
  const dir = path.join(process.cwd(), 'modules', name);
  if (!fs.existsSync(dir)) return null;
  return glob.sync('**/*', { cwd: dir, onlyFiles: true, dot: true }).sort();
};

const fileHelpers = makeFileHelpers(withTmpDir('pos-cli-update-integrity-'));
const writeManifest = (dependencies) => fileHelpers.writeManifest({ dependencies });

describe('modules update — resolution and download', () => {
  test('bumps a range dependency and installs the files the new version adds', async () => {
    await publish('core', '1.0.0', { 'public/views/old.liquid': 'old' });
    await publish('core', '1.1.0', { 'public/views/old.liquid': 'old', 'public/views/new.liquid': 'new' });
    useRegistry(mod('core', { '1.0.0': {}, '1.1.0': {} }));

    writeManifest({ core: '^1.0.0' });
    writePosModulesLock({ core: '1.0.0' }, {}, { core: REGISTRY });
    installed('core', '1.0.0', { 'public/views/old.liquid': 'old' });

    await updateModules(spinner, 'core');

    expect(readPosModulesLock().dependencies).toEqual({ core: '1.1.0' });
    expect(filesOf('core')).toContain('public/views/new.liquid');
  });

  // The new version is moved into place, not merged over the old one: a file the new
  // version dropped would otherwise linger and keep being deployed.
  test('drops files the new version no longer ships', async () => {
    await publish('core', '1.0.0', { 'public/views/gone.liquid': 'gone', 'public/views/kept.liquid': 'kept' });
    await publish('core', '1.1.0', { 'public/views/kept.liquid': 'kept' });
    useRegistry(mod('core', { '1.0.0': {}, '1.1.0': {} }));

    writeManifest({ core: '^1.0.0' });
    writePosModulesLock({ core: '1.0.0' }, {}, { core: REGISTRY });
    installed('core', '1.0.0', { 'public/views/gone.liquid': 'gone', 'public/views/kept.liquid': 'kept' });

    await updateModules(spinner, 'core');

    expect(filesOf('core')).toEqual(['pos-module.json', 'public/views/kept.liquid']);
  });

  test('bumps an exact pin in the manifest and downloads the new version', async () => {
    await publish('core', '1.0.0', {});
    await publish('core', '1.1.0', { 'public/views/new.liquid': 'new' });
    useRegistry(mod('core', { '1.0.0': {}, '1.1.0': {} }));

    writeManifest({ core: '1.0.0' });
    writePosModulesLock({ core: '1.0.0' }, {}, { core: REGISTRY });
    installed('core', '1.0.0');

    await updateModules(spinner, 'core');

    expect(readManifest().dependencies).toEqual({ core: '1.1.0' });
    expect(filesOf('core')).toContain('public/views/new.liquid');
  });

  test('downloads a transitive dependency bumped behind an unchanged root range', async () => {
    await publish('core', '1.0.0', {});
    await publish('common', '1.0.0', {});
    await publish('common', '1.2.0', { 'public/views/new.liquid': 'new' });
    useRegistry(
      mod('core', { '1.0.0': { common: '^1.0.0' } }),
      mod('common', { '1.0.0': {}, '1.2.0': {} })
    );

    writeManifest({ core: '^1.0.0' });
    writePosModulesLock({ core: '1.0.0', common: '1.0.0' }, {}, { core: REGISTRY, common: REGISTRY });
    installed('core', '1.0.0');
    installed('common', '1.0.0');

    await updateModules(spinner, undefined, {});

    expect(readPosModulesLock().dependencies).toEqual({ core: '1.0.0', common: '1.2.0' });
    expect(filesOf('common')).toContain('public/views/new.liquid');
  });

  test('re-downloads a module the lock moved ahead of (e.g. after a git pull)', async () => {
    await publish('core', '1.1.0', { 'public/views/new.liquid': 'new' });
    useRegistry(mod('core', { '1.0.0': {}, '1.1.0': {} }));

    writeManifest({ core: '^1.0.0' });
    writePosModulesLock({ core: '1.1.0' }, {}, { core: REGISTRY });
    installed('core', '1.0.0', { 'public/views/old.liquid': 'old' });

    await installModules(spinner, undefined, {});

    expect(filesOf('core')).toEqual(['pos-module.json', 'public/views/new.liquid']);
  });
});

describe('modules update — install integrity', () => {
  test('an interrupted download never leaves a partially written module directory', async () => {
    // The archive is fine; extraction dies partway through, as it would on Ctrl-C,
    // a full disk, or a locked file on Windows.
    await publish('core', '1.1.0', { 'public/views/new.liquid': 'new' });
    useRegistry(mod('core', { '1.0.0': {}, '1.1.0': {} }));

    writeManifest({ core: '^1.0.0' });
    writePosModulesLock({ core: '1.0.0' }, {}, { core: REGISTRY });
    installed('core', '1.0.0', { 'public/views/old.liquid': 'old' });

    const unzipModule = await import('#lib/unzip.js');
    const realUnzip = unzipModule.unzip;
    const spy = vi.spyOn(unzipModule, 'unzip').mockImplementation(async (zipPath, dest) => {
      await realUnzip(zipPath, dest);
      throw new Error('Unexpected end of archive');
    });

    try {
      await expect(updateModules(spinner, 'core')).rejects.toThrow('Unexpected end of archive');
    } finally {
      spy.mockRestore();
    }

    // The installed module is untouched and still honestly reports 1.0.0, so the
    // next run knows it has work to do.
    expect(filesOf('core')).toEqual(['pos-module.json', 'public/views/old.liquid']);
    // The failed version was never recorded as installed.
    expect(readPosModulesLock().dependencies).toEqual({ core: '1.0.0' });

    // Re-running repairs it.
    await updateModules(spinner, 'core');
    expect(filesOf('core')).toEqual(['pos-module.json', 'public/views/new.liquid']);
    expect(readPosModulesLock().dependencies).toEqual({ core: '1.1.0' });
  });

  test('a failed download for one module does not record any module as installed', async () => {
    await publish('core', '1.1.0', { 'public/views/new.liquid': 'new' });
    // "broken" resolves in the registry but has no archive published.
    useRegistry(
      mod('core', { '1.0.0': {}, '1.1.0': {} }),
      mod('broken', { '1.0.0': {}, '1.1.0': {} })
    );

    writeManifest({ core: '^1.0.0', broken: '^1.0.0' });
    writePosModulesLock({ core: '1.0.0', broken: '1.0.0' }, {}, { core: REGISTRY, broken: REGISTRY });
    installed('core', '1.0.0', { 'public/views/old.liquid': 'old' });
    installed('broken', '1.0.0', { 'public/views/old.liquid': 'old' });

    await expect(updateModules(spinner, undefined, {})).rejects.toThrow(/broken@1\.1\.0: 404 not found/);

    // The lock still describes what is actually installed: core downloaded fine, but
    // recording broken@1.1.0 would make the next run believe the install completed.
    expect(readPosModulesLock().dependencies).toEqual({ core: '1.0.0', broken: '1.0.0' });
    expect(filesOf('broken')).toEqual(['pos-module.json', 'public/views/old.liquid']);
  });

  test('rejects an archive whose root directory does not match the module name', async () => {
    // Guards a silent wipe: the module directory used to be deleted and the archive's
    // differently-named root extracted alongside it, while the command reported success.
    await publish('core', '1.1.0', { 'public/views/new.liquid': 'new' }, 'pos-module-core');

    useRegistry(mod('core', { '1.0.0': {}, '1.1.0': {} }));
    writeManifest({ core: '^1.0.0' });
    writePosModulesLock({ core: '1.0.0' }, {}, { core: REGISTRY });
    installed('core', '1.0.0', { 'public/views/old.liquid': 'old' });

    await expect(updateModules(spinner, 'core')).rejects.toThrow(
      /archive does not contain a "core\/" directory/
    );

    expect(filesOf('core')).toEqual(['pos-module.json', 'public/views/old.liquid']);
    expect(fs.readdirSync(path.join(process.cwd(), 'modules'))).toEqual(['core']);
  });
});
