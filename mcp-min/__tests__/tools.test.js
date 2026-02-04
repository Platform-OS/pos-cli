/* eslint-env jest */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
let singleFile;
let singleFileTool;
let computeRemotePath, normalizeLocalPath, toPosix;
beforeAll(async () => {
  const mod = await import(pathToFileURL(path.resolve(process.cwd(), 'mcp-min', 'sync', 'single-file.js')).href);
  singleFile = mod;
  singleFileTool = mod.default;
  ({ computeRemotePath, normalizeLocalPath, toPosix } = mod);
});

// Basic unit tests for helper functions and dry-run behavior

describe('sync.singleFile helpers', () => {
  test('toPosix converts backslashes to slashes', () => {
    expect(toPosix('a\\b\\c')).toBe('a/b/c');
  });

  test('computeRemotePath strips app/ prefix', () => {
    expect(computeRemotePath('app/templates/example.html')).toBe('templates/example.html');
  });

  test('normalizeLocalPath produces relative posix path', () => {
    const tmp = path.resolve(process.cwd(), 'app', 'dummy.txt');
    const norm = normalizeLocalPath(tmp);
    expect(norm).toMatch(/app\/(dummy.txt|dummy.txt)$/);
  });
});

describe('sync.singleFile handler dry-run', () => {
  test('returns success true for dryRun when file path within allowed dirs', async () => {
    const tmpDir = path.join(process.cwd(), 'tmp-app');
    const appDir = path.join(tmpDir, 'app');
    const tmpPath = path.join(appDir, 'assets', 'dummy.txt');
    // Create a temp file and directory structure
    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    fs.writeFileSync(tmpPath, 'hello');

    // Run test from inside tmpDir so dir.APP detection works
    const cwdOrig = process.cwd();
    process.chdir(tmpDir);
    try {
      const res = await singleFileTool.handler({ filePath: tmpPath, dryRun: true, url: 'https://example.com', email: 'a@b.c', token: 'tok' }, { transport: 'test' });
      expect(res.success).toBe(true);
      expect(res.file.normalizedPath).toMatch(/app\/assets\/dummy.txt$/);
    } finally {
      process.chdir(cwdOrig);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
