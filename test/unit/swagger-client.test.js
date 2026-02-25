/**
 * Unit tests for SwaggerProxy.client() error handling.
 *
 * Changes covered:
 *  - Network errors now route through ServerError.handler instead of logger.Error
 *  - Generic errors now use e.message || e (previously always passed the full object)
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('#lib/logger.js', () => ({
  default: {
    Debug: vi.fn(),
    Warn: vi.fn(),
    Error: vi.fn().mockResolvedValue(undefined),
    Info: vi.fn(),
    Success: vi.fn()
  }
}));

vi.mock('#lib/ServerError.js', () => ({
  default: {
    handler: vi.fn().mockResolvedValue(undefined),
    isNetworkError: vi.fn().mockReturnValue(false)
  }
}));

vi.mock('#lib/settings.js', () => ({
  fetchSettings: vi.fn(),
  loadSettingsFileForModule: vi.fn().mockReturnValue({})
}));

vi.mock('#lib/proxy.js', () => ({
  default: vi.fn().mockImplementation(function() {
    return { getInstance: vi.fn().mockResolvedValue({ id: 'inst-1', uuid: 'uuid-1', url: 'https://test.example.com' }) };
  })
}));

// swagger-client.js imports this for the HTTP client; stub it out
vi.mock('#lib/logsv2/http.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() }
}));

import logger from '#lib/logger.js';
import ServerError from '#lib/ServerError.js';
import { fetchSettings } from '#lib/settings.js';
import { SwaggerProxy } from '#lib/swagger-client.js';

describe('SwaggerProxy.client() error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('calls ServerError.handler on network error', async () => {
    const networkErr = Object.assign(new Error('ECONNREFUSED'), { name: 'RequestError' });
    vi.mocked(fetchSettings).mockRejectedValue(networkErr);
    ServerError.isNetworkError.mockReturnValue(true);

    await SwaggerProxy.client('staging');

    expect(ServerError.handler).toHaveBeenCalledWith(networkErr);
    expect(logger.Error).not.toHaveBeenCalled();
  });

  test('does not call ServerError.handler for 401 statusCode', async () => {
    const err = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    vi.mocked(fetchSettings).mockRejectedValue(err);

    await SwaggerProxy.client('staging');

    expect(ServerError.handler).not.toHaveBeenCalled();
    expect(logger.Error).toHaveBeenCalledWith(
      expect.stringContaining('Unauthorized')
    );
  });

  test('logs error.message for non-network errors that have a message', async () => {
    const err = new Error('Something broke');
    vi.mocked(fetchSettings).mockRejectedValue(err);
    ServerError.isNetworkError.mockReturnValue(false);

    await SwaggerProxy.client('staging');

    expect(logger.Error).toHaveBeenCalledWith('Something broke');
    expect(ServerError.handler).not.toHaveBeenCalled();
  });

  test('logs the error itself when no message property is present', async () => {
    const err = 'raw error string';
    vi.mocked(fetchSettings).mockRejectedValue(err);
    ServerError.isNetworkError.mockReturnValue(false);

    await SwaggerProxy.client('staging');

    expect(logger.Error).toHaveBeenCalledWith('raw error string');
  });
});
