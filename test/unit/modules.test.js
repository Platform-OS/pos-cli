/**
 * Unit tests for modules functionality
 * These tests mock Portal API calls to test module operations without real API access
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

const PORTAL_URL = 'https://partners.platformos.com';

// Mock API responses (simulating real Portal API responses)
const mockResponses = {
  moduleVersions: {
    tests: [
      {
        name: 'tests',
        versions: [
          { name: '0.0.3', archive_url: 'https://s3.amazonaws.com/modules/tests-0.0.3.zip' },
          { name: '1.0.0', archive_url: 'https://s3.amazonaws.com/modules/tests-1.0.0.zip' }
        ]
      }
    ],
    user: [
      {
        name: 'user',
        versions: [
          { name: '3.0.8', archive_url: 'https://s3.amazonaws.com/modules/user-3.0.8.zip' }
        ],
        dependencies: ['core']
      }
    ],
    core: [
      {
        name: 'core',
        versions: [
          { name: '1.5.5', archive_url: 'https://s3.amazonaws.com/modules/core-1.5.5.zip' }
        ]
      }
    ]
  },
  jwtToken: {
    success: { auth_token: 'test-jwt-token-12345' }
  },
  findModules: {
    tests: [{ id: 1, name: 'tests', machine_name: 'tests' }],
    user: [{ id: 2, name: 'user', machine_name: 'user' }]
  },
  createVersion: {
    success: { id: 100, status: 'pending' }
  },
  moduleVersionStatus: {
    pending: { id: 100, status: 'pending' },
    accepted: { id: 100, status: 'accepted' }
  },
  notFound: {
    error: 'Module not found'
  }
};

describe('Portal API - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();
    process.env.PARTNER_PORTAL_HOST = PORTAL_URL;
  });

  afterEach(() => {
    nock.cleanAll();
    delete process.env.PARTNER_PORTAL_HOST;
  });

  describe('Portal.jwtToken()', () => {
    test('returns auth token on successful login', async () => {
      nock(PORTAL_URL)
        .post('/api/authenticate')
        .reply(200, mockResponses.jwtToken.success);

      const Portal = (await import('#lib/portal.js')).default;
      const result = await Portal.jwtToken('test@example.com', 'password123');

      expect(result.auth_token).toBe('test-jwt-token-12345');
    });

    test('handles invalid credentials', async () => {
      nock(PORTAL_URL)
        .post('/api/authenticate')
        .reply(401, { error: 'Invalid credentials' });

      const Portal = (await import('#lib/portal.js')).default;

      await expect(Portal.jwtToken('test@example.com', 'wrongpassword')).rejects.toThrow();
    });
  });

  describe('Portal.moduleVersions()', () => {
    test('returns module versions for requested modules', async () => {
      nock(PORTAL_URL)
        .get('/api/pos_modules')
        .query({ modules: 'tests' })
        .reply(200, mockResponses.moduleVersions.tests);

      const Portal = (await import('#lib/portal.js')).default;
      const result = await Portal.moduleVersions(['tests']);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('tests');
      expect(result[0].versions).toHaveLength(2);
    });

    test('returns multiple modules when requested', async () => {
      const combinedResponse = [
        ...mockResponses.moduleVersions.user,
        ...mockResponses.moduleVersions.core
      ];

      nock(PORTAL_URL)
        .get('/api/pos_modules')
        .query({ modules: 'user,core' })
        .reply(200, combinedResponse);

      const Portal = (await import('#lib/portal.js')).default;
      const result = await Portal.moduleVersions(['user', 'core']);

      expect(result).toHaveLength(2);
    });
  });

  describe('Portal.findModules()', () => {
    test('finds modules by name with auth token', async () => {
      nock(PORTAL_URL)
        .get('/api/pos_modules/')
        .query({ modules: 'tests' })
        .matchHeader('Authorization', 'Bearer test-token')
        .reply(200, mockResponses.findModules.tests);

      const Portal = (await import('#lib/portal.js')).default;
      const result = await Portal.findModules('test-token', 'tests');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('tests');
    });

    test('returns empty array for non-existent module', async () => {
      nock(PORTAL_URL)
        .get('/api/pos_modules/')
        .query({ modules: 'nonexistent' })
        .reply(200, []);

      const Portal = (await import('#lib/portal.js')).default;
      const result = await Portal.findModules('test-token', 'nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('Portal.createVersion()', () => {
    test('creates new module version', async () => {
      nock(PORTAL_URL)
        .post('/api/pos_modules/1/pos_module_versions')
        .matchHeader('Authorization', 'Bearer test-token')
        .reply(200, mockResponses.createVersion.success);

      const Portal = (await import('#lib/portal.js')).default;
      const result = await Portal.createVersion(
        'test-token',
        'https://s3.amazonaws.com/modules/tests-1.0.0.zip',
        '1.0.0',
        1
      );

      expect(result.id).toBe(100);
      expect(result.status).toBe('pending');
    });
  });

  describe('Portal.moduleVersionStatus()', () => {
    test('returns module version status', async () => {
      nock(PORTAL_URL)
        .get('/api/pos_modules/1/pos_module_versions/100')
        .matchHeader('Authorization', 'Bearer test-token')
        .reply(200, mockResponses.moduleVersionStatus.accepted);

      const Portal = (await import('#lib/portal.js')).default;
      const result = await Portal.moduleVersionStatus('test-token', 1, 100);

      expect(result.status).toBe('accepted');
    });
  });

  describe('Portal.requestDeviceAuthorization()', () => {
    test('initiates device authorization flow', async () => {
      const mockResponse = {
        device_code: 'device-code-123',
        user_code: 'USER-CODE',
        verification_uri: 'https://partners.platformos.com/verify',
        expires_in: 300,
        interval: 5
      };

      nock(PORTAL_URL)
        .post('/oauth/authorize_device')
        .reply(200, mockResponse);

      const Portal = (await import('#lib/portal.js')).default;
      const result = await Portal.requestDeviceAuthorization('test-instance.platformos.com');

      expect(result.device_code).toBe('device-code-123');
      expect(result.user_code).toBe('USER-CODE');
    });
  });

  describe('Portal.fetchDeviceAccessToken()', () => {
    test('fetches access token after device authorization', async () => {
      const mockResponse = {
        access_token: 'access-token-123',
        token_type: 'Bearer'
      };

      nock(PORTAL_URL)
        .post('/oauth/device_token')
        .reply(200, mockResponse);

      const Portal = (await import('#lib/portal.js')).default;
      const result = await Portal.fetchDeviceAccessToken('device-code-123');

      expect(result.access_token).toBe('access-token-123');
    });

    test('handles authorization pending', async () => {
      nock(PORTAL_URL)
        .post('/oauth/device_token')
        .reply(400, { error: 'authorization_pending' });

      const Portal = (await import('#lib/portal.js')).default;

      await expect(Portal.fetchDeviceAccessToken('device-code-123')).rejects.toThrow();
    });
  });
});

describe('moduleConfig()', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    vi.resetModules();
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-moduleconfig-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  test('throws with migration hint when pos-module.json is absent', async () => {
    const { moduleConfig } = await import('#lib/modules.js');
    expect(() => moduleConfig()).toThrow(/pos-module\.json not found/);
    expect(() => moduleConfig()).toThrow(/pos-cli modules migrate/);
  });

  test('reads machine_name and version from pos-module.json', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'pos-module.json'),
      JSON.stringify({ machine_name: 'user', version: '5.1.2' }, null, 2)
    );
    const { moduleConfig } = await import('#lib/modules.js');
    const config = moduleConfig();
    expect(config.machine_name).toBe('user');
    expect(config.version).toBe('5.1.2');
  });

  test('reads full config including dependencies from pos-module.json', async () => {
    const manifest = { machine_name: 'user', version: '5.1.2', dependencies: { core: '^1.0.0' } };
    fs.writeFileSync(path.join(tmpDir, 'pos-module.json'), JSON.stringify(manifest, null, 2));
    const { moduleConfig } = await import('#lib/modules.js');
    const config = moduleConfig();
    expect(config).toEqual(manifest);
  });
});

describe('publishVersion() — pre-flight validation', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-push-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  const writeManifest = (content) =>
    fs.writeFileSync(path.join(tmpDir, 'pos-module.json'), JSON.stringify(content, null, 2));

  // publishVersion catches errors and calls logger.Error + process.exit(1).
  // We verify validation by checking that logger.Error receives the right message.
  const runPublish = async () => {
    vi.mock('#lib/logger.js', () => ({
      default: {
        Debug: vi.fn(),
        Warn: vi.fn(),
        Error: vi.fn(),
        Info: vi.fn(),
        Success: vi.fn()
      }
    }));
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
    const { publishVersion } = await import('#lib/modules.js');
    const logger = (await import('#lib/logger.js')).default;
    try {
      await publishVersion({ email: 'test@example.com' });
    } catch (_) { /* process.exit throws in test */ }
    return logger;
  };

  test('errors with clear message when pos-module.json is absent', async () => {
    const logger = await runPublish();
    expect(logger.Error).toHaveBeenCalledWith(
      expect.stringContaining('pos-module.json not found')
    );
  });

  test('errors with clear message when machine_name is absent', async () => {
    writeManifest({ version: '1.0.0' });
    const logger = await runPublish();
    expect(logger.Error).toHaveBeenCalledWith(
      expect.stringContaining("'machine_name' is required")
    );
  });

  test('errors with clear message when version is absent', async () => {
    writeManifest({ machine_name: 'user' });
    const logger = await runPublish();
    expect(logger.Error).toHaveBeenCalledWith(
      expect.stringContaining("'version' is required")
    );
  });

  test('errors with clear message when version is not valid semver', async () => {
    writeManifest({ machine_name: 'user', version: 'not-a-version' });
    const logger = await runPublish();
    expect(logger.Error).toHaveBeenCalledWith(
      expect.stringContaining("is not a valid semver string")
    );
  });

  test('errors with directory hint when modules/ exists but modules/${machine_name}/ does not', async () => {
    writeManifest({ machine_name: 'user', version: '1.0.0' });
    fs.mkdirSync(path.join(tmpDir, 'modules'), { recursive: true }); // modules/ exists but no modules/user/
    const logger = await runPublish();
    expect(logger.Error).toHaveBeenCalledWith(
      expect.stringContaining('modules/user/ not found')
    );
  });

  test('does not error about directory when modules/ does not exist (single-dir workflow)', async () => {
    writeManifest({ machine_name: 'user', version: '1.0.0' });
    // No modules/ directory at all — publishVersion should reach archive creation (not fail on dir check)
    // It will fail later (no files / archive issues), but not on the directory validation.
    const logger = await runPublish();
    const dirErrorCalled = logger.Error.mock.calls.some(
      ([msg]) => typeof msg === 'string' && msg.includes('not found') && msg.includes('modules/user/')
    );
    expect(dirErrorCalled).toBe(false);
  });
});

describe('Module Download Error Cases - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();
    process.env.PARTNER_PORTAL_HOST = PORTAL_URL;
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('handles 404 when module not found', async () => {
    nock(PORTAL_URL)
      .get('/api/pos_modules')
      .query(true)
      .reply(404, mockResponses.notFound);

    const Portal = (await import('#lib/portal.js')).default;

    await expect(Portal.moduleVersions(['nonexistent'])).rejects.toThrow();
  });

  test('handles network errors gracefully', async () => {
    nock(PORTAL_URL)
      .get('/api/pos_modules')
      .query(true)
      .replyWithError('Network connection failed');

    const Portal = (await import('#lib/portal.js')).default;

    await expect(Portal.moduleVersions(['tests'])).rejects.toThrow();
  });

  test('handles server errors (500)', async () => {
    nock(PORTAL_URL)
      .get('/api/pos_modules')
      .query(true)
      .reply(500, { error: 'Internal server error' });

    const Portal = (await import('#lib/portal.js')).default;

    await expect(Portal.moduleVersions(['tests'])).rejects.toThrow();
  });
});

describe('Module Dependencies - Unit Tests', () => {
  test('resolveDependencies resolves module versions', async () => {
    const { resolveDependencies } = await import('#lib/modules/dependencies.js');

    // Mock getVersions function that returns module info
    const mockGetVersions = vi.fn().mockResolvedValue([
      {
        module: 'moduleA',
        versions: {
          '1.0.0': { dependencies: {} }
        }
      }
    ]);

    const modules = { moduleA: '1.0.0' };
    const result = await resolveDependencies(modules, mockGetVersions);

    expect(result).toEqual({ moduleA: '1.0.0' });
    expect(mockGetVersions).toHaveBeenCalledWith(['moduleA']);
  });

  test('findModuleVersion finds specific version', async () => {
    const { findModuleVersion } = await import('#lib/modules/dependencies.js');

    const mockGetVersions = vi.fn().mockResolvedValue([
      {
        module: 'testModule',
        versions: {
          '1.0.0': {},
          '1.0.1': {},
          '2.0.0': {}
        }
      }
    ]);

    const result = await findModuleVersion('testModule', '1.0.1', mockGetVersions);

    expect(result).toEqual({ testModule: '1.0.1' });
  });

  test('findModuleVersion returns null for non-existent version', async () => {
    const { findModuleVersion } = await import('#lib/modules/dependencies.js');

    const mockGetVersions = vi.fn().mockResolvedValue([
      {
        module: 'testModule',
        versions: {
          '1.0.0': {}
        }
      }
    ]);

    const result = await findModuleVersion('testModule', '9.9.9', mockGetVersions);

    expect(result).toBeNull();
  });

  test('findModuleVersion returns latest stable version when no version specified', async () => {
    const { findModuleVersion } = await import('#lib/modules/dependencies.js');

    const mockGetVersions = vi.fn().mockResolvedValue([
      {
        module: 'testModule',
        versions: {
          '1.0.0': {},
          '2.0.0': {},
          '3.0.0-beta': {} // Should be skipped in favour of stable
        }
      }
    ]);

    const result = await findModuleVersion('testModule', null, mockGetVersions);

    expect(result).toEqual({ testModule: '2.0.0' });
  });

  test('findModuleVersion falls back to latest pre-release when no stable version exists', async () => {
    const { findModuleVersion } = await import('#lib/modules/dependencies.js');

    const mockGetVersions = vi.fn().mockResolvedValue([
      {
        module: 'testModule',
        versions: {
          '1.0.0-alpha': {},
          '1.0.0-beta': {}
        }
      }
    ]);

    const result = await findModuleVersion('testModule', null, mockGetVersions);

    expect(result).toEqual({ testModule: '1.0.0-beta' });
  });
});
