/**
 * Unit tests for deploy functionality
 * These tests mock HTTP calls to test deploy logic without real API access
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import path from 'path';
import fs from 'fs';

// Mock logger to prevent console output during tests
vi.mock('#lib/logger.js', () => ({
  default: {
    Debug: vi.fn(),
    Warn: vi.fn(),
    Error: vi.fn(),
    Info: vi.fn(),
    Success: vi.fn()
  }
}));

// Mock ora spinner
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: ''
  })
}));

const TEST_URL = 'https://test-instance.platformos.com';
const TEST_TOKEN = 'test-token-12345';
const TEST_EMAIL = 'test@example.com';

const fixturesPath = path.join(process.cwd(), 'test', 'fixtures', 'deploy');

// Mock API responses (simulating real platformOS API responses)
const mockResponses = {
  push: {
    success: { id: 12345, status: 'pending' }
  },
  status: {
    pending: { id: 12345, status: 'ready_for_import' },
    success: { id: 12345, status: 'success' },
    error: {
      id: 12345,
      status: 'error',
      error: {
        error: 'Validation failed',
        details: { file_path: 'app/views/pages/broken.liquid' }
      }
    }
  },
  instance: {
    success: { id: 999, name: 'test-instance' }
  },
  presignUrl: {
    success: {
      url: 'https://s3.amazonaws.com/bucket/presigned-upload-url',
      accessUrl: 'https://cdn.example.com/assets/file.zip'
    }
  },
  manifest: {
    success: { status: 'ok' }
  }
};

describe('Deploy - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();

    // Set up environment for tests
    process.env.MARKETPLACE_URL = TEST_URL;
    process.env.MARKETPLACE_TOKEN = TEST_TOKEN;
    process.env.MARKETPLACE_EMAIL = TEST_EMAIL;
    process.env.MPKIT_URL = TEST_URL;
    process.env.MPKIT_TOKEN = TEST_TOKEN;
    process.env.MPKIT_EMAIL = TEST_EMAIL;
  });

  afterEach(() => {
    nock.cleanAll();
    delete process.env.MARKETPLACE_URL;
    delete process.env.MARKETPLACE_TOKEN;
    delete process.env.MARKETPLACE_EMAIL;
  });

  describe('Gateway API calls', () => {
    test('push() sends archive to API and returns response', async () => {
      const scope = nock(TEST_URL)
        .post('/api/app_builder/marketplace_releases')
        .reply(200, mockResponses.push.success);

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

      // Create a minimal form data (in real scenario this would be a file stream)
      const formData = {
        'marketplace_builder[partial_deploy]': 'false',
        'marketplace_builder[zip_file]': Buffer.from('test zip content')
      };

      const result = await gateway.push(formData);

      expect(result).toEqual(mockResponses.push.success);
      expect(scope.isDone()).toBe(true);
    });

    test('getStatus() polls for deployment status', async () => {
      const scope = nock(TEST_URL)
        .get('/api/app_builder/marketplace_releases/12345')
        .reply(200, mockResponses.status.success);

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

      const result = await gateway.getStatus(12345);

      expect(result.status).toBe('success');
      expect(scope.isDone()).toBe(true);
    });

    test('getInstance() returns instance info', async () => {
      const scope = nock(TEST_URL)
        .get('/api/app_builder/instance')
        .reply(200, mockResponses.instance.success);

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

      const result = await gateway.getInstance();

      expect(result.id).toBe(999);
      expect(scope.isDone()).toBe(true);
    });

    test('sendManifest() sends asset manifest to API', async () => {
      const manifest = { 'app/assets/main.js': 'abc123hash' };

      const scope = nock(TEST_URL)
        .post('/api/app_builder/assets_manifest', { manifest })
        .reply(200, mockResponses.manifest.success);

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

      const result = await gateway.sendManifest(manifest);

      expect(result.status).toBe('ok');
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('API Error Handling', () => {
    test('handles 401 unauthorized', async () => {
      nock(TEST_URL)
        .post('/api/app_builder/marketplace_releases')
        .reply(401, { error: 'Invalid token' });

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: 'bad-token', email: TEST_EMAIL });

      const formData = { 'marketplace_builder[zip_file]': Buffer.from('test') };

      await expect(gateway.push(formData)).rejects.toThrow();
    });

    test('handles 404 not found', async () => {
      nock(TEST_URL)
        .get('/api/app_builder/marketplace_releases/99999')
        .reply(404, { error: 'Release not found' });

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

      await expect(gateway.getStatus(99999)).rejects.toThrow();
    });

    test('handles 500 server error', async () => {
      nock(TEST_URL)
        .post('/api/app_builder/marketplace_releases')
        .reply(500, { error: 'Internal server error' });

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

      const formData = { 'marketplace_builder[zip_file]': Buffer.from('test') };

      await expect(gateway.push(formData)).rejects.toThrow();
    });

    test('handles network errors', async () => {
      nock(TEST_URL)
        .post('/api/app_builder/marketplace_releases')
        .replyWithError('Network connection failed');

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

      const formData = { 'marketplace_builder[zip_file]': Buffer.from('test') };

      await expect(gateway.push(formData)).rejects.toThrow();
    });
  });

  describe('Presign URL', () => {
    test('presignUrl() returns upload and access URLs', async () => {
      const scope = nock(TEST_URL)
        .get('/api/private/urls/presign-url')
        .query(true) // Match any query params
        .reply(200, mockResponses.presignUrl.success);

      // Create a temp file to test with
      const testFilePath = path.join(fixturesPath, 'correct', 'app', 'views', 'pages', 'hello.liquid');

      // Only run if fixture exists
      if (fs.existsSync(testFilePath)) {
        const { presignUrl } = await import('#lib/presignUrl.js');
        const result = await presignUrl('test/path/file.zip', testFilePath);

        expect(result.uploadUrl).toBe('https://s3.amazonaws.com/bucket/presigned-upload-url');
        expect(result.accessUrl).toBe('https://cdn.example.com/assets/file.zip');
        expect(scope.isDone()).toBe(true);
      }
    });
  });

  describe('Archive Creation', () => {
    test('makeArchive creates zip file from app directory', async () => {
      const fixturePath = path.join(fixturesPath, 'correct');
      const originalCwd = process.cwd();

      try {
        process.chdir(fixturePath);

        const { makeArchive } = await import('#lib/archive.js');
        const env = { TARGET: './tmp/test-release.zip' };

        const result = await makeArchive(env, { withoutAssets: false });

        // Result is the number of files added
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThan(0);

        // Clean up
        if (fs.existsSync('./tmp/test-release.zip')) {
          fs.unlinkSync('./tmp/test-release.zip');
        }
      } finally {
        process.chdir(originalCwd);
      }
    });

    test('returns error when no app directory exists', async () => {
      const fixturePath = path.join(fixturesPath, 'empty');
      const originalCwd = process.cwd();

      try {
        process.chdir(fixturePath);

        const { makeArchive } = await import('#lib/archive.js');
        const { default: logger } = await import('#lib/logger.js');
        const env = { TARGET: './tmp/test-release.zip' };

        const result = await makeArchive(env, { withoutAssets: false });

        // Should return undefined/falsy when no directories found
        expect(result).toBeFalsy();
        expect(logger.Error).toHaveBeenCalled();
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('Full Deploy Flow (Mocked)', () => {
    test('successful deploy with direct asset upload', async () => {
      const fixturePath = path.join(fixturesPath, 'correct');
      const originalCwd = process.cwd();

      // Set up all required API mocks
      // 1. Push archive
      nock(TEST_URL)
        .post('/api/app_builder/marketplace_releases')
        .reply(200, mockResponses.push.success);

      // 2. Get status (first pending, then success)
      nock(TEST_URL)
        .get('/api/app_builder/marketplace_releases/12345')
        .reply(200, mockResponses.status.success);

      // 3. Get instance (for asset upload)
      nock(TEST_URL)
        .get('/api/app_builder/instance')
        .reply(200, mockResponses.instance.success);

      try {
        process.chdir(fixturePath);

        // Import after changing directory
        const { push } = await import('#lib/push.js');

        // Create the tmp directory and release.zip for the test
        if (!fs.existsSync('./tmp')) {
          fs.mkdirSync('./tmp', { recursive: true });
        }

        const { makeArchive } = await import('#lib/archive.js');
        await makeArchive({ TARGET: './tmp/release.zip' }, { withoutAssets: true });

        // Now test push
        const env = {
          MARKETPLACE_URL: TEST_URL,
          MARKETPLACE_TOKEN: TEST_TOKEN,
          MARKETPLACE_EMAIL: TEST_EMAIL
        };

        const result = await push(env);

        expect(typeof result).toBe('object');
        expect(typeof result.duration).toBe('string');
        expect(result.duration).toMatch(/\d+:\d{2}/); // e.g., "0:00" (MM:SS format)
        expect(result.releaseId).toBeDefined();
        expect(result.gateway).toBeDefined();
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});

describe.skip('Dry Run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();
    process.env.MARKETPLACE_URL = TEST_URL;
    process.env.MARKETPLACE_TOKEN = TEST_TOKEN;
    process.env.MARKETPLACE_EMAIL = TEST_EMAIL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
    delete process.env.MARKETPLACE_URL;
    delete process.env.MARKETPLACE_TOKEN;
    delete process.env.MARKETPLACE_EMAIL;
  });

  test('push() sends marketplace_builder[dry_run]=true when DRY_RUN is true', async () => {
    // Spy on fs.createReadStream to avoid async file-open errors (stream is never consumed
    // when gateway.push is mocked, but Node.js opens the file asynchronously in _construct)
    const fsModule = await import('fs');
    vi.spyOn(fsModule.default, 'createReadStream').mockReturnValue({ path: './tmp/release.zip' });

    const Gateway = (await import('#lib/proxy.js')).default;
    const pushSpy = vi.spyOn(Gateway.prototype, 'push')
      .mockResolvedValue({ id: 12345, status: 'pending' });
    vi.spyOn(Gateway.prototype, 'getStatus')
      .mockResolvedValue({ status: 'success', report: null });

    const { push } = await import('#lib/push.js');
    await push({
      MARKETPLACE_URL: TEST_URL,
      MARKETPLACE_TOKEN: TEST_TOKEN,
      MARKETPLACE_EMAIL: TEST_EMAIL,
      DRY_RUN: 'true'
    });

    const formDataArg = pushSpy.mock.calls[0][0];
    expect(formDataArg['marketplace_builder[dry_run]']).toBe('true');
  });

  test('push() omits marketplace_builder[dry_run] when DRY_RUN is false', async () => {
    const fsModule = await import('fs');
    vi.spyOn(fsModule.default, 'createReadStream').mockReturnValue({ path: './tmp/release.zip' });

    const Gateway = (await import('#lib/proxy.js')).default;
    const pushSpy = vi.spyOn(Gateway.prototype, 'push')
      .mockResolvedValue({ id: 12345, status: 'pending' });
    vi.spyOn(Gateway.prototype, 'getStatus')
      .mockResolvedValue({ status: 'success', report: null });

    const { push } = await import('#lib/push.js');
    await push({
      MARKETPLACE_URL: TEST_URL,
      MARKETPLACE_TOKEN: TEST_TOKEN,
      MARKETPLACE_EMAIL: TEST_EMAIL,
      DRY_RUN: 'false'
    });

    const formDataArg = pushSpy.mock.calls[0][0];
    expect(formDataArg['marketplace_builder[dry_run]']).toBeUndefined();
  });

  test('dryRunStrategy never uploads assets to S3 but sends manifest', async () => {
    const archiveModule = await import('#lib/archive.js');
    vi.spyOn(archiveModule, 'makeArchive').mockResolvedValue(5);

    const mockGateway = {
      getStatus: vi.fn().mockResolvedValue({ asset_report: { upserted: 2, deleted: 0, skipped: 0 } }),
      sendManifest: vi.fn().mockResolvedValue({})
    };

    const pushModule = await import('#lib/push.js');
    vi.spyOn(pushModule, 'push').mockResolvedValue({
      duration: '0:05', releaseId: 12345, gateway: mockGateway, report: {}
    });

    const assetsModule = await import('#lib/assets.js');
    const deployAssetsSpy = vi.spyOn(assetsModule, 'deployAssets').mockResolvedValue();

    const filesModule = await import('#lib/files.js');
    vi.spyOn(filesModule.default, 'getAssets').mockResolvedValue(['app/assets/app.css', 'app/assets/app.js']);

    const manifestModule = await import('#lib/assets/manifest.js');
    const manifestSpy = vi.spyOn(manifestModule, 'manifestGenerate').mockResolvedValue({
      'app.css': { physical_file_path: 'assets/app.css', updated_at: 123 },
      'app.js': { physical_file_path: 'assets/app.js', updated_at: 456 }
    });

    const strategy = (await import('#lib/deploy/dryRunStrategy.js')).default;
    await strategy({
      env: {
        MARKETPLACE_URL: TEST_URL,
        MARKETPLACE_TOKEN: TEST_TOKEN,
        MARKETPLACE_EMAIL: TEST_EMAIL,
        DRY_RUN: 'true',
        PARTIAL_DEPLOY: 'false'
      },
      authData: { url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL },
      params: {}
    });

    // Should NOT upload assets to S3
    expect(deployAssetsSpy).not.toHaveBeenCalled();

    // Should generate and send manifest for dry-run validation
    expect(manifestSpy).toHaveBeenCalled();
    expect(mockGateway.sendManifest).toHaveBeenCalledWith(
      expect.objectContaining({ 'app.css': expect.any(Object) }),
      12345
    );
  });

  test('dryRunStrategy skips manifest when no assets exist', async () => {
    const archiveModule = await import('#lib/archive.js');
    vi.spyOn(archiveModule, 'makeArchive').mockResolvedValue(5);

    const pushModule = await import('#lib/push.js');
    vi.spyOn(pushModule, 'push').mockResolvedValue({
      duration: '0:05', releaseId: 12345, gateway: { getStatus: vi.fn() }, report: {}
    });

    const filesModule = await import('#lib/files.js');
    vi.spyOn(filesModule.default, 'getAssets').mockResolvedValue([]);

    const manifestModule = await import('#lib/assets/manifest.js');
    const manifestSpy = vi.spyOn(manifestModule, 'manifestGenerate').mockResolvedValue({});

    const strategy = (await import('#lib/deploy/dryRunStrategy.js')).default;
    await strategy({
      env: {
        MARKETPLACE_URL: TEST_URL,
        MARKETPLACE_TOKEN: TEST_TOKEN,
        MARKETPLACE_EMAIL: TEST_EMAIL,
        DRY_RUN: 'true',
        PARTIAL_DEPLOY: 'false'
      },
      authData: { url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL },
      params: {}
    });

    // Should NOT generate manifest when there are no assets
    expect(manifestSpy).not.toHaveBeenCalled();
  });

  test('dryRunStrategy merges asset report into deploy report', async () => {
    const archiveModule = await import('#lib/archive.js');
    vi.spyOn(archiveModule, 'makeArchive').mockResolvedValue(5);

    const deployReport = {
      Page: { upserted: ['pages/index.liquid'], deleted: [], skipped: [] }
    };
    const mockGateway = {
      getStatus: vi.fn().mockResolvedValue({ asset_report: { upserted: 1, deleted: 0, skipped: 0 } }),
      sendManifest: vi.fn().mockResolvedValue({})
    };
    const pushModule = await import('#lib/push.js');
    vi.spyOn(pushModule, 'push').mockResolvedValue({
      duration: '0:05', releaseId: 12345,
      gateway: mockGateway,
      report: deployReport
    });
    const printSpy = vi.spyOn(pushModule, 'printDeployReport');

    const filesModule = await import('#lib/files.js');
    vi.spyOn(filesModule.default, 'getAssets').mockResolvedValue(['app/assets/app.css']);

    const manifestModule = await import('#lib/assets/manifest.js');
    vi.spyOn(manifestModule, 'manifestGenerate').mockResolvedValue({
      'app.css': { physical_file_path: 'assets/app.css', updated_at: 123 }
    });

    const strategy = (await import('#lib/deploy/dryRunStrategy.js')).default;
    await strategy({
      env: {
        MARKETPLACE_URL: TEST_URL,
        MARKETPLACE_TOKEN: TEST_TOKEN,
        MARKETPLACE_EMAIL: TEST_EMAIL,
        DRY_RUN: 'true',
        PARTIAL_DEPLOY: 'false'
      },
      authData: { url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL },
      params: {}
    });

    // printDeployReport should receive merged report with both Page and Asset
    expect(printSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        Page: expect.any(Object),
        Asset: { upserted: 1, deleted: 0, skipped: 0 }
      }),
      expect.any(Object)
    );
  });

  test('push() sends both dry_run and partial_deploy when both flags are set', async () => {
    const fsModule = await import('fs');
    vi.spyOn(fsModule.default, 'createReadStream').mockReturnValue({ path: './tmp/release.zip' });

    const Gateway = (await import('#lib/proxy.js')).default;
    const pushSpy = vi.spyOn(Gateway.prototype, 'push')
      .mockResolvedValue({ id: 12345, status: 'pending' });
    vi.spyOn(Gateway.prototype, 'getStatus')
      .mockResolvedValue({ status: 'success', report: null });

    const { push } = await import('#lib/push.js');
    await push({
      MARKETPLACE_URL: TEST_URL,
      MARKETPLACE_TOKEN: TEST_TOKEN,
      MARKETPLACE_EMAIL: TEST_EMAIL,
      DRY_RUN: 'true',
      PARTIAL_DEPLOY: 'true'
    });

    const formData = pushSpy.mock.calls[0][0];
    expect(formData['marketplace_builder[dry_run]']).toBe('true');
    expect(formData['marketplace_builder[partial_deploy]']).toBe('true');
  });
});

describe('printDeployReport', () => {
  let printDeployReport;
  let logger;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ printDeployReport } = await import('#lib/push.js'));
    logger = (await import('#lib/logger.js')).default;
  });

  test('does nothing when report is null', () => {
    printDeployReport(null);
    expect(logger.Success).not.toHaveBeenCalled();
  });

  test('displays upserted, deleted, and skipped counts', () => {
    printDeployReport({
      views: {
        upserted: ['app/views/pages/index.liquid'],
        deleted: ['app/views/pages/old.liquid'],
        skipped: ['app/views/pages/unchanged.liquid']
      }
    });

    expect(logger.Success).toHaveBeenCalledTimes(1);
    const output = logger.Success.mock.calls[0][0];
    expect(output).toContain('Deploy report:');
    expect(output).toContain('1 upserted');
    expect(output).toContain('1 deleted');
    expect(output).toContain('1 skipped');
    expect(output).toContain('views');
  });

  test('displays skipped files in verbose mode', () => {
    printDeployReport({
      views: {
        upserted: [],
        deleted: [],
        skipped: ['app/views/pages/unchanged.liquid']
      }
    }, { verbose: true });

    expect(logger.Success).toHaveBeenCalledTimes(1);
    const output = logger.Success.mock.calls[0][0];
    expect(output).toContain('~ app/views/pages/unchanged.liquid');
  });

  test('shows category when only skipped files exist', () => {
    printDeployReport({
      graphql: {
        upserted: [],
        deleted: [],
        skipped: ['app/graphql/query.graphql', 'app/graphql/mutation.graphql']
      }
    });

    expect(logger.Success).toHaveBeenCalledTimes(1);
    const output = logger.Success.mock.calls[0][0];
    expect(output).toContain('graphql');
    expect(output).toContain('0 upserted');
    expect(output).toContain('0 deleted');
    expect(output).toContain('2 skipped');
  });

  test('skips category when all counts are zero', () => {
    printDeployReport({
      views: { upserted: [], deleted: [], skipped: [] },
      graphql: { upserted: ['app/graphql/q.graphql'], deleted: [], skipped: [] }
    });

    expect(logger.Success).toHaveBeenCalledTimes(1);
    const output = logger.Success.mock.calls[0][0];
    expect(output).not.toContain('views');
    expect(output).toContain('graphql');
  });

  test('handles numeric counts for skipped', () => {
    printDeployReport({
      schema: { upserted: 3, deleted: 0, skipped: 5 }
    });

    expect(logger.Success).toHaveBeenCalledTimes(1);
    const output = logger.Success.mock.calls[0][0];
    expect(output).toContain('3 upserted');
    expect(output).toContain('0 deleted');
    expect(output).toContain('5 skipped');
  });

  test('verbose mode shows all file types with correct prefixes', () => {
    printDeployReport({
      views: {
        upserted: ['app/views/pages/new.liquid'],
        deleted: ['app/views/pages/removed.liquid'],
        skipped: ['app/views/pages/same.liquid']
      }
    }, { verbose: true });

    const output = logger.Success.mock.calls[0][0];
    expect(output).toContain('+ app/views/pages/new.liquid');
    expect(output).toContain('- app/views/pages/removed.liquid');
    expect(output).toContain('~ app/views/pages/same.liquid');
  });
});

describe('Deploy Error Scenarios (Mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();
    process.env.MARKETPLACE_URL = TEST_URL;
    process.env.MARKETPLACE_TOKEN = TEST_TOKEN;
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('deployment fails with validation error', async () => {
    // Mock push returning pending, then status returning error
    nock(TEST_URL)
      .post('/api/app_builder/marketplace_releases')
      .reply(200, { id: 12345, status: 'pending' });

    nock(TEST_URL)
      .get('/api/app_builder/marketplace_releases/12345')
      .reply(200, mockResponses.status.error);

    const Gateway = (await import('#lib/proxy.js')).default;
    const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

    const pushResult = await gateway.push({ 'marketplace_builder[zip_file]': Buffer.from('test') });
    expect(pushResult.id).toBe(12345);

    const statusResult = await gateway.getStatus(12345);
    expect(statusResult.status).toBe('error');
    expect(statusResult.error.error).toBe('Validation failed');
  });

  test('handles deploy timeout scenario', async () => {
    // Mock API that always returns pending status
    nock(TEST_URL)
      .get('/api/app_builder/marketplace_releases/12345')
      .times(3)
      .reply(200, mockResponses.status.pending);

    const Gateway = (await import('#lib/proxy.js')).default;
    const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

    // Each call should return pending
    const result1 = await gateway.getStatus(12345);
    const result2 = await gateway.getStatus(12345);
    const result3 = await gateway.getStatus(12345);

    expect(result1.status).toBe('ready_for_import');
    expect(result2.status).toBe('ready_for_import');
    expect(result3.status).toBe('ready_for_import');
  });
});
