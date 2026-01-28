import 'dotenv/config';
import { describe, test, expect, afterAll, vi } from 'vitest';
import exec from '#test/utils/exec';
import cliPath from '#test/utils/cliPath';
import path from 'path';
import fs from 'fs';
import { requireRealCredentials } from '#test/utils/credentials';

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

      // Use Node.js fs for cross-platform compatibility
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      await sleep(stepTimeout);

      fs.writeFileSync(testFile, validYML);
      await sleep(stepTimeout);

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
