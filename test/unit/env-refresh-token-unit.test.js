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
    Log: vi.fn(),
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

// Stands in for the readline prompt withTwoFactor() puts up; answers are queued per test.
const otpAnswers = [];
vi.mock('readline', () => ({
  default: {
    createInterface: () => {
      const handlers = {};
      return {
        on: (event, handler) => { handlers[event] = handler; },
        close: () => {},
        question: (_prompt, callback) => {
          if (otpAnswers.length) return callback(otpAnswers.shift());
          return handlers.close?.();
        }
      };
    }
  }
}));

const twoFactorRequired = () => Object.assign(new Error('Request failed with status 401'), {
  name: 'StatusCodeError',
  statusCode: 401,
  response: { statusCode: 401, body: { error: 'two_factor_required', errors: ['Two-factor code required'] } }
});

let refreshToken;
let mockLogger;
let mockPortal;
let originalCwd;
let originalIsTTY;
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

  originalIsTTY = process.stdin.isTTY;
  process.stdin.isTTY = true;
  otpAnswers.length = 0;
  delete process.env.POS_PORTAL_OTP_CODE;
  mockPortal.login.mockResolvedValue([{ token: 'refreshed-token-12345' }]);

  mockPortal.requestDeviceAuthorization.mockResolvedValue({
    verification_uri_complete: 'http://example.com/xxxx',
    device_code: 'device_code',
    interval: 1
  });
});

afterEach(() => {
  process.chdir(originalCwd);
  process.stdin.isTTY = originalIsTTY;
  delete process.env.POS_PORTAL_OTP_CODE;
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
    expect(mockPortal.login).toHaveBeenCalledWith('user@example.com', 'test-password', 'https://staging.example.com', null);
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

  test('sends --otp-code to the portal without prompting', async () => {
    const authData = { url: 'https://staging.example.com', token: 'old-token', email: 'user@example.com' };

    await refreshToken('staging', authData, { otpCode: '123 456' });

    expect(mockPortal.login).toHaveBeenCalledWith(
      'user@example.com', 'test-password', 'https://staging.example.com', '123456'
    );
  });

  test('reads a code from POS_PORTAL_OTP_CODE when no flag is given', async () => {
    process.env.POS_PORTAL_OTP_CODE = '654321';
    const authData = { url: 'https://staging.example.com', token: 'old-token', email: 'user@example.com' };

    await refreshToken('staging', authData);

    expect(mockPortal.login).toHaveBeenCalledWith(
      'user@example.com', 'test-password', 'https://staging.example.com', '654321'
    );
  });

  test('prompts for a code when the portal answers two_factor_required', async () => {
    otpAnswers.push('654321');
    mockPortal.login.mockImplementation((_email, _password, _url, otpCode) => {
      if (!otpCode) return Promise.reject(twoFactorRequired());
      return Promise.resolve([{ token: 'token-behind-2fa' }]);
    });

    const authData = { url: 'https://staging.example.com', token: 'old-token', email: 'user@example.com' };
    const token = await refreshToken('staging', authData);

    expect(token).toBe('token-behind-2fa');
    expect(settingsFromDotPos('staging').token).toBe('token-behind-2fa');
  });

  test('leaves the stored token alone when 2FA cannot be answered', async () => {
    process.stdin.isTTY = false;
    mockPortal.login.mockRejectedValue(twoFactorRequired());

    const authData = { url: 'https://staging.example.com', token: 'old-token', email: 'user@example.com' };

    await expect(refreshToken('staging', authData)).rejects.toMatchObject({ name: 'TwoFactorError' });
    expect(fs.existsSync('.pos')).toBe(false);
  });
});
