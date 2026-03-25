import 'dotenv/config';
import { describe, test, expect } from 'vitest';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';
import fs from 'fs';
import path from 'path';
import { requireRealCredentials, noCredentials, applyCredentials, saveCredentials } from '#test/utils/credentials';
import { plainMessages } from '#test/utils/parseOutput';

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', name);
const run = async (fixtureName, options) => await exec(`${cliPath} modules update ${options}`, { cwd: cwd(fixtureName), env: process.env });

describe('Successful update', () => {
  test('updates core module and downloads it', async () => {
    requireRealCredentials();
    const pathToLockFile = `${cwd('deploy/modules_update')}/app/pos-modules.lock.json`;
    const posModulesPath = `${cwd('deploy/modules_update')}/app/pos-modules.json`;
    const originalModulesContent = fs.readFileSync(posModulesPath, 'utf8');
    const originalLockContent = fs.readFileSync(pathToLockFile, 'utf8');
    const pathToDirectory = `${cwd('deploy/modules_update')}/modules`;

    try {
      const { stdout } = await run('deploy/modules_update', 'core');
      const msgs = plainMessages(stdout);
      expect(msgs.find(m => m === 'Updating module')).toBe('Updating module');

      const fileContent = fs.readFileSync(pathToLockFile, { encoding: 'utf8' });
      const lockFile = JSON.parse(fileContent);
      expect(lockFile['modules']['core']).not.toEqual('1.0.0');

      // Core is updated to the latest version from the registry; exact version is not known in advance
      expect(msgs.find(m => m.startsWith('Downloading core@'))).toMatch(/^Downloading core@\d+\.\d+\.\d+\.\.\.$/);
      expect(fs.existsSync(path.join(pathToDirectory, 'core', 'template-values.json'))).toBeTruthy();
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true, force: true });
      fs.writeFileSync(posModulesPath, originalModulesContent);
      fs.writeFileSync(pathToLockFile, originalLockContent);
    }
  }, 30000);

  test('skips re-downloading modules that have not changed after update', async () => {
    requireRealCredentials();
    const pathToLockFile = `${cwd('deploy/modules_update')}/app/pos-modules.lock.json`;
    const posModulesPath = `${cwd('deploy/modules_update')}/app/pos-modules.json`;
    const originalModulesContent = fs.readFileSync(posModulesPath, 'utf8');
    const originalLockContent = fs.readFileSync(pathToLockFile, 'utf8');
    const pathToDirectory = `${cwd('deploy/modules_update')}/modules`;

    try {
      // First update: resolves latest core, downloads it
      const { stdout: firstRun } = await run('deploy/modules_update', 'core');
      expect(plainMessages(firstRun).find(m => m.startsWith('Downloading core@'))).toMatch(/^Downloading core@\d+\.\d+\.\d+\.\.\.$/);

      // Second update with the same module: already at latest, directory on disk → skip
      const { stdout: secondRun } = await run('deploy/modules_update', 'core');
      const secondMsgs = plainMessages(secondRun);
      expect(secondMsgs.find(m => m.startsWith('Downloading core@'))).toBeUndefined();
      expect(secondMsgs.find(m => m.startsWith('Modules downloaded'))).toBe('Modules downloaded successfully (1 already up-to-date)');
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true, force: true });
      fs.writeFileSync(posModulesPath, originalModulesContent);
      fs.writeFileSync(pathToLockFile, originalLockContent);
    }
  }, 30000);
});

describe('Failed update', () => {
  test('Module not found - non-existing module', async () => {
    const savedCreds = saveCredentials();
    const savedPortalHost = process.env.PARTNER_PORTAL_HOST;
    applyCredentials(noCredentials);
    delete process.env.PARTNER_PORTAL_HOST;
    try {
      const { stdout } = await run('deploy/modules_update', 'moduleNotFound');
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

  test('no modules to update when pos-modules.json is empty', async () => {
    const savedCreds = saveCredentials();
    applyCredentials(noCredentials);
    try {
      const { stdout } = await exec(`${cliPath} modules update`, { cwd: cwd('test/without-tests-module'), env: process.env });
      expect(plainMessages(stdout).find(m => m === 'No modules to update')).toBe('No modules to update');
    } finally {
      applyCredentials(savedCreds);
    }
  });
});

describe('repository_url persistence', () => {
  test('pos-modules.json written by update contains repository_url', async () => {
    requireRealCredentials();
    const posModulesPath = `${cwd('deploy/modules_update')}/app/pos-modules.json`;
    const pathToLockFile = `${cwd('deploy/modules_update')}/app/pos-modules.lock.json`;
    const originalModulesContent = fs.readFileSync(posModulesPath, 'utf8');
    const originalLockContent = fs.readFileSync(pathToLockFile, 'utf8');
    const pathToDirectory = `${cwd('deploy/modules_update')}/modules`;

    try {
      await run('deploy/modules_update', 'core');

      const posModules = JSON.parse(fs.readFileSync(posModulesPath, 'utf8'));
      expect(posModules).toHaveProperty('repository_url');
      expect(typeof posModules.repository_url).toBe('string');
      expect(posModules.repository_url.length).toBeGreaterThan(0);
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true, force: true });
      fs.writeFileSync(posModulesPath, originalModulesContent);
      fs.writeFileSync(pathToLockFile, originalLockContent);
    }
  }, 30000);

  test('pos-modules.lock.json written by update contains repository_url', async () => {
    requireRealCredentials();
    const posModulesPath = `${cwd('deploy/modules_update')}/app/pos-modules.json`;
    const pathToLockFile = `${cwd('deploy/modules_update')}/app/pos-modules.lock.json`;
    const originalModulesContent = fs.readFileSync(posModulesPath, 'utf8');
    const originalLockContent = fs.readFileSync(pathToLockFile, 'utf8');
    const pathToDirectory = `${cwd('deploy/modules_update')}/modules`;

    try {
      await run('deploy/modules_update', 'core');

      const lockFile = JSON.parse(fs.readFileSync(pathToLockFile, 'utf8'));
      expect(lockFile).toHaveProperty('repository_url');
      expect(typeof lockFile.repository_url).toBe('string');
      expect(lockFile.repository_url.length).toBeGreaterThan(0);
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true, force: true });
      fs.writeFileSync(posModulesPath, originalModulesContent);
      fs.writeFileSync(pathToLockFile, originalLockContent);
    }
  }, 30000);
});

describe('Update vs install distinction', () => {
  test('modules update <name> always replaces version even if already present', async () => {
    requireRealCredentials();
    const posModulesPath = `${cwd('deploy/modules_update')}/app/pos-modules.json`;
    const pathToLockFile = `${cwd('deploy/modules_update')}/app/pos-modules.lock.json`;
    const originalModulesContent = fs.readFileSync(posModulesPath, 'utf8');
    const originalLockContent = fs.readFileSync(pathToLockFile, 'utf8');
    const pathToDirectory = `${cwd('deploy/modules_update')}/modules`;

    try {
      // First update to establish latest
      await run('deploy/modules_update', 'core');
      const afterFirst = JSON.parse(fs.readFileSync(posModulesPath, 'utf8'));
      const versionAfterFirst = afterFirst.modules.core;

      // Second update — should still run and confirm (or re-confirm) the latest version
      const { stdout } = await run('deploy/modules_update', 'core');
      const afterSecond = JSON.parse(fs.readFileSync(posModulesPath, 'utf8'));

      expect(afterSecond.modules.core).toBe(versionAfterFirst);
      expect(plainMessages(stdout).find(m => m === 'Updating module')).toBe('Updating module');
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true, force: true });
      fs.writeFileSync(posModulesPath, originalModulesContent);
      fs.writeFileSync(pathToLockFile, originalLockContent);
    }
  }, 30000);

  test('update to specific version pins that version in pos-modules.json', async () => {
    requireRealCredentials();
    const posModulesPath = `${cwd('deploy/modules_update')}/app/pos-modules.json`;
    const pathToLockFile = `${cwd('deploy/modules_update')}/app/pos-modules.lock.json`;
    const originalModulesContent = fs.readFileSync(posModulesPath, 'utf8');
    const originalLockContent = fs.readFileSync(pathToLockFile, 'utf8');
    const pathToDirectory = `${cwd('deploy/modules_update')}/modules`;
    // Use the version already pinned in the fixture — it is guaranteed to exist in the registry.
    const pinnedVersion = JSON.parse(originalModulesContent).modules.core;

    try {
      await run('deploy/modules_update', `core@${pinnedVersion}`);

      const posModules = JSON.parse(fs.readFileSync(posModulesPath, 'utf8'));
      const lockFile = JSON.parse(fs.readFileSync(pathToLockFile, 'utf8'));

      expect(posModules.modules.core).toBe(pinnedVersion);
      expect(lockFile.modules.core).toBe(pinnedVersion);
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true, force: true });
      fs.writeFileSync(posModulesPath, originalModulesContent);
      fs.writeFileSync(pathToLockFile, originalLockContent);
    }
  }, 30000);
});
