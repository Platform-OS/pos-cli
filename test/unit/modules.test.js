/**
 * Unit tests for modules functionality
 * These tests mock Portal API calls to test module operations without real API access
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import path from 'path';

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

describe('Module Configuration - Unit Tests', () => {
  const fixturesPath = path.join(process.cwd(), 'test', 'fixtures', 'modules');

  describe('moduleConfigFilePath()', () => {
    test('finds template-values.json in module directory', async () => {
      const originalCwd = process.cwd();

      try {
        process.chdir(path.join(fixturesPath, 'good'));

        const { moduleConfigFilePath } = await import('#lib/modules.js');
        const result = await moduleConfigFilePath('testmodule');

        expect(result).toContain('template-values.json');
      } finally {
        process.chdir(originalCwd);
      }
    });
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
          '3.0.0-beta': {} // Should be skipped
        }
      }
    ]);

    const result = await findModuleVersion('testModule', null, mockGetVersions);

    expect(result).toEqual({ testModule: '2.0.0' });
  });
});
