
import process from 'process';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';
import { settingsFromDotPos } from '#lib/settings.js';

process.env['CI'] = 'true';

const run = (options) => exec(`${cliPath} env add ${options}`);

describe('commander env add', () => {
  afterEach(() => exec('rm -f .pos'));

  test('adding with email and token', async () => {
    const { stdout } = await run('--url https://example.com --email pos-cli-ci@platformos.com --token 12345 e1');

    expect(stdout).toMatch('Environment https://example.com/ as e1 has been added successfuly');

    const settings = settingsFromDotPos('e1');
    expect(settings['token']).toMatch('12345');
  });

  test('adding with email and token and partner_portal_url', async () => {
    const { stdout } = await run('--url https://example.com --email pos-cli-ci@platformos.com --token 12345 e2 --partner-portal-url http://portal.example.com');

    expect(stdout).toMatch('Environment https://example.com/ as e2 has been added successfuly');

    const settings = settingsFromDotPos('e2');
    expect(settings['token']).toMatch('12345');
    expect(settings['partner_portal_url']).toMatch('http://portal.example.com');
  });
});
