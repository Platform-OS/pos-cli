import 'dotenv/config';
import { describe, test, expect } from 'vitest';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';
import fs from 'fs';
import path from 'path';
import { requireRealCredentials, noCredentials, applyCredentials } from '#test/utils/credentials';

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', name);
const run = async (fixtureName, options) => await exec(`${cliPath} modules update ${options}`, { cwd: cwd(fixtureName), env: process.env });

describe('Successful update', () => {
  test('update core module', async () => {
    requireRealCredentials();
    const pathToLockFile = `${cwd('deploy/modules_update')}/app/pos-modules.lock.json`;

    const { stdout } = await run('deploy/modules_update', 'core');
    expect(stdout).toMatch('Updating module');
    const fileContent = fs.readFileSync(pathToLockFile, { encoding: 'utf8' });
    const lockFile = JSON.parse(fileContent);
    expect(lockFile['modules']['core']).not.toEqual('1.0.0');
  });
});

describe('Failed download', () => {
  test('Module not found - non-existing module', async () => {
    const savedCreds = applyCredentials(noCredentials);
    const savedPortalHost = process.env.PARTNER_PORTAL_HOST;
    delete process.env.PARTNER_PORTAL_HOST;
    try {
      const { stderr } = await run('deploy/modules_update', 'moduleNotFound');
      expect(stderr).toMatch("Can't find module moduleNotFound");
    } finally {
      applyCredentials(savedCreds);
      if (savedPortalHost) {
        process.env.PARTNER_PORTAL_HOST = savedPortalHost;
      }
    }
  });
  test('Module not found - no name for module', async () => {
    const savedCreds = applyCredentials(noCredentials);
    const savedPortalHost = process.env.PARTNER_PORTAL_HOST;
    delete process.env.PARTNER_PORTAL_HOST;
    try {
      const { stderr } = await run('deploy/modules_update', '');
      expect(stderr).toMatch("error: missing required argument 'module-name'");
    } finally {
      applyCredentials(savedCreds);
      if (savedPortalHost) {
        process.env.PARTNER_PORTAL_HOST = savedPortalHost;
      }
    }
  });
});
