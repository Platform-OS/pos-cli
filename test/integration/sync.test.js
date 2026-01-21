import 'dotenv/config';
import { describe, test, expect, afterAll, vi } from 'vitest';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';
import path from 'path';
import fs from 'fs';
import { requireRealCredentials } from '#test/utils/credentials';

// Cross-platform helper functions for file operations
const appendFile = (filePath, content) => {
  fs.appendFileSync(filePath, content);
};

const mkdir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const removeFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

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

const barJsPath = path.join(cwd('correct_with_assets'), 'app', 'assets', 'bar.js');
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
      appendFile(path.join(cwd('correct_with_assets'), 'app', 'assets', 'bar.js'), 'x');
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
      appendFile(path.join(cwd('correct_with_assets'), 'app', 'assets', 'bar.js'), 'x');
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
    const fixtureDir = cwd('correct_with_assets');
    const appDirPath = path.join(fixtureDir, 'app', dir);
    const filePath = path.join(fixtureDir, 'app', fileName);

    const steps = async (child) => {
      mkdir(appDirPath);
      await sleep(stepTimeout);
      appendFile(filePath, validYML);
      await sleep(stepTimeout);
      removeFile(filePath);
      await sleep(stepTimeout);
      kill(child);
    };
    const { stdout } = await run('correct_with_assets', null, steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch(`[Sync] Synced: ${fileName}`);
    expect(stdout).toMatch(`[Sync] Deleted: ${fileName}`);
  });
});
