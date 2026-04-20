import 'dotenv/config';
import { describe, test, expect } from 'vitest';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';
import fs from 'fs';
import path from 'path';
import { requireRealCredentials, noCredentials, applyCredentials, saveCredentials } from '#test/utils/credentials';
import { plainMessages } from '#test/utils/parseOutput';

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', name);
const run = async (fixtureName, options = '') =>
  exec(`${cliPath} modules install ${options}`, { cwd: cwd(fixtureName), env: process.env });

describe('modules install', () => {
  test('downloads module with transitive dependencies, skipping what is already on disk', async () => {
    requireRealCredentials();
    const fixtureCwd = cwd('deploy/modules_user');
    const pathToDirectory = path.join(fixtureCwd, 'modules');
    const lockFilePath = path.join(fixtureCwd, 'pos-module.lock.json');
    const originalLockContent = fs.readFileSync(lockFilePath, 'utf8');

    try {
      // First run: download everything so exact resolved versions land on disk
      await run('deploy/modules_user');

      // Remove only the root module — transitive deps (e.g. core) stay on disk
      await fs.promises.rm(path.join(pathToDirectory, 'user'), { recursive: true, force: true });

      // Second run: root module missing → re-download it; transitive dep present at locked version → skip
      const { stdout, stderr } = await run('deploy/modules_user');
      const msgs = plainMessages(stdout);
      const stderrMsgs = plainMessages(stderr);

      expect(msgs.find(m => m.startsWith('Downloading user@'))).toMatch(/^Downloading user@\d+\.\d+\.\d+\.\.\.$/);
      expect(msgs.find(m => m.startsWith('Downloading core@'))).toBeUndefined();
      expect(stderrMsgs.find(m => m.startsWith('Modules downloaded successfully'))).toMatch(/already up-to-date/);
      expect(fs.existsSync(path.join(pathToDirectory, 'user'))).toBe(true);
    } finally {
      await fs.promises.rm(pathToDirectory, { recursive: true, force: true });
      fs.writeFileSync(lockFilePath, originalLockContent);
    }
  }, 60000);

  test('reports clear error when module does not exist in registry', async () => {
    const savedCreds = saveCredentials();
    const savedPortalHost = process.env.PARTNER_PORTAL_HOST;
    applyCredentials(noCredentials);
    delete process.env.PARTNER_PORTAL_HOST;

    try {
      const { stderr } = await run('deploy/modules_test', 'moduleNotFound');
      const msgs = plainMessages(stderr);
      expect(msgs.find(m => m.startsWith("Can't find"))).toBe(
        "Can't find module moduleNotFound (registry: https://partners.platformos.com)"
      );
    } finally {
      applyCredentials(savedCreds);
      if (savedPortalHost !== undefined) {
        process.env.PARTNER_PORTAL_HOST = savedPortalHost;
      }
    }
  });
});
