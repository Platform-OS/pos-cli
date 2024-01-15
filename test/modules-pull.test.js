/* global jest */

const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', 'modules', name);

const run = (fixtureName, options) => exec(`${cliPath} modules pull ${options}`, { cwd: cwd(fixtureName), env: process.env });

describe('Successful pull', () => {
  test('Pull test module', async () => {
    const pathToModuleJson = `${cwd('tests')}/modules/tests/template-values.json`;
    const pathToDirectory = `${cwd('tests')}/modules`;

    const { stdout, stderr } = await run('tests', 'tests');
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

describe('Failed pull', () => {
  test('Module not found - non-existing module', async () => {
    const { stdout, stderr } = await run('tests', 'moduleNotFound');
    expect(stderr).toMatch('Module not found');
  });
  test('Module not found - no name for module', async () => {
    const { stdout, stderr } = await run('tests', '');
    expect(stderr).toMatch('Module name not provided');
  });
  test('Unescaped characters in request path', async () => {
    const { stdout, stderr } = await run('tests', 'ąę');
    expect(stderr).toMatch('[ERR_UNESCAPED_CHARACTERS]: Request path contains unescaped characters');
  });
});
