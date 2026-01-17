/* global jest */

const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');
const path = require('path');
const fs = require('fs');

const stepTimeout = 3500;

require('dotenv').config();
const { requireRealCredentials } = require('./utils/realCredentials');
requireRealCredentials();

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', 'deploy', name);
const run = (fixtureName, options, callback) => {
  return exec(
    `${cliPath} sync ${options}`,
    { cwd: cwd(fixtureName), env: process.env },
    callback
  );
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

jest.setTimeout(20000); // default jasmine timeout is 5 seconds - we need more.

const kill = p => {
  p.stdout.destroy();
  p.stderr.destroy();
  p.kill()
}

jest.retryTimes(2);

// Store original content to restore after tests
const barJsPath = path.join(cwd('correct_with_assets'), 'app/assets/bar.js');
const originalBarJsContent = fs.readFileSync(barJsPath, 'utf8');

afterAll(() => {
  // Restore bar.js to original content after all tests
  fs.writeFileSync(barJsPath, originalBarJsContent);
});

describe('Happy path', () => {
  test('sync assets', async () => {

    const steps = async (child) => {
      await sleep(stepTimeout); //wait for sync to start
      exec('echo "x" >> app/assets/bar.js', { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout); //wait for syncing the file
      kill(child);
    }

    const { stdout, stderr } = await run('correct_with_assets', null, steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('[Sync] Synced asset: app/assets/bar.js');
  });

  test('sync with direct assets upload', async () => {
    const steps = async (child) => {
      await sleep(stepTimeout); //wait for sync to start
      exec('echo "x" >> app/assets/bar.js', { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout); //wait for syncing the file
      kill(child);
    }
    const { stdout, stderr } = await run('correct_with_assets', '-d', steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('[Sync] Synced asset: app/assets/bar.js');
  });

  test('delete synced file', async () => {
    const dir = 'model_schemas';
    const fileName = `${dir}/test.yml`;
    const validYML = `name: test
properties:
  - name: list_id
    type: string
`;

    const steps = async (child) => {
      await exec(`mkdir -p app/${dir}`, { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout); //wait for syncing the file
      await exec(`echo "${validYML}" >> app/${fileName}`, { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout); //wait for syncing the file
      await exec(`rm app/${fileName}`, { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout); //wait for deleting the file
      kill(child);
    }
    const { stderr, stdout } = await run('correct_with_assets', null, steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch(`[Sync] Synced: ${fileName}`);
    expect(stdout).toMatch(`[Sync] Deleted: ${fileName}`);
  });
});
