import { vi, describe, test, expect, afterEach, beforeEach } from 'vitest';
import fs from 'fs';
import { storeEnvironment } from '#lib/environments.js';

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
    Error: vi.fn()
  }
}));

vi.mock('#lib/utils/password.js', () => ({
  readPassword: vi.fn(() => Promise.resolve('test-password'))
}));

let deviceAuthorizationFlow;
let mockLogger;
let mockPortal;

beforeEach(async () => {
  const envModule = await import('#lib/environments.js');
  deviceAuthorizationFlow = envModule.deviceAuthorizationFlow;

  const loggerModule = await import('#lib/logger.js');
  mockLogger = loggerModule.default;

  const portalModule = await import('#lib/portal.js');
  mockPortal = portalModule.default;

  // Reset all mocks
  vi.clearAllMocks();

  // Reset the mock implementation to default success
  mockPortal.requestDeviceAuthorization.mockResolvedValue({
    verification_uri_complete: 'http://example.com/xxxx',
    device_code: 'device_code',
    interval: 1
  });
});

afterEach(() => {
  try {
    fs.unlinkSync('.pos');
  } catch {
    // File might not exist, ignore
  }
});

describe('env refresh-token', () => {
  test('refreshes token using device authorization flow', async () => {
    // Setup: create initial environment
    const environment = 'staging';
    storeEnvironment({
      environment: environment,
      url: 'https://staging.example.com',
      token: 'old-token-12345',
      email: undefined
    });

    // Execute: refresh token
    const token = await deviceAuthorizationFlow('https://staging.example.com');

    // Verify
    expect(token).toBe('refreshed-token-12345');
    expect(mockPortal.requestDeviceAuthorization).toHaveBeenCalledWith('staging.example.com');
  });

  test('displays error when instance is not registered in partner portal', async () => {
    // Setup: mock 404 error from partner portal
    mockPortal.requestDeviceAuthorization.mockRejectedValue({
      statusCode: 404,
      options: { uri: 'https://partners.platformos.com/oauth/authorize_device' },
      message: 'Not Found'
    });

    const environment = 'unregistered';
    storeEnvironment({
      environment: environment,
      url: 'https://unregistered-instance.example.com',
      token: 'old-token',
      email: undefined
    });

    // Execute and verify error is thrown
    await expect(
      deviceAuthorizationFlow('https://unregistered-instance.example.com')
    ).rejects.toMatchObject({
      statusCode: 404
    });

    // Verify error message was logged
    expect(mockLogger.Error).toHaveBeenCalledWith(
      expect.stringContaining('Instance https://unregistered-instance.example.com is not registered in the Partner Portal'),
      expect.objectContaining({ hideTimestamp: true, exit: false })
    );
    expect(mockLogger.Error).toHaveBeenCalledWith(
      expect.stringContaining('Please double-check if the instance URL is correct'),
      expect.objectContaining({ hideTimestamp: true, exit: false })
    );
  });

  test('does not display custom error for non-404 errors', async () => {
    // Setup: mock 500 error from partner portal
    mockPortal.requestDeviceAuthorization.mockRejectedValue({
      statusCode: 500,
      options: { uri: 'https://partners.platformos.com/oauth/authorize_device' },
      message: 'Internal Server Error'
    });

    const environment = 'errored';
    storeEnvironment({
      environment: environment,
      url: 'https://errored-instance.example.com',
      token: 'old-token',
      email: undefined
    });

    // Execute and verify error is thrown
    await expect(
      deviceAuthorizationFlow('https://errored-instance.example.com')
    ).rejects.toMatchObject({
      statusCode: 500
    });

    // Verify our custom error message was NOT displayed
    expect(mockLogger.Error).not.toHaveBeenCalledWith(
      expect.stringContaining('is not registered in the Partner Portal'),
      expect.anything()
    );
  });

  test('refreshes token using email/password flow', async () => {
    // Setup: create environment with email
    const environment = 'staging';
    storeEnvironment({
      environment: environment,
      url: 'https://staging.example.com',
      token: 'old-token-12345',
      email: 'user@example.com'
    });

    // Execute: login with email/password
    const Portal = await import('#lib/portal.js');
    const token = await Portal.default.login('user@example.com', 'test-password', 'https://staging.example.com');

    // Verify
    expect(token).toEqual([{ token: 'refreshed-token-12345' }]);
    expect(mockPortal.login).toHaveBeenCalledWith('user@example.com', 'test-password', 'https://staging.example.com');

    // Verify device authorization was NOT called for email/password flow
    expect(mockPortal.requestDeviceAuthorization).not.toHaveBeenCalled();
  });
});
