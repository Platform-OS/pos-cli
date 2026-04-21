/**
 * Unit tests for `pos-cli modules version` — process exit code and file write behaviour.
 * Spawns the CLI in a temp directory to verify exit codes and manifest mutations.
 * All tests use --no-git to avoid requiring a git repository.
 */
import { describe, test, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { withTmpDir } from '#test/utils/withTmpDir.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.join(__dirname, '../../bin/pos-cli.js');

const getTmpDir = withTmpDir('pos-cli-version-test-');

const writeManifest = (content) =>
  fs.writeFileSync(path.join(getTmpDir(), 'pos-module.json'), JSON.stringify(content, null, 2));

const writeTemplateValues = (moduleName, content) => {
  const dir = path.join(getTmpDir(), 'modules', moduleName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'template-values.json'), JSON.stringify(content, null, 2));
};

const readManifest = () =>
  JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));

const readTemplateValues = (moduleName) =>
  JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'modules', moduleName, 'template-values.json'), 'utf8'));

const templateValuesPath = (moduleName) =>
  path.join(getTmpDir(), 'modules', moduleName, 'template-values.json');

const runVersion = (args = '') =>
  spawnSync('node', [CLI_PATH, 'modules', 'version', '--no-git', ...args.split(' ').filter(Boolean)], {
    cwd: getTmpDir(),
    encoding: 'utf8',
    stdio: 'pipe'
  });

describe('pos-cli modules version — exit codes', () => {
  test('exits with code 1 when the new version is lower than the current version', () => {
    writeManifest({ machine_name: 'user', version: '2.0.0' });
    const result = runVersion('1.0.0');
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/greater than/i);
  });

  test('exits with code 1 when the new version is equal to the current version', () => {
    writeManifest({ machine_name: 'user', version: '2.0.0' });
    const result = runVersion('2.0.0');
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/greater than/i);
  });

  test('exits with code 1 when the version argument is not valid semver', () => {
    writeManifest({ machine_name: 'user', version: '1.0.0' });
    const result = runVersion('not-a-version');
    expect(result.status).toBe(1);
  });

  test('exits with code 0 and writes the new version on a valid increment', () => {
    writeManifest({ machine_name: 'user', version: '5.1.2' });
    const result = runVersion('5.2.0');
    expect(result.status).toBe(0);
    expect(readManifest().version).toBe('5.2.0');
  });

  test('exits with code 1 and shows migration hint when pos-module.json is absent', () => {
    const result = runVersion('1.1.0');
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/pos-module\.json not found|modules migrate/i);
  });

  test('preserves other fields in pos-module.json when updating version', () => {
    writeManifest({ machine_name: 'user', name: 'User Module', version: '2.0.0', dependencies: { core: '^1.0.0' } });
    runVersion('2.1.0');
    const written = readManifest();
    expect(written.machine_name).toBe('user');
    expect(written.name).toBe('User Module');
    expect(written.dependencies).toEqual({ core: '^1.0.0' });
    expect(written.version).toBe('2.1.0');
  });
});

describe('pos-cli modules version — semver bump types', () => {
  test('defaults to patch bump when no argument is given', () => {
    writeManifest({ machine_name: 'user', version: '1.2.3' });
    const result = runVersion();
    expect(result.status).toBe(0);
    expect(readManifest().version).toBe('1.2.4');
  });

  test('bumps patch when "patch" is passed', () => {
    writeManifest({ machine_name: 'user', version: '1.2.3' });
    const result = runVersion('patch');
    expect(result.status).toBe(0);
    expect(readManifest().version).toBe('1.2.4');
  });

  test('bumps minor when "minor" is passed', () => {
    writeManifest({ machine_name: 'user', version: '1.2.3' });
    const result = runVersion('minor');
    expect(result.status).toBe(0);
    expect(readManifest().version).toBe('1.3.0');
  });

  test('bumps major when "major" is passed', () => {
    writeManifest({ machine_name: 'user', version: '1.2.3' });
    const result = runVersion('major');
    expect(result.status).toBe(0);
    expect(readManifest().version).toBe('2.0.0');
  });

  test('still accepts an explicit semver version', () => {
    writeManifest({ machine_name: 'user', version: '1.0.0' });
    const result = runVersion('3.0.0');
    expect(result.status).toBe(0);
    expect(readManifest().version).toBe('3.0.0');
  });
});

describe('pos-cli modules version — template-values.json sync', () => {
  test('updates version in modules/<machine_name>/template-values.json when it has a version field', () => {
    writeManifest({ machine_name: 'user', version: '5.2.7' });
    writeTemplateValues('user', {
      name: 'User',
      machine_name: 'user',
      type: 'module',
      version: '5.2.7',
      dependencies: { core: '^2.1.8' }
    });
    const result = runVersion('patch');
    expect(result.status).toBe(0);
    expect(readManifest().version).toBe('5.2.8');
    const tv = readTemplateValues('user');
    expect(tv.version).toBe('5.2.8');
    expect(tv.name).toBe('User');
    expect(tv.dependencies).toEqual({ core: '^2.1.8' });
  });

  test('does not create template-values.json when it does not exist', () => {
    writeManifest({ machine_name: 'user', version: '1.0.0' });
    const result = runVersion('patch');
    expect(result.status).toBe(0);
    expect(readManifest().version).toBe('1.0.1');
    expect(fs.existsSync(templateValuesPath('user'))).toBe(false);
  });

  test('does not modify template-values.json when it has no version field', () => {
    writeManifest({ machine_name: 'user', version: '1.0.0' });
    writeTemplateValues('user', { prefix: 'my_prefix' });
    const result = runVersion('major');
    expect(result.status).toBe(0);
    expect(readManifest().version).toBe('2.0.0');
    expect(readTemplateValues('user')).toEqual({ prefix: 'my_prefix' });
  });

  test('updates template-values.json with explicit semver version too', () => {
    writeManifest({ machine_name: 'user', version: '1.0.0' });
    writeTemplateValues('user', { version: '1.0.0' });
    const result = runVersion('5.0.0');
    expect(result.status).toBe(0);
    expect(readManifest().version).toBe('5.0.0');
    expect(readTemplateValues('user').version).toBe('5.0.0');
  });
});
