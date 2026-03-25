import 'dotenv/config';
import { describe, test, expect } from 'vitest';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';
import fs from 'fs';
import path from 'path';
import { requireRealCredentials, noCredentials, applyCredentials, saveCredentials } from '#test/utils/credentials';
import { plainMessages } from '#test/utils/parseOutput';

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
      const msgs = plainMessages(stdout);
      expect(msgs.find(m => m.startsWith('Downloading tests@'))).toBe('Downloading tests@0.0.3...');
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
      const msgs = plainMessages(stdout);
      expect(msgs.find(m => m.startsWith('Downloading tests@'))).toBe('Downloading tests@0.0.3...');
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
      const msgs = plainMessages(stdout);
      expect(msgs.find(m => m.startsWith('Downloading tests@'))).toBe('Downloading tests@1.0.0...');
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
      const msgs = plainMessages(stdout);
      // user version is pinned in the fixture; core version is resolved from the registry
      expect(msgs.find(m => m.startsWith('Downloading user@'))).toBe('Downloading user@3.0.8...');
      expect(msgs.find(m => m.startsWith('Downloading core@'))).toMatch(/^Downloading core@\d+\.\d+\.\d+\.\.\.$/);
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
      const msgs = plainMessages(stdout);
      expect(msgs.find(m => m.startsWith('Downloading tests@'))).toBe('Downloading tests@0.0.3...');
      expect(fs.existsSync(pathToModuleJson)).toBeTruthy();
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true });
      fs.writeFileSync(lockFilePath, originalLockContent);
    }
  });

  test('skips re-downloading modules already at the locked version with files on disk', async () => {
    requireRealCredentials();
    const pathToDirectory = `${cwd('deploy/modules_test')}/modules`;
    const lockFilePath = `${cwd('deploy/modules_test')}/app/pos-modules.lock.json`;
    const originalLockContent = fs.readFileSync(lockFilePath, 'utf8');

    try {
      // First run: module not on disk → must download
      const { stdout: firstRun } = await run('deploy/modules_test', '');
      expect(plainMessages(firstRun).find(m => m.startsWith('Downloading tests@'))).toBe('Downloading tests@0.0.3...');

      // Second run: same version, directory now exists → skip download
      const { stdout: secondRun } = await run('deploy/modules_test', '');
      const secondMsgs = plainMessages(secondRun);
      expect(secondMsgs.find(m => m.startsWith('Downloading tests@'))).toBeUndefined();
      expect(secondMsgs.find(m => m.startsWith('Modules downloaded'))).toBe('Modules downloaded successfully (1 already up-to-date)');
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true, force: true });
      fs.writeFileSync(lockFilePath, originalLockContent);
    }
  });
});

describe('Failed install', () => {
  test('Module not found - non-existing module', async () => {
    const savedCreds = saveCredentials();
    const savedPortalHost = process.env.PARTNER_PORTAL_HOST;
    applyCredentials(noCredentials);
    delete process.env.PARTNER_PORTAL_HOST;
    try {
      const { stdout } = await run('deploy/modules_test', 'moduleNotFound');
      const msgs = plainMessages(stdout);
      expect(msgs.find(m => m.startsWith("Can't find"))).toBe(
        "Can't find module moduleNotFound (registry: https://partners.platformos.com)"
      );
    } finally {
      applyCredentials(savedCreds);
      if (savedPortalHost) {
        process.env.PARTNER_PORTAL_HOST = savedPortalHost;
      }
    }
  });
});

describe('repository_url persistence', () => {
  test('pos-modules.json written by install contains repository_url', async () => {
    requireRealCredentials();
    const posModulesPath = `${cwd('deploy/modules_test')}/app/pos-modules.json`;
    const lockFilePath = `${cwd('deploy/modules_test')}/app/pos-modules.lock.json`;
    const originalModulesContent = fs.readFileSync(posModulesPath, 'utf8');
    const originalLockContent = fs.readFileSync(lockFilePath, 'utf8');
    const pathToDirectory = `${cwd('deploy/modules_test')}/modules`;

    try {
      await run('deploy/modules_test', 'tests');

      const posModules = JSON.parse(fs.readFileSync(posModulesPath, 'utf8'));
      expect(posModules).toHaveProperty('repository_url');
      expect(typeof posModules.repository_url).toBe('string');
      expect(posModules.repository_url.length).toBeGreaterThan(0);
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true, force: true });
      fs.writeFileSync(posModulesPath, originalModulesContent);
      fs.writeFileSync(lockFilePath, originalLockContent);
    }
  });

  test('pos-modules.lock.json written by install contains repository_url', async () => {
    requireRealCredentials();
    const posModulesPath = `${cwd('deploy/modules_test')}/app/pos-modules.json`;
    const lockFilePath = `${cwd('deploy/modules_test')}/app/pos-modules.lock.json`;
    const originalModulesContent = fs.readFileSync(posModulesPath, 'utf8');
    const originalLockContent = fs.readFileSync(lockFilePath, 'utf8');
    const pathToDirectory = `${cwd('deploy/modules_test')}/modules`;

    try {
      await run('deploy/modules_test', 'tests');

      const lockFile = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
      expect(lockFile).toHaveProperty('repository_url');
      expect(typeof lockFile.repository_url).toBe('string');
      expect(lockFile.repository_url.length).toBeGreaterThan(0);
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true, force: true });
      fs.writeFileSync(posModulesPath, originalModulesContent);
      fs.writeFileSync(lockFilePath, originalLockContent);
    }
  });

  test('repository_url in pos-modules.json and pos-modules.lock.json match after install', async () => {
    requireRealCredentials();
    const posModulesPath = `${cwd('deploy/modules_test')}/app/pos-modules.json`;
    const lockFilePath = `${cwd('deploy/modules_test')}/app/pos-modules.lock.json`;
    const originalModulesContent = fs.readFileSync(posModulesPath, 'utf8');
    const originalLockContent = fs.readFileSync(lockFilePath, 'utf8');
    const pathToDirectory = `${cwd('deploy/modules_test')}/modules`;

    try {
      await run('deploy/modules_test', 'tests');

      const posModules = JSON.parse(fs.readFileSync(posModulesPath, 'utf8'));
      const lockFile = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
      expect(posModules.repository_url).toBe(lockFile.repository_url);
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true, force: true });
      fs.writeFileSync(posModulesPath, originalModulesContent);
      fs.writeFileSync(lockFilePath, originalLockContent);
    }
  });
});

describe('Idempotency', () => {
  test('running install twice produces identical lock file content', async () => {
    requireRealCredentials();
    const lockFilePath = `${cwd('deploy/modules_test')}/app/pos-modules.lock.json`;
    const originalLockContent = fs.readFileSync(lockFilePath, 'utf8');
    const pathToDirectory = `${cwd('deploy/modules_test')}/modules`;

    try {
      await run('deploy/modules_test', '');
      const lockAfterFirst = fs.readFileSync(lockFilePath, 'utf8');

      await run('deploy/modules_test', '');
      const lockAfterSecond = fs.readFileSync(lockFilePath, 'utf8');

      expect(JSON.parse(lockAfterFirst)).toEqual(JSON.parse(lockAfterSecond));
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true, force: true });
      fs.writeFileSync(lockFilePath, originalLockContent);
    }
  });
});
