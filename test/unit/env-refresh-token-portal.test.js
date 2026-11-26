import { describe, test, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { cli } from '#test/utils/exec.js';

// An environment added with --portal holds no token of its own, so there is nothing for
// refresh-token to renew -- and it used to mint one anyway, after asking for a password and a
// second factor, then drop it on the way to .pos while reporting success. It names the command
// that does renew it, before asking for anything or making any request.
describe('pos-cli env refresh-token on an environment that uses a portal\'s token', () => {
  test('points at portal add --force and leaves .pos alone', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-refresh-portal-'));
    const dotPos = path.join(dir, '.pos');
    const config = JSON.stringify({ staging: { url: 'https://staging.example.com', portal: 'shared' } }, null, 2);
    fs.writeFileSync(dotPos, config);

    try {
      const { code, stdout, stderr } = await cli('env refresh-token staging', {
        cwd: dir,
        timeout: 20000,
        env: {
          ...process.env,
          CONFIG_FILE_PATH: dotPos,
          POS_PORTALS_FILE: path.join(dir, 'portals.json'),
          MPKIT_URL: '', MPKIT_EMAIL: '', MPKIT_TOKEN: '',
          CI: 'true'
        }
      });

      expect(code).not.toBe(0);
      expect(stdout + stderr).toContain('pos-cli portal add shared --force');
      expect(fs.readFileSync(dotPos, 'utf8')).toBe(config);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);
});
