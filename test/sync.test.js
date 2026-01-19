import 'dotenv/config';
import { describe, test, expect, afterAll, vi } from 'vitest';
import exec from './utils/exec';
import cliPath from './utils/cliPath';
import path from 'path';
import fs from 'fs';
import { requireRealCredentials } from './utils/credentials';

vi.setConfig({ testTimeout: 20000 });

const stepTimeout = 3500;

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', 'deploy', name);
const run = (fixtureName, options, callback) => {
  return exec(
    `${cliPath} sync ${options}`,
    { cwd: cwd(fixtureName), env: process.env },
    callback
  );
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const kill = p => {
  p.stdout.destroy();
  p.stderr.destroy();
  p.kill();
};

const barJsPath = path.join(cwd('correct_with_assets'), 'app/assets/bar.js');
const originalBarJsContent = fs.readFileSync(barJsPath, 'utf8');

afterAll(() => {
  fs.writeFileSync(barJsPath, originalBarJsContent);
});

// Skip all tests if credentials aren't available
describe('Happy path', () => {
  test('sync assets', { retry: 2 }, async () => {
    requireRealCredentials();

    const steps = async (child) => {
      await sleep(stepTimeout);
      exec('echo "x" >> app/assets/bar.js', { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout);
      kill(child);
    };

    const { stdout } = await run('correct_with_assets', null, steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('[Sync] Synced asset: app/assets/bar.js');
  });

  test('sync with direct assets upload', { retry: 2 }, async () => {
    const steps = async (child) => {
      await sleep(stepTimeout);
      exec('echo "x" >> app/assets/bar.js', { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout);
      kill(child);
    };
    const { stdout } = await run('correct_with_assets', '-d', steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('[Sync] Synced asset: app/assets/bar.js');
  });

  test('delete synced file', { retry: 2 }, async () => {
    const dir = 'model_schemas';
    const fileName = `${dir}/test.yml`;
    const validYML = `name: test
properties:
  - name: list_id
    type: string
`;

    const steps = async (child) => {
      await exec(`mkdir -p app/${dir}`, { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout);
      await exec(`echo "${validYML}" >> app/${fileName}`, { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout);
      await exec(`rm app/${fileName}`, { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout);
      kill(child);
    };
    const { stdout } = await run('correct_with_assets', null, steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch(`[Sync] Synced: ${fileName}`);
    expect(stdout).toMatch(`[Sync] Deleted: ${fileName}`);
  });
});
