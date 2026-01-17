import 'dotenv/config';
import { describe, test, expect } from 'vitest';
import exec from './utils/exec';
import cliPath from './utils/cliPath';
import fs from 'fs';
import path from 'path';
import { hasRealCredentials, requireRealCredentials } from './utils/credentials';

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', name);

const run = async (fixtureName, options) => await exec(`${cliPath} modules download ${options}`, { cwd: cwd(fixtureName), env: process.env });

describe('Successful download', () => {
  test('download test module in the correct version', async () => {
    requireRealCredentials();
    const pathToModuleJson = `${cwd('deploy/modules_test')}/modules/tests/template-values.json`;
    const pathToDirectory = `${cwd('deploy/modules_test')}/modules`;

    const { stdout } = await run('deploy/modules_test', 'tests');
    expect(stdout).toContain('Downloading tests@0.0.3');
    expect(fs.existsSync(pathToModuleJson)).toBeTruthy();

    const moduleJson = JSON.parse(fs.readFileSync(pathToModuleJson, 'utf8'));
    expect(moduleJson.version).toBe('0.0.3');

    await fs.promises.rm(pathToDirectory, { recursive: true });
  });

  test('clean up removed files', async () => {
    const pathToModuleLeftoverFile = `${cwd('deploy/modules_test_with_old_files')}/modules/tests/private/leftover.txt`;
    expect(fs.existsSync(pathToModuleLeftoverFile)).toBeTruthy();
    const pathToModuleJson = `${cwd('deploy/modules_test_with_old_files')}/modules/tests/template-values.json`;
    const pathToDirectory = `${cwd('deploy/modules_test_with_old_files')}/modules`;

    const { stdout } = await run('deploy/modules_test_with_old_files', 'tests');
    expect(stdout).toContain('Downloading tests@0.0.3');
    expect(fs.existsSync(pathToModuleJson)).toBeTruthy();
    expect(fs.existsSync(pathToModuleLeftoverFile)).toBeFalsy();

    await fs.promises.rm(pathToDirectory, { recursive: true });

    fs.mkdirSync(path.dirname(pathToModuleLeftoverFile), { recursive: true });
    fs.writeFileSync(pathToModuleLeftoverFile, 'Hello');
    expect(fs.existsSync(pathToModuleLeftoverFile)).toBeTruthy();
  });

  test('download test module in a specific version', async () => {
    const pathToModuleJson = `${cwd('deploy/modules_test')}/modules/tests/template-values.json`;
    const pathToDirectory = `${cwd('deploy/modules_test')}/modules`;

    const { stdout } = await run('deploy/modules_test', 'tests@1.0.0');
    expect(stdout).toContain('Downloading tests@1.0.0');
    expect(fs.existsSync(pathToModuleJson)).toBeTruthy();

    const moduleJson = JSON.parse(fs.readFileSync(pathToModuleJson, 'utf8'));
    expect(moduleJson.version).toBe('1.0.0');

    await fs.promises.rm(pathToDirectory, { recursive: true });
  });

  test('download the latest test module if no app/pos-modules.lock.json', async () => {
    const pathToModuleJson = `${cwd('deploy/empty')}/modules/tests/template-values.json`;
    const pathToDirectory = `${cwd('deploy/empty')}/modules`;

    const { stdout, stderr } = await run('deploy/empty', 'tests');
    expect(stdout).toContain('Downloading tests...');
    expect(stderr).toContain('Warning: Can\'t find app/pos-modules.lock.json');
    expect(fs.existsSync(pathToModuleJson)).toBeTruthy();

    await fs.promises.rm(pathToDirectory, { recursive: true });
  });

  test('download user module with dependencies', async () => {
    const pathToUserModuleJson = `${cwd('deploy/modules_user')}/modules/user/template-values.json`;
    const pathToCoreModuleJson = `${cwd('deploy/modules_user')}/modules/core/template-values.json`;
    const pathToDirectory = `${cwd('deploy/modules_user')}/modules`;

    const { stdout: stdout1 } = await run('deploy/modules_user', 'user');
    expect(stdout1).toContain('Downloading user@3.0.8');
    expect(fs.existsSync(pathToUserModuleJson)).toBeTruthy();
    expect(stdout1).toContain('Downloading core@1.5.5');
    expect(fs.existsSync(pathToCoreModuleJson)).toBeTruthy();

    const userModuleJson = JSON.parse(fs.readFileSync(pathToUserModuleJson, 'utf8'));
    expect(userModuleJson.version).toBe('3.0.8');
    const coreModuleJson = JSON.parse(fs.readFileSync(pathToCoreModuleJson, 'utf8'));
    expect(coreModuleJson.version).toBe('1.5.5');

    const { stdout: stdout2 } = await run('deploy/modules_user', 'user');
    expect(stdout2).toContain('Downloading user@3.0.8');
    expect(stdout2).not.toContain('Downloading core@1.5.5');

    const { stdout: stdout3 } = await run('deploy/modules_user', 'user --force-dependencies');
    expect(stdout3).toContain('Downloading user@3.0.8');
    expect(stdout3).toContain('Downloading core@1.5.5');

    await fs.promises.rm(pathToDirectory, { recursive: true });
  }, 20000);
});

describe('Failed download', () => {
  test('Module not found - non-existing module', async () => {
    const { stderr } = await run('deploy/modules_test', 'moduleNotFound');
    expect(stderr).toContain('moduleNotFound: 404 not found');
  });
  test('Module not found - no name for module', async () => {
    const { stderr } = await run('deploy/modules_test', '');
    expect(stderr).toMatch("error: missing required argument 'module'");
  });
  test('Unescaped characters in request path', async () => {
    const { stderr } = await run('deploy/modules_test', 'ąę');
    expect(stderr).toMatch('404 not found');
  });
});
