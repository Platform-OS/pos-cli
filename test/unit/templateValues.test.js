/**
 * Unit tests for loadSettingsFileForModule — template value resolution.
 *
 * Design: responsibilities are cleanly separated between the two files:
 *   pos-module.json       — module metadata (machine_name, version, name, …)
 *                           Scalar fields become the BASE of the template context so
 *                           templates can always reference machine_name/version without
 *                           duplication.
 *   template-values.json  — installation-specific parameters (prefix, custom config, …)
 *                           Layered ON TOP of the base, overriding where keys collide.
 *
 * This means a consuming app only needs to put CUSTOM params in template-values.json;
 * machine_name and version are always available from the module's own pos-module.json.
 *
 * Source priority for the pos-module.json base:
 *   1. modules/${name}/pos-module.json  — after `pos-cli modules install` (new format)
 *   2. root pos-module.json whose machine_name === module  — module repo dev workflow
 */
import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import { withTmpDir } from '#test/utils/withTmpDir.js';

const getTmpDir = withTmpDir('pos-cli-tv-test-');

// Helpers
const writeModuleFile = (moduleName, filename, content) => {
  const dir = path.join(getTmpDir(), 'modules', moduleName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(content, null, 2));
};

const writeRootManifest = (content) =>
  fs.writeFileSync(path.join(getTmpDir(), 'pos-module.json'), JSON.stringify(content, null, 2));

// loadSettingsFileForModule reads from cwd-relative paths so tests must run in tmpDir.
// withTmpDir already chdirs for us.
const getLoadFn = async () => {
  const { loadSettingsFileForModule } = await import('#lib/settings.js');
  return loadSettingsFileForModule;
};

// ---------------------------------------------------------------------------
// Core contract: merge semantics
// ---------------------------------------------------------------------------

describe('loadSettingsFileForModule — merge: pos-module.json base + template-values.json overlay', () => {
  test('when only template-values.json exists, returns its values as-is', async () => {
    writeModuleFile('core', 'template-values.json', { machine_name: 'core', version: '2.0.0', custom_key: 'legacy' });
    const load = await getLoadFn();
    expect(load('core')).toEqual({ machine_name: 'core', version: '2.0.0', custom_key: 'legacy' });
  });

  test('when only pos-module.json exists, its scalars become the template context', async () => {
    writeModuleFile('core', 'pos-module.json', { machine_name: 'core', version: '2.0.0', name: 'Core' });
    const load = await getLoadFn();
    expect(load('core')).toEqual({ machine_name: 'core', version: '2.0.0', name: 'Core' });
  });

  test('when both exist, pos-module.json scalars are base and template-values.json overlays on top', async () => {
    // The key consumer use case: add a custom "prefix" without repeating machine_name/version
    writeModuleFile('user', 'pos-module.json', { machine_name: 'user', version: '5.0.0' });
    writeModuleFile('user', 'template-values.json', { prefix: 'myapp' });
    const load = await getLoadFn();
    expect(load('user')).toEqual({ machine_name: 'user', version: '5.0.0', prefix: 'myapp' });
  });

  test('template-values.json can override a pos-module.json scalar when needed', async () => {
    writeModuleFile('core', 'pos-module.json', { machine_name: 'core', version: '2.0.0' });
    writeModuleFile('core', 'template-values.json', { machine_name: 'core-override', extra: 'yes' });
    const load = await getLoadFn();
    expect(load('core')).toEqual({ machine_name: 'core-override', version: '2.0.0', extra: 'yes' });
  });
});

// ---------------------------------------------------------------------------
// Structural fields in pos-module.json must be stripped before merging
// ---------------------------------------------------------------------------

describe('loadSettingsFileForModule — structural field stripping', () => {
  test('strips dependencies, devDependencies, registries — objects corrupt mustache output', async () => {
    writeModuleFile('core', 'pos-module.json', {
      machine_name: 'core',
      version: '2.0.0',
      dependencies: { user: '^5.0.0' },
      devDependencies: { tests: '1.0.1' },
      registries: { user: 'https://private.example.com' }
    });
    const load = await getLoadFn();
    const result = load('core');
    expect(result.machine_name).toBe('core');
    expect(result.version).toBe('2.0.0');
    expect(result.dependencies).toBeUndefined();
    expect(result.devDependencies).toBeUndefined();
    expect(result.registries).toBeUndefined();
  });

  test('preserves custom scalar fields alongside standard ones', async () => {
    writeModuleFile('core', 'pos-module.json', {
      machine_name: 'core',
      version: '2.0.0',
      name: 'Core Module',
      repository_url: 'https://partners.platformos.com'
    });
    const load = await getLoadFn();
    expect(load('core')).toEqual({
      machine_name: 'core',
      version: '2.0.0',
      name: 'Core Module',
      repository_url: 'https://partners.platformos.com'
    });
  });
});

// ---------------------------------------------------------------------------
// pos-module.json base source: module dir vs root (dev workflow)
// ---------------------------------------------------------------------------

describe('loadSettingsFileForModule — pos-module.json base source priority', () => {
  test('modules/${name}/pos-module.json takes precedence over root pos-module.json', async () => {
    writeModuleFile('user', 'pos-module.json', { machine_name: 'user', version: '5.0.0' });
    writeRootManifest({ machine_name: 'user', version: '9.9.9' });
    const load = await getLoadFn();
    expect(load('user').version).toBe('5.0.0');
  });

  test('falls back to root pos-module.json for module repo dev when machine_name matches', async () => {
    writeRootManifest({ machine_name: 'mymodule', version: '3.0.0', custom: 'root-value' });
    fs.mkdirSync(path.join(getTmpDir(), 'modules', 'mymodule'), { recursive: true });
    const load = await getLoadFn();
    expect(load('mymodule')).toEqual({ machine_name: 'mymodule', version: '3.0.0', custom: 'root-value' });
  });

  test('root pos-module.json dev workflow also merges with template-values.json', async () => {
    writeRootManifest({ machine_name: 'mymodule', version: '3.0.0', dependencies: { core: '^2.0.0' } });
    writeModuleFile('mymodule', 'template-values.json', { prefix: 'dev_prefix' });
    const load = await getLoadFn();
    expect(load('mymodule')).toEqual({ machine_name: 'mymodule', version: '3.0.0', prefix: 'dev_prefix' });
  });

  test('strips structural fields from root pos-module.json', async () => {
    writeRootManifest({
      machine_name: 'mymodule',
      version: '3.0.0',
      dependencies: { core: '^2.0.0' },
      devDependencies: { tests: '1.0.1' }
    });
    fs.mkdirSync(path.join(getTmpDir(), 'modules', 'mymodule'), { recursive: true });
    const load = await getLoadFn();
    const result = load('mymodule');
    expect(result.dependencies).toBeUndefined();
    expect(result.devDependencies).toBeUndefined();
  });

  test('does NOT use root pos-module.json when machine_name does not match', async () => {
    writeRootManifest({ machine_name: 'other-module', version: '1.0.0' });
    const load = await getLoadFn();
    expect(load('core')).toEqual({});
  });

  test('consuming app root pos-module.json is not used for installed module template values', async () => {
    // App has its own pos-module.json listing 'core' as a dep — should not leak into core's template context
    writeRootManifest({ machine_name: 'myapp', version: '1.0.0', dependencies: { core: '^2.0.0' } });
    const load = await getLoadFn();
    expect(load('core')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Fallback: no files → {}
// ---------------------------------------------------------------------------

describe('loadSettingsFileForModule — fallback', () => {
  test('returns {} when no files exist', async () => {
    const load = await getLoadFn();
    expect(load('core')).toEqual({});
  });

  test('returns {} when module dir exists but has no template file', async () => {
    fs.mkdirSync(path.join(getTmpDir(), 'modules', 'core'), { recursive: true });
    const load = await getLoadFn();
    expect(load('core')).toEqual({});
  });

  test('returns {} when root pos-module.json has no machine_name', async () => {
    writeRootManifest({ dependencies: { core: '^2.0.0' } });
    const load = await getLoadFn();
    expect(load('core')).toEqual({});
  });
});
