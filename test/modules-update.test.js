/* global jest */

const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { requireRealCredentials } = require('./utils/realCredentials');
requireRealCredentials();

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', name);
const run = async (fixtureName, options) => await exec(`${cliPath} modules update ${options}`, { cwd: cwd(fixtureName), env: process.env });

describe('Successful update', () => {
  test('update core module', async () => {
    const pathToLockFile = `${cwd('deploy/modules_update')}/app/pos-modules.lock.json`;

    const { stdout, stderr } = await run('deploy/modules_update', 'core');
    expect(stdout).toMatch('Updating module');
    const fileContent = fs.readFileSync(pathToLockFile, { encoding: 'utf8' });
    const lockFile = JSON.parse(fileContent);
    expect(lockFile['modules']['core']).not.toEqual('1.0.0');
  });
});

describe('Failed download', () => {
  test('Module not found - non-existing module', async () => {
    const { stdout, stderr } = await run('deploy/modules_update', 'moduleNotFound');
    expect(stderr).toMatch("Can't find module moduleNotFound");
  });
  test('Module not found - no name for module', async () => {
    const { stdout, stderr } = await run('deploy/modules_update', '');
    expect(stderr).toMatch("error: missing required argument 'module-name'");
  });
});
