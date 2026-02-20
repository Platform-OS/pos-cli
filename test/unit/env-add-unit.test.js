import { vi, describe, test, expect, afterEach, beforeEach, beforeAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { settingsFromDotPos } from '#lib/settings.js';

vi.mock('open', () => ({
  default: vi.fn(() => Promise.resolve())
}));

let mockAccessToken = 'mock-token-12345';

vi.mock('#lib/data/waitForStatus.js', () => ({
  default: () => Promise.resolve({ access_token: mockAccessToken, status: 'success' })
}));

vi.mock('#lib/portal.js', async () => {
  const original = await vi.importActual('#lib/portal.js');
  return {
    default: {
      ...original,
      url: () => 'https://partners.platformos.com',
      requestDeviceAuthorization: () => Promise.resolve({
        verification_uri_complete: 'http://example.com/xxxx',
        device_code: 'device_code',
        interval: 1
      }),
      fetchDeviceAccessToken: () => Promise.resolve({ access_token: mockAccessToken }),
      login: () => Promise.resolve([{ token: mockAccessToken }])
    }
  };
});

vi.mock('#lib/logger.js', async () => {
  const module = await vi.importActual('#lib/logger.js');
  return {
    default: {
      ...module.default,
      Success: () => {},
      Debug: () => {},
      Info: () => {},
      Error: () => {}
    }
  };
});

vi.mock('#lib/validators/index.js', () => ({
  existence: { directoryExists: () => true, fileExists: () => true },
  url: () => true,
  email: () => true,
  directoryExists: () => true,
  directoryEmpty: () => true
}));

let addEnv;
let originalCwd;
let tempDir;

beforeAll(async () => {
  const addMod = await import('#lib/envs/add.js');
  addEnv = addMod.default;
});

beforeEach(() => {
  originalCwd = process.cwd();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-test-'));
  process.chdir(tempDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
  mockAccessToken = 'mock-token-12345';
});

describe('env add with mocked portal', () => {
  test('creates .pos file with token from device authorization flow', async () => {
    const environment = 'staging';
    const params = {
      url: 'https://staging.example.com'
    };

    await addEnv(environment, params);

    expect(fs.existsSync('.pos')).toBe(true);
    const settings = settingsFromDotPos(environment);
    expect(settings['token']).toBe('mock-token-12345');
    expect(settings['url']).toBe('https://staging.example.com/');
  });

  test('creates .pos file with token from --token option', async () => {
    const environment = 'production';
    const params = {
      url: 'https://production.example.com',
      token: 'direct-token-67890'
    };

    await addEnv(environment, params);

    expect(fs.existsSync('.pos')).toBe(true);
    const settings = settingsFromDotPos(environment);
    expect(settings['token']).toBe('direct-token-67890');
    expect(settings['url']).toBe('https://production.example.com/');
  });

  test('stores partner_portal_url when provided', async () => {
    const environment = 'e1';
    const params = {
      partnerPortalUrl: 'http://portal.example.com',
      url: 'http://instance.example.com'
    };

    await addEnv(environment, params);

    const settings = settingsFromDotPos(environment);
    expect(settings['token']).toBe('mock-token-12345');
    expect(settings['partner_portal_url']).toBe('http://portal.example.com');
  });

  test('overwrites existing environment token with new value', async () => {
    const environment = 'staging';
    const params = {
      url: 'https://staging.example.com',
      token: 'old-token-111'
    };

    await addEnv(environment, params);
    let settings = settingsFromDotPos(environment);
    expect(settings['token']).toBe('old-token-111');

    const newParams = {
      url: 'https://staging.example.com',
      token: 'new-token-222'
    };

    await addEnv(environment, newParams);
    settings = settingsFromDotPos(environment);
    expect(settings['token']).toBe('new-token-222');
  });

  test('adding new environment preserves existing environments in .pos', async () => {
    const env1 = 'staging';
    const params1 = {
      url: 'https://staging.example.com',
      token: 'staging-token'
    };

    await addEnv(env1, params1);

    const env2 = 'production';
    const params2 = {
      url: 'https://production.example.com',
      token: 'production-token'
    };

    await addEnv(env2, params2);

    const stagingSettings = settingsFromDotPos(env1);
    expect(stagingSettings['token']).toBe('staging-token');
    expect(stagingSettings['url']).toBe('https://staging.example.com/');

    const productionSettings = settingsFromDotPos(env2);
    expect(productionSettings['token']).toBe('production-token');
    expect(productionSettings['url']).toBe('https://production.example.com/');

    const posFile = JSON.parse(fs.readFileSync('.pos', 'utf8'));
    expect(Object.keys(posFile)).toContain('staging');
    expect(Object.keys(posFile)).toContain('production');
  });

  test('adding third environment preserves all existing environments', async () => {
    await addEnv('env1', { url: 'https://env1.example.com', token: 'token1' });
    await addEnv('env2', { url: 'https://env2.example.com', token: 'token2' });
    await addEnv('env3', { url: 'https://env3.example.com', token: 'token3' });

    const posFile = JSON.parse(fs.readFileSync('.pos', 'utf8'));

    expect(Object.keys(posFile).sort()).toEqual(['env1', 'env2', 'env3']);
    expect(posFile['env1']['token']).toBe('token1');
    expect(posFile['env2']['token']).toBe('token2');
    expect(posFile['env3']['token']).toBe('token3');
  });

  test('stores email when provided', async () => {
    const environment = 'staging';
    const params = {
      url: 'https://staging.example.com',
      email: 'user@example.com',
      token: 'some-token'
    };

    await addEnv(environment, params);

    const settings = settingsFromDotPos(environment);
    expect(settings['email']).toBe('user@example.com');
  });

  test('displays error when instance is not registered in partner portal', async () => {
    const Portal = await import('#lib/portal.js');
    const logger = await import('#lib/logger.js');

    const loggerErrorSpy = vi.spyOn(logger.default, 'Error');

    // Mock Portal.requestDeviceAuthorization to throw 404 error
    const originalRequestDeviceAuth = Portal.default.requestDeviceAuthorization;
    Portal.default.requestDeviceAuthorization = vi.fn(() => {
      const error = new Error('Not Found');
      error.statusCode = 404;
      error.options = { uri: 'https://partners.platformos.com/oauth/authorize_device' };
      return Promise.reject(error);
    });

    const environment = 'unregistered';
    const params = {
      url: 'https://unregistered-instance.example.com'
    };

    await expect(addEnv(environment, params)).rejects.toThrow();

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Instance https://unregistered-instance.example.com/ is not registered in the Partner Portal'),
      expect.objectContaining({ hideTimestamp: true, exit: false })
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Please double-check if the instance URL is correct'),
      expect.objectContaining({ hideTimestamp: true, exit: false })
    );

    // Restore original mock
    Portal.default.requestDeviceAuthorization = originalRequestDeviceAuth;
  });
});
