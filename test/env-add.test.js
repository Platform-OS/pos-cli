/* global jest */

process.env['CI'] = 'true'

const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const fetchAuthData = require('../lib/settings').settingsFromDotPos;

const run = (options) => exec(`${cliPath} env add ${options}`);

const addEnv = require('../lib/envs/add')

describe('commander env add', () => {
  afterEach(() => exec(`rm .pos`));

  test('adding with email and token', async () => {
    const { stdout, stderr } = await run('--url https://example.com --email pos-cli-ci@platformos.com --token 12345 e1');

    expect(stdout).toMatch('Environment https://example.com/ as e1 has been added successfuly');

    const settings = fetchAuthData('e1')
    expect(settings['token']).toMatch('12345');
  });

  test('adding with email and token and partner_portal_url', async () => {
    const { stdout, stderr } = await run('--url https://example.com --email pos-cli-ci@platformos.com --token 12345 e2 --partner-portal-url http://portal.example.com');

    expect(stdout).toMatch('Environment https://example.com/ as e2 has been added successfuly');

    const settings = fetchAuthData('e2')
    expect(settings['token']).toMatch('12345');
    expect(settings['partner_portal_url']).toMatch('http://portal.example.com');
  });
});

jest.mock('../lib/portal', () => ({
  requestDeviceAuthorization: () => Promise.resolve({verification_uri_complete: "http://example.com/xxxx", device_code: "device_code"}),
  fetchDeviceAccessToken: x => Promise.resolve({access_token: "12345"})
}));

describe('env add', () => {
  afterEach(() => exec(`rm .pos`));

  const environment = 'e1'
  test('with --partner_portal_url', async () => {

    const params = {
      partnerPortalUrl: "http://portal.example.com",
      url: "http://instance.example.com"
    }

    await addEnv(environment, params)
    const settings = fetchAuthData(environment)
    expect(settings['token']).toMatch('12345');
    expect(settings['partner_portal_url']).toMatch('http://portal.example.com');
  });
});
