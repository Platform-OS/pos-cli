import { beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Registers beforeEach/afterEach hooks that create a temporary directory,
 * chdir into it, and clean it up after each test. vi.clearAllMocks() is also
 * called so mock call counts don't bleed between tests.
 *
 * Returns a getter so tests can reference the current tmpDir path:
 *
 *   const getTmpDir = withTmpDir();
 *   // inside a test: getTmpDir() === current tmpDir
 *
 * Call at file level for file-wide setup, or inside a describe block to
 * scope the setup to that block only.
 */
const withTmpDir = (prefix = 'pos-cli-test-') => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    process.chdir(tmpDir);
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.PARTNER_PORTAL_HOST;
  });

  return () => tmpDir;
};

export { withTmpDir };
