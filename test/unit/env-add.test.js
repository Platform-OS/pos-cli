
import process from 'process';
import fs from 'fs';
import cli from '#test/utils/exec';
import { settingsFromDotPos } from '#lib/settings.js';

process.env['CI'] = 'true';

const run = (options) => cli(`env add ${options}`);

describe('commander env add', () => {
  // fs, not `rm -f`: nothing here needs a shell, and the suite spawns no shell at all.
  afterEach(() => fs.rmSync('.pos', { force: true }));

  test('adding with email and token', async () => {
    const { stdout } = await run('--url https://example.com --email pos-cli-ci@platformos.com --token 12345 e1');

    expect(stdout).toMatch('Environment https://example.com/ as e1 has been added successfully');

    const settings = settingsFromDotPos('e1');
    expect(settings['token']).toMatch('12345');
  });

  test('adding with email and token and partner_portal_url', async () => {
    const { stdout } = await run('--url https://example.com --email pos-cli-ci@platformos.com --token 12345 e2 --partner-portal-url http://portal.example.com');

    expect(stdout).toMatch('Environment https://example.com/ as e2 has been added successfully');

    const settings = settingsFromDotPos('e2');
    expect(settings['token']).toMatch('12345');
    expect(settings['partner_portal_url']).toMatch('http://portal.example.com');
  });
});
