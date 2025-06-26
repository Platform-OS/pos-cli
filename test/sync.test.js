/* global jest */

const exec = require('./utils/exec');
const { spawn } = require('child_process');
const cliPath = require('./utils/cliPath');
const path = require('path');

const stepTimeout = 6000;

require('dotenv').config();

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', 'deploy', name);
// const run = (fixtureName, options, callback) => {
//   return exec(
//     `${cliPath} sync ${options}`,
//     { cwd: cwd(fixtureName), env: process.env },
//     callback
//   );
// };

const run = (fixtureName, options = '', steps) => {
  const cwdPath = cwd(fixtureName);
  return new Promise((resolve, reject) => {
    const child = spawn(cliPath, ['sync', options], {
      cwd: cwdPath,
      env: process.env,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });

    // Run additional steps while child is alive
    steps(child);
  });
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

jest.setTimeout(20000); // default jasmine timeout is 5 seconds - we need more.

describe('Happy path', () => {
  test('sync assets', async () => {

    const steps = async (child) => {
      await sleep(stepTimeout); //wait for sync to start
      await exec('echo "x" >> app/assets/bar.js', { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout); //wait for syncing the file
      child.kill();
    }

    const { stdout, stderr } = await run('correct_with_assets', null, steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('[Sync] Synced asset: app/assets/bar.js');
  });

  test('sync with direct assets upload', async () => {
    const steps = async (child) => {
      await sleep(stepTimeout); //wait for sync to start
      await exec('echo "x" >> app/assets/bar.js', { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout); //wait for syncing the file
      child.kill();
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
      await sleep(stepTimeout); //wait for sync to start
      await exec(`echo "${validYML}" >> app/${fileName}`, { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout); //wait for syncing the file
      await exec(`rm app/${fileName}`, { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout); //wait for deleting the file
      child.kill();
    }
    const { stderr, stdout } = await run('correct_with_assets', null, steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch(`[Sync] Synced: ${fileName}`);
    expect(stdout).toMatch(`[Sync] Deleted: ${fileName}`);
  });
});
