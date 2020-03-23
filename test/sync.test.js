/* global jest */

const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');
const path = require('path');

require('dotenv').config();

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

describe('Happy path', () => {
  test('sync assets', async () => {
    const steps = async (child) => {
      await sleep(2000); //wait for sync to start
      exec('echo "x" >> app/assets/bar.js', { cwd: cwd('correct_with_assets') });
      await sleep(2000); //wait for syncing the file
      child.kill();
    }
    const {stdout} = await run('correct_with_assets', null, steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('[Sync] Synced: assets/bar.js');
  });

  test('sync with direct assets upload', async () => {
    const steps = async (child) => {
      await sleep(2000); //wait for sync to start
      exec('echo "x" >> app/assets/bar.js', { cwd: cwd('correct_with_assets') });
      await sleep(2000); //wait for syncing the file
      child.kill();
    }
    const {stdout, stderr} = await run('correct_with_assets', '-d', steps);

    expect(stderr).toMatch('');
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
      exec(`mkdir -p app/${dir}`, { cwd: cwd('correct_with_assets') });
      await sleep(2000); //wait for sync to start
      exec(`echo "${validYML}" >> app/${fileName}`, { cwd: cwd('correct_with_assets') });
      await sleep(8000); //wait for syncing the file
      exec(`rm app/${fileName}`, { cwd: cwd('correct_with_assets') });
      await sleep(8000); //wait for deleting the file
      child.kill();
    }
    const { stdout } = await run('correct_with_assets', null, steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch(`[Sync] Synced: ${fileName}`);
    expect(stdout).toMatch(`[Sync] Deleted: ${fileName}`);
  });
});
