
const os = require('os');
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

describe('sync.singleFile with env parameter', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-env-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    // Clear global MPKIT_* env vars so tests can control auth via .pos file
    vi.stubEnv('MPKIT_URL', '');
    vi.stubEnv('MPKIT_EMAIL', '');
    vi.stubEnv('MPKIT_TOKEN', '');

    fs.mkdirSync(path.join(tmpDir, 'app', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.pos'), JSON.stringify({
      staging: { url: 'https://test.staging.com', token: 'test-token', email: 'test@test.com' }
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('resolves auth from .pos when env parameter is provided', async () => {
    const appDir = path.join(tmpDir, 'app');
    fs.writeFileSync(path.join(appDir, 'assets', 'test.css'), 'body { color: red; }');

    const res = await singleFileTool.handler({
      filePath: path.join(appDir, 'assets', 'test.css'),
      env: 'staging',
      dryRun: true
    }, { transport: 'test' });

    expect(res.success).toBe(true);
    expect(res.auth.source).toBe('.pos(staging)');
    expect(res.auth.url).toBe('https://test.staging.com');
  });
});
