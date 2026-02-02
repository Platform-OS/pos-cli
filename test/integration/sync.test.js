import 'dotenv/config';
import { describe, test, expect, afterAll, afterEach, vi } from 'vitest';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';
import path from 'path';
import fs from 'fs';
import { requireRealCredentials } from '#test/utils/credentials';

vi.setConfig({ testTimeout: 30000 });

// Force this test file to run in sequence to avoid race conditions with fixture files
// @vitest-environment node

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
    expect(stdout).toMatch(/\[Sync\] Synced asset: app\/assets\/bar\.js/);
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

      // Wait for sync to initialize before creating file
      await sleep(stepTimeout);

      // Use Node.js fs for cross-platform compatibility
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      fs.writeFileSync(testFile, validYML);
      // Wait longer for sync to complete (stabilityThreshold 500ms + network time + queue processing)
      await sleep(stepTimeout * 2);

      fs.unlinkSync(testFile);
      await sleep(stepTimeout);
      kill(child);
    };
    const { stdout } = await run('correct_with_assets', null, steps);

    expect(stdout).toMatch(process.env.MPKIT_URL);
    // Use regex to handle potential path separator differences
    expect(stdout).toMatch(new RegExp(`\\[Sync\\] Synced: ${fileName.replace(/\//g, '[/\\\\]')}`));
    expect(stdout).toMatch(new RegExp(`\\[Sync\\] Deleted: ${fileName.replace(/\//g, '[/\\\\]')}`));
  });

  test('sync single file with -f option', { retry: 2 }, async () => {
    requireRealCredentials();

    // Create a temporary file to sync
    const testFilePath = 'app/views/pages/test-single-sync.liquid';
    const fullTestPath = path.join(cwd('correct_with_assets'), testFilePath);
    const testContent = '<!-- Test single file sync -->\n<h1>Test Page</h1>\n';

    // Write test file
    fs.writeFileSync(fullTestPath, testContent);

    try {
      // Run sync with -f option (without callback, so it runs to completion)
      const { stdout, code } = await exec(
        `${cliPath} sync -f ${testFilePath}`,
        { cwd: cwd('correct_with_assets'), env: process.env }
      );

      // Verify output - note that filePathUnixified removes the app/ prefix
      expect(code).toBe(0);
      expect(stdout).toMatch(/\[Sync\] Synced: views\/pages\/test-single-sync\.liquid/);
    } finally {
      // Clean up test file
      if (fs.existsSync(fullTestPath)) {
        fs.unlinkSync(fullTestPath);
      }
    }
  });

  test('sync single asset file with -f option', { retry: 2 }, async () => {
    requireRealCredentials();

    // Create a temporary asset file to sync
    const testFilePath = 'app/assets/test-single-sync.js';
    const fullTestPath = path.join(cwd('correct_with_assets'), testFilePath);
    const testContent = '// Test single asset file sync\nconsole.log("test");\n';

    // Write test file
    fs.writeFileSync(fullTestPath, testContent);

    try {
      // Run sync with -f option (without callback, so it runs to completion)
      const { stdout, code } = await exec(
        `${cliPath} sync -f ${testFilePath}`,
        { cwd: cwd('correct_with_assets'), env: process.env }
      );

      // Verify output
      expect(code).toBe(0);
      expect(stdout).toMatch(/\[Sync\] Synced asset: app\/assets\/test-single-sync\.js/);
    } finally {
      // Clean up test file
      if (fs.existsSync(fullTestPath)) {
        fs.unlinkSync(fullTestPath);
      }
    }
  });

  test('422 validation error shows proper format with single error message', { retry: 2 }, async () => {
    requireRealCredentials();

    // Use fixture with invalid schema file that triggers 422 validation error
    const testFilePath = 'app/schema/invalid-property-type.yml';

    // Run sync with -f option - this should fail with validation error
    const { stderr, code } = await exec(
      `${cliPath} sync -f ${testFilePath}`,
      { cwd: cwd('invalid_schema'), env: process.env }
    );

    // Verify error output
    expect(code).toBe(1);

    // Should show [Sync] Failed to sync with timestamp and file path
    expect(stderr).toMatch(/\[\d{2}:\d{2}:\d{2}\] \[Sync\] Failed to sync: schema\/invalid-property-type\.yml/);

    // Should include the validation error message
    expect(stderr).toMatch(/Validation failed/);

    // Verify error is NOT duplicated - count occurrences of "Failed to sync"
    const failedToSyncMatches = (stderr.match(/Failed to sync/g) || []).length;
    expect(failedToSyncMatches).toBe(1);
  });

});
