import 'dotenv/config';
import { describe, test, expect } from 'vitest';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';
import fs from 'fs';
import path from 'path';
import { requireRealCredentials, noCredentials, applyCredentials } from '#test/utils/credentials';

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', name);

const run = async (fixtureName, options) => await exec(`${cliPath} modules install ${options}`, { cwd: cwd(fixtureName), env: process.env });

describe('Successful install', () => {
  test('installs and downloads module in the locked version', async () => {
    requireRealCredentials();
    const pathToModuleJson = `${cwd('deploy/modules_test')}/modules/tests/template-values.json`;
    const pathToDirectory = `${cwd('deploy/modules_test')}/modules`;
    const lockFilePath = `${cwd('deploy/modules_test')}/app/pos-modules.lock.json`;
    const originalLockContent = fs.readFileSync(lockFilePath, 'utf8');

    try {
      const { stdout } = await run('deploy/modules_test', 'tests');
      expect(stdout).toContain('Downloading tests@0.0.3');
      expect(fs.existsSync(pathToModuleJson)).toBeTruthy();

      const moduleJson = JSON.parse(fs.readFileSync(pathToModuleJson, 'utf8'));
      expect(moduleJson.version).toBe('0.0.3');
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true });
      fs.writeFileSync(lockFilePath, originalLockContent);
    }
  });

  test('cleans up removed files when reinstalling', async () => {
    requireRealCredentials();
    const pathToModuleLeftoverFile = `${cwd('deploy/modules_test_with_old_files')}/modules/tests/private/leftover.txt`;
    expect(fs.existsSync(pathToModuleLeftoverFile)).toBeTruthy();
    const pathToModuleJson = `${cwd('deploy/modules_test_with_old_files')}/modules/tests/template-values.json`;
    const pathToDirectory = `${cwd('deploy/modules_test_with_old_files')}/modules`;
    const lockFilePath = `${cwd('deploy/modules_test_with_old_files')}/app/pos-modules.lock.json`;
    const originalLockContent = fs.readFileSync(lockFilePath, 'utf8');

    try {
      const { stdout } = await run('deploy/modules_test_with_old_files', 'tests');
      expect(stdout).toContain('Downloading tests@0.0.3');
      expect(fs.existsSync(pathToModuleJson)).toBeTruthy();
      expect(fs.existsSync(pathToModuleLeftoverFile)).toBeFalsy();
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true });
      fs.writeFileSync(lockFilePath, originalLockContent);

      fs.mkdirSync(path.dirname(pathToModuleLeftoverFile), { recursive: true });
      fs.writeFileSync(pathToModuleLeftoverFile, 'Hello');
      expect(fs.existsSync(pathToModuleLeftoverFile)).toBeTruthy();
    }
  });

  test('installs module in a specific version', async () => {
    requireRealCredentials();
    const posModulesPath = `${cwd('deploy/modules_test')}/app/pos-modules.json`;
    const lockFilePath = `${cwd('deploy/modules_test')}/app/pos-modules.lock.json`;
    const originalModulesContent = fs.readFileSync(posModulesPath, 'utf8');
    const originalLockContent = fs.readFileSync(lockFilePath, 'utf8');
    const pathToModuleJson = `${cwd('deploy/modules_test')}/modules/tests/template-values.json`;
    const pathToDirectory = `${cwd('deploy/modules_test')}/modules`;

    try {
      const { stdout } = await run('deploy/modules_test', 'tests@1.0.0');
      expect(stdout).toContain('Downloading tests@1.0.0');
      expect(fs.existsSync(pathToModuleJson)).toBeTruthy();

      const moduleJson = JSON.parse(fs.readFileSync(pathToModuleJson, 'utf8'));
      expect(moduleJson.version).toBe('1.0.0');
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true });
      fs.writeFileSync(posModulesPath, originalModulesContent);
      fs.writeFileSync(lockFilePath, originalLockContent);
    }
  });

  test('installs module with dependencies and downloads all', async () => {
    requireRealCredentials();
    const pathToUserModuleJson = `${cwd('deploy/modules_user')}/modules/user/template-values.json`;
    const pathToCoreModuleJson = `${cwd('deploy/modules_user')}/modules/core/template-values.json`;
    const pathToDirectory = `${cwd('deploy/modules_user')}/modules`;
    const lockFilePath = `${cwd('deploy/modules_user')}/app/pos-modules.lock.json`;
    const originalLockContent = fs.readFileSync(lockFilePath, 'utf8');

    try {
      const { stdout } = await run('deploy/modules_user', 'user');
      expect(stdout).toContain('Downloading user@');
      expect(stdout).toContain('Downloading core@');
      expect(fs.existsSync(pathToUserModuleJson)).toBeTruthy();
      expect(fs.existsSync(pathToCoreModuleJson)).toBeTruthy();
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true });
      fs.writeFileSync(lockFilePath, originalLockContent);
    }
  }, 30000);

  test('installs all modules from pos-modules.json when no name given', async () => {
    requireRealCredentials();
    const pathToModuleJson = `${cwd('deploy/modules_test')}/modules/tests/template-values.json`;
    const pathToDirectory = `${cwd('deploy/modules_test')}/modules`;
    const lockFilePath = `${cwd('deploy/modules_test')}/app/pos-modules.lock.json`;
    const originalLockContent = fs.readFileSync(lockFilePath, 'utf8');

    try {
      const { stdout } = await run('deploy/modules_test', '');
      expect(stdout).toContain('Downloading tests@0.0.3');
      expect(fs.existsSync(pathToModuleJson)).toBeTruthy();
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true });
      fs.writeFileSync(lockFilePath, originalLockContent);
    }
  });
});

describe('Failed install', () => {
  test('Module not found - non-existing module', async () => {
    const savedCreds = applyCredentials(noCredentials);
    const savedPortalHost = process.env.PARTNER_PORTAL_HOST;
    delete process.env.PARTNER_PORTAL_HOST;
    try {
      const { stdout } = await run('deploy/modules_test', 'moduleNotFound');
      expect(stdout).toContain("Can't find module moduleNotFound");
    } finally {
      applyCredentials(savedCreds);
      if (savedPortalHost) {
        process.env.PARTNER_PORTAL_HOST = savedPortalHost;
      }
    }
  });
});
