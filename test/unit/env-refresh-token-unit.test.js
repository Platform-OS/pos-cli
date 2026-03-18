import { vi, describe, test, expect, afterEach, beforeEach, beforeAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { settingsFromDotPos } from '#lib/settings.js';

vi.mock('open', () => ({
  default: vi.fn(() => Promise.resolve())
}));

vi.mock('#lib/data/waitForStatus.js', () => ({
  default: () => Promise.resolve({ access_token: 'refreshed-token-12345', status: 'success' })
}));

vi.mock('#lib/portal.js', async () => {
  const original = await vi.importActual('#lib/portal.js');
  return {
    default: {
      ...original,
      url: () => 'https://partners.platformos.com',
      requestDeviceAuthorization: vi.fn(() => Promise.resolve({
        verification_uri_complete: 'http://example.com/xxxx',
        device_code: 'device_code',
        interval: 1
      })),
      fetchDeviceAccessToken: () => Promise.resolve({ access_token: 'refreshed-token-12345' }),
      login: vi.fn(() => Promise.resolve([{ token: 'refreshed-token-12345' }]))
    }
  };
});

vi.mock('#lib/logger.js', () => ({
  default: {
    Success: vi.fn(),
    Debug: vi.fn(),
    Info: vi.fn(),
    Warn: vi.fn(),
    Error: vi.fn()
  }
}));

vi.mock('#lib/utils/password.js', () => ({
  readPassword: vi.fn(() => Promise.resolve('test-password'))
}));

let refreshToken;
let mockLogger;
let mockPortal;
let originalCwd;
let tempDir;

beforeAll(async () => {
  const refreshMod = await import('#lib/envs/refreshToken.js');
  refreshToken = refreshMod.default;

  const loggerModule = await import('#lib/logger.js');
  mockLogger = loggerModule.default;

  const portalModule = await import('#lib/portal.js');
  mockPortal = portalModule.default;
});

beforeEach(() => {
  originalCwd = process.cwd();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-cli-test-'));
  process.chdir(tempDir);

  vi.clearAllMocks();

  mockPortal.requestDeviceAuthorization.mockResolvedValue({
    verification_uri_complete: 'http://example.com/xxxx',
    device_code: 'device_code',
    interval: 1
  });
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('env refresh-token', () => {
  test('refreshes token using device authorization flow and saves to .pos', async () => {
    const environment = 'staging';
    const authData = { url: 'https://staging.example.com', token: 'old-token-12345', email: undefined };
    const token = await refreshToken(environment, authData);

    expect(token).toBe('refreshed-token-12345');
    expect(mockPortal.requestDeviceAuthorization).toHaveBeenCalledWith('staging.example.com');

    const settings = settingsFromDotPos(environment);
    expect(settings.token).toBe('refreshed-token-12345');
    expect(mockLogger.Success).toHaveBeenCalledWith(expect.stringContaining('refreshed successfully'));
  });

  test('refreshes token using email/password flow and saves to .pos', async () => {
    const environment = 'staging';
    const authData = { url: 'https://staging.example.com', token: 'old-token-12345', email: 'user@example.com' };
    const token = await refreshToken(environment, authData);

    expect(token).toBe('refreshed-token-12345');
    expect(mockPortal.login).toHaveBeenCalledWith('user@example.com', 'test-password', 'https://staging.example.com');
    expect(mockPortal.requestDeviceAuthorization).not.toHaveBeenCalled();

    const settings = settingsFromDotPos(environment);
    expect(settings.token).toBe('refreshed-token-12345');
  });

  test('warns when token cannot be obtained', async () => {
    mockPortal.login.mockResolvedValue(null);

    const environment = 'staging';
    const authData = { url: 'https://staging.example.com', token: 'old-token-12345', email: 'user@example.com' };
    const token = await refreshToken(environment, authData);

    expect(token).toBeUndefined();
    expect(mockLogger.Warn).toHaveBeenCalledWith(expect.stringContaining('Could not obtain a new token'));
    expect(mockLogger.Success).not.toHaveBeenCalled();
  });

  test('displays error when instance is not registered in partner portal', async () => {
    mockPortal.requestDeviceAuthorization.mockRejectedValue({
      statusCode: 404,
      options: { uri: 'https://partners.platformos.com/oauth/authorize_device' },
      message: 'Not Found'
    });

    const authData = { url: 'https://unregistered-instance.example.com', token: 'old-token', email: undefined };
    await expect(refreshToken('unregistered', authData)).rejects.toMatchObject({
      statusCode: 404
    });

    expect(mockLogger.Error).toHaveBeenCalledWith(
      expect.stringContaining('Instance https://unregistered-instance.example.com is not registered in the Partner Portal'),
      expect.objectContaining({ hideTimestamp: true, exit: false })
    );
  });

  test('does not display custom error for non-404 errors', async () => {
    mockPortal.requestDeviceAuthorization.mockRejectedValue({
      statusCode: 500,
      options: { uri: 'https://partners.platformos.com/oauth/authorize_device' },
      message: 'Internal Server Error'
    });

    const authData = { url: 'https://errored-instance.example.com', token: 'old-token', email: undefined };
    await expect(refreshToken('errored', authData)).rejects.toMatchObject({
      statusCode: 500
    });

    expect(mockLogger.Error).not.toHaveBeenCalledWith(
      expect.stringContaining('is not registered in the Partner Portal'),
      expect.anything()
    );
  });
});
