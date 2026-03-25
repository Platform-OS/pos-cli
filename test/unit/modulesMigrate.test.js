/**
 * Unit tests for pos-cli modules migrate
 * Tests the migration logic by importing migrateModuleManifest from the library.
 */
import { describe, test, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

import { withTmpDir } from '#test/utils/withTmpDir.js';
import { makeFileHelpers } from '#test/utils/fileHelpers.js';

const getTmpDir = withTmpDir('pos-cli-migrate-test-');

// migrate.js is dynamically imported inside tests so each test gets a fresh module
// with the updated process.cwd(). Reset modules after each test to clear the cache.
afterEach(() => vi.resetModules());

const { writeLegacyManifest, writeLegacyLock, writeManifest, writeTemplateValues, writeAppManifest } = makeFileHelpers(getTmpDir);

const writeRootTemplateValues = (content) =>
  fs.writeFileSync(path.join(getTmpDir(), 'template-values.json'), JSON.stringify(content, null, 2));

const runMigration = async (opts = {}) => {
  const { migrateModuleManifest } = await import('#lib/modules/migrate.js');
  return migrateModuleManifest(opts);
};

// ---------------------------------------------------------------------------
// migrateLegacyManifest — existing behavior (unchanged)
// ---------------------------------------------------------------------------

describe('modules migrate — migrateLegacyManifest', () => {
  test('returns nothing_to_migrate when no app/pos-modules.json and no template-values.json', async () => {
    const result = await runMigration();
    expect(result.status).toBe('nothing_to_migrate');
    expect(fs.existsSync(path.join(getTmpDir(), 'pos-module.json'))).toBe(false);
  });

  test('skips migrateLegacyManifest and returns nothing_to_migrate when pos-module.json already exists (no template-values.json)', async () => {
    writeManifest({ dependencies: {} });
    writeLegacyManifest({ modules: { core: '2.0.6' } });
    const result = await runMigration();
    expect(result.status).toBe('nothing_to_migrate');
    // Original pos-module.json must be unchanged
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written.dependencies).toEqual({});
  });

  test('migrates modules key → dependencies in pos-module.json', async () => {
    writeLegacyManifest({ modules: { core: '2.0.6', user: '5.1.2' } });
    await runMigration();
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written.dependencies).toEqual({ core: '2.0.6', user: '5.1.2' });
  });

  test('preserves repository_url from legacy manifest when non-default', async () => {
    writeLegacyManifest({ repository_url: 'https://custom.example.com', modules: {} });
    await runMigration();
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written.repository_url).toBe('https://custom.example.com');
  });

  test('omits repository_url from migrated manifest when it equals the default', async () => {
    writeLegacyManifest({ repository_url: 'https://partners.platformos.com', modules: {} });
    await runMigration();
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written).not.toHaveProperty('repository_url');
  });

  test('omits repository_url from migrated manifest when legacy manifest had none', async () => {
    writeLegacyManifest({ modules: {} });
    await runMigration();
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written).not.toHaveProperty('repository_url');
  });

  test('merges name/machine_name/version from single modules/*/template-values.json', async () => {
    writeLegacyManifest({ modules: { core: '2.0.6' } });
    writeTemplateValues('user', { name: 'User', machine_name: 'user', version: '5.1.2', type: 'module', dependencies: { core: '^1.0.0' } });
    await runMigration();
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written.name).toBe('User');
    expect(written.machine_name).toBe('user');
    expect(written.version).toBe('5.1.2');
    // type and dependencies from template-values.json are not copied (not metadata keys)
    expect(written.type).toBeUndefined();
  });

  test('does not merge metadata when multiple modules/*/template-values.json found', async () => {
    writeLegacyManifest({ modules: { core: '2.0.6' } });
    writeTemplateValues('user', { machine_name: 'user', version: '5.0.0' });
    writeTemplateValues('core', { machine_name: 'core', version: '2.0.6' });
    await runMigration();
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written.machine_name).toBeUndefined();
  });

  test('migrates lock file: flat modules → { dependencies, devDependencies:{} }', async () => {
    writeLegacyManifest({ modules: {} });
    writeLegacyLock({ repository_url: 'https://partners.platformos.com', modules: { core: '2.0.6', user: '5.1.2' } });
    await runMigration();
    const lock = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.lock.json'), 'utf8'));
    expect(lock.dependencies).toEqual({ core: '2.0.6', user: '5.1.2' });
    expect(lock.devDependencies).toEqual({});
  });

  test('removes app/pos-modules.json after migration', async () => {
    writeLegacyManifest({ modules: { core: '2.0.6' } });
    await runMigration();
    expect(fs.existsSync(path.join(getTmpDir(), 'app', 'pos-modules.json'))).toBe(false);
  });

  test('removes app/pos-modules.lock.json after migration', async () => {
    writeLegacyManifest({ modules: {} });
    writeLegacyLock({ modules: { core: '2.0.6' } });
    await runMigration();
    expect(fs.existsSync(path.join(getTmpDir(), 'app', 'pos-modules.lock.json'))).toBe(false);
  });

  test('handles missing lock file gracefully (only manifest migrated)', async () => {
    writeLegacyManifest({ modules: { core: '2.0.6' } });
    // no lock file
    const result = await runMigration();
    expect(result.status).toBe('migrated');
    expect(fs.existsSync(path.join(getTmpDir(), 'pos-module.lock.json'))).toBe(false);
    expect(fs.existsSync(path.join(getTmpDir(), 'pos-module.json'))).toBe(true);
  });
});

describe('modules migrate — migrateLegacyManifest error recovery', () => {
  test('returns { status: error } and sets process.exitCode=1 when writeFileSync throws', async () => {
    writeLegacyManifest({ modules: { core: '2.0.6' } });
    const origWrite = fs.writeFileSync;
    fs.writeFileSync = () => { throw new Error('ENOSPC: no space left on device'); };
    const originalExitCode = process.exitCode;
    try {
      const result = await runMigration();
      expect(result.status).toBe('error');
      expect(process.exitCode).toBe(1);
    } finally {
      fs.writeFileSync = origWrite;
      process.exitCode = originalExitCode;
    }
  });

  test('does not remove legacy files when writing the new manifest fails', async () => {
    writeLegacyManifest({ modules: { core: '2.0.6' } });
    const origWrite = fs.writeFileSync;
    fs.writeFileSync = () => { throw new Error('disk full'); };
    try {
      await runMigration();
    } catch (_) { /* expected */ } finally {
      fs.writeFileSync = origWrite;
    }
    expect(fs.existsSync(path.join(getTmpDir(), 'app', 'pos-modules.json'))).toBe(true);
  });

  test('old files are not removed until after all new files are confirmed written', async () => {
    writeLegacyManifest({ modules: {} });
    writeLegacyLock({ modules: {} });
    let writeCallCount = 0;
    const origWrite = fs.writeFileSync;
    fs.writeFileSync = (...args) => {
      writeCallCount++;
      // Let the first write (manifest) succeed; fail the second (lock file)
      if (writeCallCount >= 2) throw new Error('second write fails');
      origWrite(...args);
    };
    try {
      await runMigration();
    } catch (_) { /* expected */ } finally {
      fs.writeFileSync = origWrite;
    }
    // Lock file write failed — old lock file must not have been removed
    expect(fs.existsSync(path.join(getTmpDir(), 'app', 'pos-modules.lock.json'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// promoteTemplateValues — template-values.json metadata migration (new)
// ---------------------------------------------------------------------------

describe('modules migrate — promoteTemplateValues (from root template-values.json)', () => {
  test('creates pos-module.json from root template-values.json when pos-module.json absent (Scenario B)', async () => {
    writeRootTemplateValues({ machine_name: 'user', version: '5.1.2', name: 'User' });
    const result = await runMigration();
    expect(result.status).toBe('migrated');
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest.machine_name).toBe('user');
    expect(manifest.version).toBe('5.1.2');
    expect(manifest.name).toBe('User');
  });

  test('deletes root template-values.json when it becomes empty after metadata migration', async () => {
    writeRootTemplateValues({ machine_name: 'user', version: '5.1.2' });
    await runMigration();
    expect(fs.existsSync(path.join(getTmpDir(), 'template-values.json'))).toBe(false);
  });

  test('retains root template-values.json when it contains custom (non-metadata) fields', async () => {
    writeRootTemplateValues({ machine_name: 'user', version: '5.1.2', prefix: 'myapp', namespace: 'ns' });
    await runMigration();
    expect(fs.existsSync(path.join(getTmpDir(), 'template-values.json'))).toBe(true);
    const tv = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'template-values.json'), 'utf8'));
    expect(tv.prefix).toBe('myapp');
    expect(tv.namespace).toBe('ns');
    expect(tv.machine_name).toBeUndefined();
    expect(tv.version).toBeUndefined();
  });

  test('migrates all four metadata fields: machine_name, version, name, repository_url', async () => {
    writeRootTemplateValues({
      machine_name: 'user',
      version: '5.1.2',
      name: 'User',
      repository_url: 'https://partners.platformos.com'
    });
    await runMigration();
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest.machine_name).toBe('user');
    expect(manifest.version).toBe('5.1.2');
    expect(manifest.name).toBe('User');
    expect(manifest.repository_url).toBe('https://partners.platformos.com');
  });

  test('merges into existing pos-module.json without overwriting pre-set fields (Scenario C)', async () => {
    writeManifest({ machine_name: 'user', version: '5.2.0', dependencies: { core: '^1.0.0' } });
    writeRootTemplateValues({ machine_name: 'other', version: '5.1.2', name: 'User' });
    await runMigration();
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    // Pre-existing fields must not be overwritten
    expect(manifest.machine_name).toBe('user');
    expect(manifest.version).toBe('5.2.0');
    // New field (name) is added
    expect(manifest.name).toBe('User');
    // Structural fields preserved
    expect(manifest.dependencies).toEqual({ core: '^1.0.0' });
  });

  test('does not overwrite machine_name already in pos-module.json', async () => {
    writeManifest({ machine_name: 'existing' });
    writeRootTemplateValues({ machine_name: 'from-tv', version: '1.0.0' });
    await runMigration();
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest.machine_name).toBe('existing');
    expect(manifest.version).toBe('1.0.0');
  });

  test('skips promoteTemplateValues when template-values.json has no metadata fields', async () => {
    writeManifest({ machine_name: 'user', version: '5.0.0' });
    writeRootTemplateValues({ prefix: 'myapp', custom_param: 'value' });
    const result = await runMigration();
    expect(result.status).toBe('nothing_to_migrate');
    // template-values.json must be untouched
    const tv = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'template-values.json'), 'utf8'));
    expect(tv.prefix).toBe('myapp');
  });

  test('returns nothing_to_migrate when no relevant files exist', async () => {
    const result = await runMigration();
    expect(result.status).toBe('nothing_to_migrate');
  });
});

describe('modules migrate — promoteTemplateValues (from modules/*/template-values.json)', () => {
  test('extracts metadata from modules/${name}/template-values.json when no root template-values.json', async () => {
    writeTemplateValues('user', { machine_name: 'user', version: '5.1.2', name: 'User' });
    const result = await runMigration();
    expect(result.status).toBe('migrated');
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest.machine_name).toBe('user');
    expect(manifest.version).toBe('5.1.2');
    expect(manifest.name).toBe('User');
  });

  test('strips metadata fields from modules/*/template-values.json after migration', async () => {
    writeTemplateValues('user', { machine_name: 'user', version: '5.1.2', prefix: 'myapp' });
    await runMigration();
    const tvPath = path.join(getTmpDir(), 'modules', 'user', 'template-values.json');
    expect(fs.existsSync(tvPath)).toBe(true);
    const tv = JSON.parse(fs.readFileSync(tvPath, 'utf8'));
    expect(tv.prefix).toBe('myapp');
    expect(tv.machine_name).toBeUndefined();
    expect(tv.version).toBeUndefined();
  });

  test('deletes modules/*/template-values.json when it becomes empty after stripping', async () => {
    writeTemplateValues('user', { machine_name: 'user', version: '5.1.2' });
    await runMigration();
    const tvPath = path.join(getTmpDir(), 'modules', 'user', 'template-values.json');
    expect(fs.existsSync(tvPath)).toBe(false);
  });

  test('errors when multiple modules/*/template-values.json have metadata and no --name given', async () => {
    writeTemplateValues('user', { machine_name: 'user', version: '5.0.0' });
    writeTemplateValues('core', { machine_name: 'core', version: '2.0.6' });
    const result = await runMigration();
    expect(result.status).toBe('error');
  });

  test('--name targets a specific modules/${name}/template-values.json when multiple exist', async () => {
    writeTemplateValues('user', { machine_name: 'user', version: '5.0.0' });
    writeTemplateValues('core', { machine_name: 'core', version: '2.0.6' });
    const result = await runMigration({ name: 'user' });
    expect(result.status).toBe('migrated');
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest.machine_name).toBe('user');
  });

  test('root template-values.json takes priority over modules/*/template-values.json for promoteTemplateValues source', async () => {
    writeRootTemplateValues({ machine_name: 'from-root', version: '1.0.0' });
    writeTemplateValues('user', { machine_name: 'from-module', version: '5.0.0' });
    await runMigration();
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest.machine_name).toBe('from-root');
  });
});

describe('modules migrate — promoteTemplateValues edge cases', () => {
  test('multiple modules/*/template-values.json with no metadata fields → silent skip (no error)', async () => {
    // Only metadata-bearing files trigger promoteTemplateValues; custom-only files must be ignored
    writeTemplateValues('user', { prefix: 'myapp' });
    writeTemplateValues('core', { namespace: 'core_ns' });
    const result = await runMigration();
    expect(result.status).toBe('nothing_to_migrate');
  });

  test('--name targeting a file that does not exist → nothing_to_migrate (no error)', async () => {
    // User mistypes the module name; should not crash
    const result = await runMigration({ name: 'nonexistent' });
    expect(result.status).toBe('nothing_to_migrate');
  });

  test('cleans up modules/*/template-values.json left with only { type: "module" } after prior migration', async () => {
    // Simulates re-running migrate on a project where metadata was already moved to pos-module.json
    // but type: "module" was left behind by the old migrate implementation.
    writeManifest({ machine_name: 'user', version: '5.1.2', name: 'User' });
    writeTemplateValues('user', { type: 'module' });
    const result = await runMigration();
    expect(result.status).toBe('migrated');
    const tvPath = path.join(getTmpDir(), 'modules', 'user', 'template-values.json');
    expect(fs.existsSync(tvPath)).toBe(false);
    // pos-module.json must be unchanged
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest).not.toHaveProperty('type');
    expect(manifest.machine_name).toBe('user');
  });

  test('cleans up root template-values.json left with only { type: "module" }', async () => {
    writeManifest({ machine_name: 'user', version: '5.1.2' });
    writeRootTemplateValues({ type: 'module' });
    const result = await runMigration();
    expect(result.status).toBe('migrated');
    expect(fs.existsSync(path.join(getTmpDir(), 'template-values.json'))).toBe(false);
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest).not.toHaveProperty('type');
  });

  test('type is stripped but genuine custom fields alongside it are retained', async () => {
    writeManifest({ machine_name: 'user', version: '5.1.2' });
    writeTemplateValues('user', { type: 'module', prefix: 'myapp' });
    await runMigration();
    const tvPath = path.join(getTmpDir(), 'modules', 'user', 'template-values.json');
    expect(fs.existsSync(tvPath)).toBe(true);
    const tv = JSON.parse(fs.readFileSync(tvPath, 'utf8'));
    expect(tv).toEqual({ prefix: 'myapp' });
  });
});

describe('modules migrate — migrateLegacyManifest + promoteTemplateValues combined', () => {
  test('migrateLegacyManifest and promoteTemplateValues both run when both triggers are present', async () => {
    writeLegacyManifest({ modules: { core: '2.0.6' } });
    writeTemplateValues('user', { machine_name: 'user', version: '5.1.2' });
    const result = await runMigration();
    expect(result.status).toBe('migrated');
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest.dependencies).toEqual({ core: '2.0.6' });
    expect(manifest.machine_name).toBe('user');
    expect(manifest.version).toBe('5.1.2');
  });

  test('promoteTemplateValues deletes TV file after migrateLegacyManifest already copied its metadata', async () => {
    // migrateLegacyManifest copies machine_name/version from TV into pos-module.json.
    // promoteTemplateValues then runs, finds those fields already present (skips them),
    // strips the metadata from TV, and deletes TV since it is now empty.
    writeLegacyManifest({ modules: { core: '2.0.6' } });
    writeTemplateValues('user', { machine_name: 'user', version: '5.1.2' }); // metadata only
    await runMigration();
    const tvPath = path.join(getTmpDir(), 'modules', 'user', 'template-values.json');
    expect(fs.existsSync(tvPath)).toBe(false);
  });

  test('promoteTemplateValues retains TV file when it has custom fields alongside metadata', async () => {
    writeLegacyManifest({ modules: { core: '2.0.6' } });
    writeTemplateValues('user', { machine_name: 'user', version: '5.1.2', prefix: 'myapp' });
    await runMigration();
    const tvPath = path.join(getTmpDir(), 'modules', 'user', 'template-values.json');
    expect(fs.existsSync(tvPath)).toBe(true);
    const tv = JSON.parse(fs.readFileSync(tvPath, 'utf8'));
    expect(tv.prefix).toBe('myapp');
    expect(tv.machine_name).toBeUndefined();
    expect(tv.version).toBeUndefined();
  });

  test('promoteTemplateValues runs even when migrateLegacyManifest skips (pos-module.json already exists)', async () => {
    writeManifest({ dependencies: { core: '^1.0.0' } });
    writeLegacyManifest({ modules: { core: '2.0.6' } }); // migrateLegacyManifest will skip
    writeRootTemplateValues({ machine_name: 'user', version: '5.1.2' }); // promoteTemplateValues trigger
    const result = await runMigration();
    expect(result.status).toBe('migrated');
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    // migrateLegacyManifest skipped — original deps preserved
    expect(manifest.dependencies).toEqual({ core: '^1.0.0' });
    // promoteTemplateValues ran — metadata added
    expect(manifest.machine_name).toBe('user');
    expect(manifest.version).toBe('5.1.2');
  });
});

// ---------------------------------------------------------------------------
// promoteTemplateValues with --name — dependencies + devDependencies migration
// ---------------------------------------------------------------------------

describe('modules migrate — promoteTemplateValues with --name (deps + devDeps migration)', () => {
  test('migrates dependencies from template-values.json into pos-module.json', async () => {
    writeTemplateValues('user', {
      name: 'User', machine_name: 'user', version: '5.1.2',
      dependencies: { core: '^1.5.0', 'common-styling': '^1.11.0' }
    });
    const result = await runMigration({ name: 'user' });
    expect(result.status).toBe('migrated');
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest.dependencies).toEqual({ core: '^1.5.0', 'common-styling': '^1.11.0' });
  });

  test('derives devDependencies from app/pos-modules.json (legacy), excluding module itself and prod deps', async () => {
    writeTemplateValues('user', {
      name: 'User', machine_name: 'user', version: '5.1.2',
      dependencies: { core: '^1.5.0', 'common-styling': '^1.11.0' }
    });
    writeLegacyManifest({ modules: {
      user: '5.1.2',
      core: '2.0.6',
      'common-styling': '1.11.0',
      tests: '1.0.1',
      oauth_github: '0.0.9-beta'
    } });
    await runMigration({ name: 'user' });
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    // user (module itself) and core/common-styling (prod deps) are excluded
    expect(manifest.devDependencies).toEqual({ tests: '1.0.1', oauth_github: '0.0.9-beta' });
    expect(manifest.devDependencies).not.toHaveProperty('user');
    expect(manifest.devDependencies).not.toHaveProperty('core');
    expect(manifest.devDependencies).not.toHaveProperty('common-styling');
  });

  test('uses devDependencies from app/pos-module.json (new format) when present', async () => {
    writeTemplateValues('user', {
      name: 'User', machine_name: 'user', version: '5.1.2',
      dependencies: { core: '^1.5.0' }
    });
    writeAppManifest({ devDependencies: { tests: '1.0.1' } });
    // also write legacy to ensure new format takes priority
    writeLegacyManifest({ modules: { user: '5.1.2', core: '2.0.6', tests: '1.0.1', extra: '0.1.0' } });
    await runMigration({ name: 'user' });
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    // new format devDependencies used as-is, not derived from legacy
    expect(manifest.devDependencies).toEqual({ tests: '1.0.1' });
    expect(manifest.devDependencies).not.toHaveProperty('extra');
  });

  test('uses devDependencies already present in template-values.json without looking at app manifest', async () => {
    writeTemplateValues('user', {
      name: 'User', machine_name: 'user', version: '5.1.2',
      dependencies: { core: '^1.5.0' },
      devDependencies: { tests: '1.0.1' }
    });
    writeLegacyManifest({ modules: { user: '5.1.2', core: '2.0.6', tests: '1.0.1', extra: '0.1.0' } });
    await runMigration({ name: 'user' });
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    // devDependencies from template-values.json used; extra from legacy not included
    expect(manifest.devDependencies).toEqual({ tests: '1.0.1' });
    expect(manifest.devDependencies).not.toHaveProperty('extra');
  });

  test('creates pos-module.json without devDependencies when no app manifest exists', async () => {
    writeTemplateValues('user', {
      name: 'User', machine_name: 'user', version: '5.1.2',
      dependencies: { core: '^1.5.0' }
    });
    await runMigration({ name: 'user' });
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest.dependencies).toEqual({ core: '^1.5.0' });
    expect(manifest).not.toHaveProperty('devDependencies');
  });

  test('creates pos-module.json without devDependencies when app/pos-modules.json has no modules key', async () => {
    writeTemplateValues('user', {
      name: 'User', machine_name: 'user', version: '5.1.2',
      dependencies: { core: '^1.5.0' }
    });
    writeLegacyManifest({});  // valid JSON but no modules key
    await runMigration({ name: 'user' });
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest.dependencies).toEqual({ core: '^1.5.0' });
    expect(manifest).not.toHaveProperty('devDependencies');
  });

  test('strips deprecated type field alongside metadata and deps; deletes TV file when nothing remains', async () => {
    writeTemplateValues('user', {
      name: 'User', machine_name: 'user', version: '5.1.2', type: 'module',
      dependencies: { core: '^1.5.0' }
    });
    await runMigration({ name: 'user' });
    const tvPath = path.join(getTmpDir(), 'modules', 'user', 'template-values.json');
    // all fields are either migrated or deprecated — file must be deleted
    expect(fs.existsSync(tvPath)).toBe(false);
  });

  test('strips deprecated type field but retains genuine custom fields', async () => {
    writeTemplateValues('user', {
      name: 'User', machine_name: 'user', version: '5.1.2', type: 'module',
      dependencies: { core: '^1.5.0' }, prefix: 'myapp'
    });
    await runMigration({ name: 'user' });
    const tvPath = path.join(getTmpDir(), 'modules', 'user', 'template-values.json');
    expect(fs.existsSync(tvPath)).toBe(true);
    const tv = JSON.parse(fs.readFileSync(tvPath, 'utf8'));
    expect(tv.prefix).toBe('myapp');
    expect(tv).not.toHaveProperty('type');
    expect(tv).not.toHaveProperty('machine_name');
    expect(tv).not.toHaveProperty('version');
    expect(tv).not.toHaveProperty('name');
    expect(tv).not.toHaveProperty('dependencies');
  });

  test('deletes template-values.json when only migratable fields remain after stripping', async () => {
    writeTemplateValues('user', {
      name: 'User', machine_name: 'user', version: '5.1.2',
      dependencies: { core: '^1.5.0' }
    });
    await runMigration({ name: 'user' });
    const tvPath = path.join(getTmpDir(), 'modules', 'user', 'template-values.json');
    expect(fs.existsSync(tvPath)).toBe(false);
  });

  test('does not overwrite existing dependencies already in pos-module.json', async () => {
    writeManifest({ dependencies: { core: '^2.0.0' } });
    writeTemplateValues('user', {
      name: 'User', machine_name: 'user', version: '5.1.2',
      dependencies: { core: '^1.5.0' }
    });
    await runMigration({ name: 'user' });
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    // pre-existing dependencies not overwritten
    expect(manifest.dependencies).toEqual({ core: '^2.0.0' });
  });

  test('full module dev repo migration: pos-module-user scenario', async () => {
    // Mirrors the actual pos-module-user repository layout
    writeTemplateValues('user', {
      name: 'User', machine_name: 'user', type: 'module', version: '5.1.2',
      dependencies: { core: '^1.5.0', 'common-styling': '^1.11.0' }
    });
    writeLegacyManifest({ modules: {
      user: '4.1.0',
      tests: '1.0.1',
      core: '2.0.6',
      oauth_github: '0.0.9-beta',
      'common-styling': '1.11.0'
    } });
    const result = await runMigration({ name: 'user' });
    expect(result.status).toBe('migrated');
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest.name).toBe('User');
    expect(manifest.machine_name).toBe('user');
    expect(manifest.version).toBe('5.1.2');
    expect(manifest.dependencies).toEqual({ core: '^1.5.0', 'common-styling': '^1.11.0' });
    expect(manifest.devDependencies).toEqual({ tests: '1.0.1', oauth_github: '0.0.9-beta' });
    // type is deprecated — must not be promoted and TV file must be deleted (nothing left)
    expect(manifest).not.toHaveProperty('type');
    const tvPath = path.join(getTmpDir(), 'modules', 'user', 'template-values.json');
    expect(fs.existsSync(tvPath)).toBe(false);
  });
});
