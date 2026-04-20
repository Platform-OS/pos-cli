import 'dotenv/config';
import { describe, test, expect } from 'vitest';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';
import fs from 'fs';
import path from 'path';
import { requireRealCredentials } from '#test/utils/credentials';
import { plainMessages } from '#test/utils/parseOutput';

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', name);
const run = async (fixtureName, options = '') =>
  exec(`${cliPath} modules update ${options}`, { cwd: cwd(fixtureName), env: process.env });

describe('modules update', () => {
  test('updates module to latest and downloads it', async () => {
    requireRealCredentials();
    const posModulesPath = path.join(cwd('deploy/modules_update'), 'pos-module.json');
    const lockFilePath = path.join(cwd('deploy/modules_update'), 'pos-module.lock.json');
    const originalModulesContent = fs.readFileSync(posModulesPath, 'utf8');
    const originalLockContent = fs.readFileSync(lockFilePath, 'utf8');
    const pathToDirectory = path.join(cwd('deploy/modules_update'), 'modules');

    try {
      const { stdout } = await run('deploy/modules_update', 'core');
      const msgs = plainMessages(stdout);

      expect(msgs.find(m => m.startsWith('Downloading core@'))).toMatch(/^Downloading core@\d+\.\d+\.\d+\.\.\.$/);
      expect(fs.existsSync(path.join(pathToDirectory, 'core'))).toBe(true);

      const lock = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
      expect(lock.dependencies.core).not.toBe('2.0.7');
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true, force: true });
      fs.writeFileSync(posModulesPath, originalModulesContent);
      fs.writeFileSync(lockFilePath, originalLockContent);
    }
  }, 30000);

  test('reports error when module is not in dependencies', async () => {
    // No credentials needed — the bin file checks the manifest before any registry call
    const { stderr } = await run('deploy/modules_update', 'moduleNotFound');
    const msgs = plainMessages(stderr);
    expect(msgs.find(m => m.includes('moduleNotFound') && m.includes('not in dependencies'))).toBeTruthy();
  });
});
