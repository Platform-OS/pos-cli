/* global jest */

const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

Object.assign(process.env, {
  DEBUG: true
});

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', 'modules', name);

const run = (fixtureName, options) => exec(`${cliPath} modules push ${options}`, { cwd: cwd(fixtureName), env: process.env });

describe('Server errors', () => {
  test('Empty directory', async () => {
    const { stdout, stderr } = await run('empty', '--email pos-cli-ci@platformos.com');
    expect(stderr).toMatch("File doesn't exist: template-values.json");
  });

  test('Multiple modules with template-values.json', async () => {
    const { stdout, stderr } = await run('multiple_modules', '--email pos-cli-ci@platformos.com');
    expect(stderr).toMatch("There is more than one modules/*/template-values.json, please use --name parameter or create template-values.json in the root of the project.");
  });

  test('Multiple modules with template-values.json and invalid name', async () => {
    const { stdout, stderr } = await run('multiple_modules', '--email pos-cli-ci@platformos.com --name missing');
    expect(stderr).toMatch("File doesn't exist: modules/missing/template-values.json");
  });

  test('Error in root template-values.json', async () => {
    const { stdout, stderr } = await run('template_values_in_root_first', '--email pos-cli-ci@platformos.com --name foo');
    expect(stderr).toMatch("There is no directory modules/bar");
  });

  test.skip('now we include template-values.json in release', async () => {
    const { stdout, stderr } = await run('no_files', '--email pos-cli-ci@platformos.com');
    expect(stderr).toMatch("There are no files in module release");
  });

  test('Wrong email', async () => {
    const { stdout, stderr } = await run('good', '--email foo@example.com');
    expect(stderr).toMatch('Cannot find modules/pos_cli_ci_test, creating archive with the current directory');
    expect(stderr).toMatch('You are unauthorized to do this operation. Check if your Token/URL or email/password are correct.');
  }, 30000);

  test('Wrong version', async () => {
    const { stdout, stderr } = await run('good', '--email pos-cli-ci@platformos.com');
    expect(stdout).toMatch("for access token");
    expect(stdout).toMatch("Release Uploaded");
    expect(stderr).toMatch('Name has already been taken');
  });
});
