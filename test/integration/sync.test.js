import 'dotenv/config';
import { describe, test, expect, afterAll, afterEach, vi } from 'vitest';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';
import waitForOutput from '#test/utils/waitForOutput';
import path from 'path';
import fs from 'fs';
import { requireRealCredentials } from '#test/utils/credentials';

vi.setConfig({ testTimeout: 30000 });

const cwd = name => path.join(process.cwd(), 'test', 'fixtures', 'deploy', name);
const run = (fixtureName, options, callback) => {
  return exec(
    `${cliPath} sync ${options || ''}`,
    { cwd: cwd(fixtureName), env: process.env },
    callback
  );
};

const kill = p => {
  p.stdout.destroy();
  p.stderr.destroy();
  p.kill();
};

const barJsPath = path.join(cwd('correct_with_assets'), 'app/assets/bar.js');
const originalBarJsContent = fs.readFileSync(barJsPath, 'utf8');

// Restore file after each test to prevent race conditions with other tests
afterEach(() => {
  try {
    fs.writeFileSync(barJsPath, originalBarJsContent);
  } catch (error) {
    console.error('Failed to restore bar.js in afterEach:', error);
  }
});

// Also restore after all tests as a final safeguard
afterAll(() => {
  try {
    fs.writeFileSync(barJsPath, originalBarJsContent);
  } catch (error) {
    console.error('Failed to restore bar.js in afterAll:', error);
  }
});

describe('Happy path', () => {
  test('sync assets', { retry: 2 }, async () => {
    requireRealCredentials();

    const steps = async (child) => {
      await waitForOutput(child, /Synchronizing changes to/);
      exec('echo "x" >> app/assets/bar.js', { cwd: cwd('correct_with_assets') });
      await waitForOutput(child, /\[Sync\] Synced asset: app\/assets\/bar\.js/);
      kill(child);
    };

    const { stdout } = await run('correct_with_assets', null, steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch(/\[Sync\] Synced asset: app\/assets\/bar\.js/);
  });

  test('sync with direct assets upload', { retry: 2 }, async () => {
    const steps = async (child) => {
      await waitForOutput(child, /Synchronizing changes to/);
      exec('echo "x" >> app/assets/bar.js', { cwd: cwd('correct_with_assets') });
      await waitForOutput(child, /\[Sync\] Synced asset: app\/assets\/bar\.js/);
      kill(child);
    };
    const { stdout } = await run('correct_with_assets', '-d', steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch(/\[Sync\] Synced asset: app\/assets\/bar\.js/);
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
      const testDir = path.join(cwd('correct_with_assets'), 'app', dir);
      const testFile = path.join(cwd('correct_with_assets'), 'app', fileName);

      await waitForOutput(child, /Synchronizing changes to/);

      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      fs.writeFileSync(testFile, validYML);
      await waitForOutput(child, new RegExp(`\\[Sync\\] Synced: ${fileName.replace(/\//g, '[/\\\\]')}`));

      fs.unlinkSync(testFile);
      await waitForOutput(child, new RegExp(`\\[Sync\\] Deleted: ${fileName.replace(/\//g, '[/\\\\]')}`));

      kill(child);
    };
    const { stdout } = await run('correct_with_assets', null, steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    expect(stdout).toMatch(new RegExp(`\\[Sync\\] Synced: ${fileName.replace(/\//g, '[/\\\\]')}`));
    expect(stdout).toMatch(new RegExp(`\\[Sync\\] Deleted: ${fileName.replace(/\//g, '[/\\\\]')}`));
  });

  test('sync single file with -f option', { retry: 2 }, async () => {
    requireRealCredentials();

    const testFilePath = 'app/views/pages/test-single-sync.liquid';
    const fullTestPath = path.join(cwd('correct_with_assets'), testFilePath);
    const testContent = '<!-- Test single file sync -->\n<h1>Test Page</h1>\n';

    fs.writeFileSync(fullTestPath, testContent);

    try {
      const { stdout, code } = await exec(
        `${cliPath} sync -f ${testFilePath}`,
        { cwd: cwd('correct_with_assets'), env: process.env }
      );

      expect(code).toBe(0);
      expect(stdout).toMatch(/\[Sync\] Synced: views\/pages\/test-single-sync\.liquid/);
    } finally {
      if (fs.existsSync(fullTestPath)) {
        fs.unlinkSync(fullTestPath);
      }
    }
  });

  test('sync single asset file with -f option', { retry: 2 }, async () => {
    requireRealCredentials();

    const testFilePath = 'app/assets/test-single-sync.js';
    const fullTestPath = path.join(cwd('correct_with_assets'), testFilePath);
    const testContent = '// Test single asset file sync\nconsole.log("test");\n';

    fs.writeFileSync(fullTestPath, testContent);

    try {
      const { stdout, code } = await exec(
        `${cliPath} sync -f ${testFilePath}`,
        { cwd: cwd('correct_with_assets'), env: process.env }
      );

      expect(code).toBe(0);
      expect(stdout).toMatch(/\[Sync\] Synced asset: app\/assets\/test-single-sync\.js/);
    } finally {
      if (fs.existsSync(fullTestPath)) {
        fs.unlinkSync(fullTestPath);
      }
    }
  });

  test('422 validation error shows proper format with single error message', { retry: 2 }, async () => {
    requireRealCredentials();

    const testFilePath = 'app/schema/invalid-property-type.yml';

    const { stderr, code } = await exec(
      `${cliPath} sync -f ${testFilePath}`,
      { cwd: cwd('invalid_schema'), env: process.env }
    );

    expect(code).toBe(1);
    expect(stderr).toMatch(/\[\d{2}:\d{2}:\d{2}\] \[Sync\] Failed to sync: schema\/invalid-property-type\.yml/);
    expect(stderr).toMatch(/Validation failed/);

    const failedToSyncMatches = (stderr.match(/Failed to sync/g) || []).length;
    expect(failedToSyncMatches).toBe(1);
  });
});
