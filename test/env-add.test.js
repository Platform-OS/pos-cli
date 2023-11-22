/* global jest */

const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const run = (options) => exec(`${cliPath} env add ${options}`, { env: process.env });
const readTokenForEnv = (envName) => {
  const posFile = fs.readFileSync('.pos', 'utf8');
  const posConfig = JSON.parse(posFile);
  return posConfig[envName]['token'];
}

describe('env add', () => {
  test('adding with email and token', async () => {
    const { stdout, stderr } = await run('--url https://example.com --email pos-cli-ci@platformos.com --token 12345 env_url_email_token');

    expect(stdout).toMatch('Environment https://example.com/ as env_url_email_token has been added successfuly');
    expect(readTokenForEnv('env_url_email_token')).toMatch('12345');
  });

  test.skip('adding with url', async () => {
    // TODO: mock requests to portal
    global.open = () => console.log('bar');
    const { stdout, stderr } = await run('--url https:example.com env_url');

    expect(stdout).toMatch('Environment https://example.com/ as env_url has been added successfuly');
    expect(readTokenForEnv('env_url_email')).toMatch('12345');
  });
});
