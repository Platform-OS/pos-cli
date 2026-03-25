/**
 * Unit tests for `pos-cli modules version` — process exit code and file write behaviour.
 * Spawns the CLI in a temp directory to verify exit codes and manifest mutations.
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

const runVersion = (args) =>
  spawnSync('node', [CLI_PATH, 'modules', 'version', ...args.split(' ').filter(Boolean)], {
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
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written.version).toBe('5.2.0');
  });

  test('writes to pos-module.json when it is present (not template-values.json)', () => {
    writeManifest({ machine_name: 'user', version: '1.0.0' });
    // Write a template-values.json alongside — version must NOT update it
    fs.writeFileSync(path.join(getTmpDir(), 'template-values.json'), JSON.stringify({ machine_name: 'user', version: '1.0.0' }, null, 2));
    runVersion('1.1.0');
    const manifest = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(manifest.version).toBe('1.1.0');
    // template-values.json must remain unchanged
    const tv = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'template-values.json'), 'utf8'));
    expect(tv.version).toBe('1.0.0');
  });

  test('exits with code 1 and shows migration hint when pos-module.json is absent', () => {
    // No pos-module.json — should fail with a clear migration hint
    const result = runVersion('1.1.0');
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/pos-module\.json not found|modules migrate/i);
  });

  test('preserves other fields in pos-module.json when updating version', () => {
    writeManifest({ machine_name: 'user', name: 'User Module', version: '2.0.0', dependencies: { core: '^1.0.0' } });
    runVersion('2.1.0');
    const written = JSON.parse(fs.readFileSync(path.join(getTmpDir(), 'pos-module.json'), 'utf8'));
    expect(written.machine_name).toBe('user');
    expect(written.name).toBe('User Module');
    expect(written.dependencies).toEqual({ core: '^1.0.0' });
    expect(written.version).toBe('2.1.0');
  });
});
