/* global jest */

const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', name);

const run = async (fixtureName, options) => await exec(`${cliPath} modules download ${options}`, { cwd: cwd(fixtureName), env: process.env });

describe('Successful download', () => {
  test('download test module', async () => {
    const pathToModuleJson = `${cwd('deploy/modules_test')}/modules/tests/template-values.json`;
    const pathToDirectory = `${cwd('deploy/modules_test')}/modules`;

    const { stdout, stderr } = await run('deploy/modules_test', 'tests');
    expect(stdout).toMatch('Downloading files');
    expect(fs.existsSync(pathToModuleJson)).toBeTruthy();

    fs.rm(pathToDirectory, { recursive: true }, (err) => {
      if(err){
          console.error(err.message);
          return;
      }
    });
  });
});

describe('Failed download', () => {
  test('Module not found - non-existing module', async () => {
    const { stdout, stderr } = await run('deploy/modules_test', 'moduleNotFound');
    expect(stderr).toMatch('Module not found');
  });
  test('Module not found - no name for module', async () => {
    const { stdout, stderr } = await run('deploy/modules_test', '');
    expect(stderr).toMatch("error: missing required argument 'module'");
  });
  test('Unescaped characters in request path', async () => {
    const { stdout, stderr } = await run('deploy/modules_test', 'ąę');
    expect(stderr).toMatch('[ERR_UNESCAPED_CHARACTERS]: Request path contains unescaped characters');
  });
});
