/* global jest */

const { spawn } = require('child_process');
const cliPath = require('./utils/cliPath');
const path = require('path');
const fs = require('fs').promises;

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
  const cwdPath = path.join(process.cwd(), 'test', 'fixtures', 'deploy', fixtureName)
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(cliPath, ['sync', options], {
        cwd: cwdPath,
        env: process.env,
        shell: true,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      // child.on('error', reject);

      child.on('error', (code) => {
        child.stdout?.removeAllListeners();
        child.stderr?.removeAllListeners();

        resolve({ stdout, stderr, code });
      });

      child.on('close', (code) => {
        child.stdout?.removeAllListeners();
        child.stderr?.removeAllListeners();

        resolve({ stdout, stderr, code });
      });

      // Run additional steps while child is alive
      steps(child);
    } catch (e) {
      console.log(e);
      return reject(e)
    }
  });
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

jest.setTimeout(20000); // default jasmine timeout is 5 seconds - we need more.

describe('Happy path', () => {
  test('sync assets', async () => {

    const steps = async (child) => {
      await sleep(stepTimeout); //wait for sync to start
      await fs.appendFile(path.join(cwd('correct_with_assets'), 'app/assets/bar.js'), 'x');
      // await exec('echo "x" >> app/assets/bar.js', { cwd: cwd('correct_with_assets') });
      await sleep(stepTimeout); //wait for syncing the file

      child.kill();
    }

    const { stdout, stderr } = await run('correct_with_assets', null, steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch('[Sync] Synced asset: app/assets/bar.js');
  });

  // test('sync with direct assets upload', async () => {
    // const steps = async (child) => {
    //   await sleep(stepTimeout); //wait for sync to start
    //   await fs.appendFile(path.join(cwd('correct_with_assets'), 'app/assets/bar.js'), 'x');
    //   await sleep(stepTimeout); //wait for syncing the file
    //   child.kill();
    // }
    // const { stdout, stderr } = await run('correct_with_assets', '-d', steps);

    // expect(stdout).toMatch(process.env.MPKIT_URL);
    // expect(stdout).toMatch('[Sync] Synced asset: app/assets/bar.js');
  // });

//   test('delete synced file', async () => {
//     const dir = 'model_schemas';
//     const fileName = `${dir}/test.yml`;
//     const validYML = `name: test
// properties:
//   - name: list_id
//     type: string
// `;

//     const steps = async (child) => {
//       const baseDir = cwd('correct_with_assets');
//       const dirPath = path.join(baseDir, 'app', dir);
//       const filePath = path.join(baseDir, 'app', fileName);

//       // Create directory if it doesn't exist
//       await fs.mkdir(dirPath, { recursive: true });
//       await sleep(stepTimeout);

//       // Write the valid YAML content to the file
//       await fs.appendFile(filePath, validYML);
//       await sleep(stepTimeout);

//       // Delete the file
//       await fs.rm(filePath);
//       await sleep(stepTimeout);

//       // Kill the child process
//       child.kill();
//     }

//     const { stderr, stdout } = await run('correct_with_assets', null, steps);

//     expect(stdout).toMatch(process.env.MPKIT_URL);
//     expect(stdout).toMatch(`[Sync] Synced: ${fileName}`);
//     expect(stdout).toMatch(`[Sync] Deleted: ${fileName}`);
//   });

});
