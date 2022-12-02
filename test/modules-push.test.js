/* global jest */

const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', 'modules', name);

const run = (fixtureName, options) => exec(`${cliPath} modules push ${options}`, { cwd: cwd(fixtureName), env: process.env });

describe('Server errors', () => {
  test('Empty directory', async () => {
    const { stdout, stderr } = await run('empty', '--email pos-cli-ci@platformos.com');
    expect(stderr).toMatch("File doesn't exist: template-values.json");
  });

  test('No files', async () => {
    const { stdout, stderr } = await run('no_files', '--email pos-cli-ci@platformos.com');
    expect(stderr).toMatch("There are no files in module release");
  });

  test('Wrong email', async () => {
    const { stdout, stderr } = await run('good', '--email foo@example.com');
    expect(stderr).toMatch('Either email or password is incorrect');
  });

  test('Wrong version', async () => {
    const { stdout, stderr } = await run('good', '--email pos-cli-ci@platformos.com');
    expect(stdout).toMatch("for access token");
    expect(stdout).toMatch("Release Uploaded");
    expect(stderr).toMatch('Module Version not created: Name has already been taken');
  });
});
