/**
 * Unit tests for ServerError module
 * Tests HTTP status code handling and network error handling
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('#lib/logger.js', () => ({
  default: {
    Debug: vi.fn(),
    Warn: vi.fn(),
    Error: vi.fn(),
    Info: vi.fn(),
    Success: vi.fn()
  }
}));

// Mock report
vi.mock('#lib/logger/report.js', () => ({
  default: vi.fn()
}));

import ServerError from '#lib/ServerError.js';
import logger from '#lib/logger.js';
import report from '#lib/logger/report.js';

describe('ServerError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isNetworkError', () => {
    test('returns true for StatusCodeError', () => {
      const error = { name: 'StatusCodeError' };
      expect(ServerError.isNetworkError(error)).toBe(true);
    });

    test('returns true for RequestError', () => {
      const error = { name: 'RequestError' };
      expect(ServerError.isNetworkError(error)).toBe(true);
    });

    test('returns false for other error types', () => {
      const error = { name: 'Error' };
      expect(ServerError.isNetworkError(error)).toBe(false);
    });

    test('returns false for TypeError', () => {
      const error = { name: 'TypeError' };
      expect(ServerError.isNetworkError(error)).toBe(false);
    });
  });

  describe('handler', () => {
    test('calls responseHandler for StatusCodeError', () => {
      const responseHandlerSpy = vi.spyOn(ServerError, 'responseHandler');
      const error = {
        name: 'StatusCodeError',
        statusCode: 500,
        options: { uri: 'https://example.com/api' }
      };

      ServerError.handler(error);

      expect(responseHandlerSpy).toHaveBeenCalledWith(error);
      responseHandlerSpy.mockRestore();
    });

    test('calls requestHandler for RequestError', () => {
      const requestHandlerSpy = vi.spyOn(ServerError, 'requestHandler');
      const error = { name: 'RequestError', cause: { code: 'ENOTFOUND' } };

      ServerError.handler(error);

      expect(requestHandlerSpy).toHaveBeenCalledWith(error);
      requestHandlerSpy.mockRestore();
    });

    test('does nothing for unknown error types', () => {
      const responseHandlerSpy = vi.spyOn(ServerError, 'responseHandler');
      const requestHandlerSpy = vi.spyOn(ServerError, 'requestHandler');
      const error = { name: 'Error' };

      ServerError.handler(error);

      expect(responseHandlerSpy).not.toHaveBeenCalled();
      expect(requestHandlerSpy).not.toHaveBeenCalled();
      responseHandlerSpy.mockRestore();
      requestHandlerSpy.mockRestore();
    });
  });

  describe('responseHandler', () => {
    test('handles 504 gateway timeout', async () => {
      const request = {
        statusCode: 504,
        options: { uri: 'https://example.com/api/deploy' }
      };

      await ServerError.responseHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        'Gateway timed out. \nWe have been notified about it.',
        expect.objectContaining({ hideTimestamp: true })
      );
      expect(report).toHaveBeenCalledWith('[504] Gateway timeout');
    });

    test('handles 502 bad gateway', async () => {
      const request = {
        statusCode: 502,
        options: { uri: 'https://example.com/api/deploy' }
      };

      await ServerError.responseHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        'Bad gateway. \nWe have been notified about it.',
        expect.objectContaining({ hideTimestamp: true })
      );
      expect(report).toHaveBeenCalledWith('[502] Bad Gateway');
    });

    test('handles 500 internal server error', async () => {
      const request = {
        statusCode: 500,
        options: { uri: 'https://example.com/api/deploy' }
      };

      await ServerError.responseHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        'Something went wrong on the server. \nWe have been notified about it.',
        expect.objectContaining({ hideTimestamp: true })
      );
      expect(report).toHaveBeenCalledWith('[500] Internal error');
    });

    test('handles 413 entity too large', () => {
      const request = {
        statusCode: 413,
        options: { uri: 'https://example.com/api/deploy' },
        response: { body: {} }
      };

      ServerError.responseHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        'Archive you are trying to send is too large. Limit is 50MB.',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('handles 422 unprocessable entity with error message', () => {
      const request = {
        statusCode: 422,
        options: { uri: 'https://example.com/api/deploy' },
        response: {
          body: {
            error: 'Validation failed',
            details: { file_path: 'app/views/broken.liquid' }
          }
        }
      };

      ServerError.responseHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        'Validation failed\napp/views/broken.liquid',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('handles 422 unprocessable entity with errors array', () => {
      const request = {
        statusCode: 422,
        options: { uri: 'https://example.com/api/deploy' },
        response: {
          body: {
            errors: ['Error 1', 'Error 2']
          }
        }
      };

      ServerError.responseHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        'Error 1, Error 2\n',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('handles 404 not found', () => {
      const request = {
        statusCode: 404,
        options: { uri: 'https://example.com/api/nonexistent' }
      };

      ServerError.responseHandler(request);

      expect(logger.Error).toHaveBeenCalledWith('NotFound: https://example.com/api/nonexistent');
    });

    test('handles 401 unauthorized', () => {
      const request = {
        statusCode: 401,
        options: { uri: 'https://example.com/api/deploy' }
      };

      ServerError.responseHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        'You are unauthorized to do this operation. Check if your Token/URL or email/password are correct.',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('handles unknown status code with default handler', () => {
      const request = {
        statusCode: 418,
        options: { uri: 'https://example.com/api' },
        response: { body: 'I am a teapot' }
      };

      ServerError.responseHandler(request);

      expect(logger.Error).toHaveBeenCalled();
    });
  });

  describe('requestHandler', () => {
    test('handles ENOTFOUND error', () => {
      const request = {
        cause: {
          code: 'ENOTFOUND',
          hostname: 'nonexistent.example.com'
        }
      };

      ServerError.requestHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        'Could not resolve hostname: nonexistent.example.com',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('handles ENETDOWN error', () => {
      const request = {
        cause: {
          code: 'ENETDOWN',
          toString: () => 'Network is down'
        },
        options: { uri: 'https://example.com/api' }
      };

      ServerError.requestHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        'Network is down',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('handles unknown request error', () => {
      const request = {
        cause: {
          code: 'UNKNOWN_ERROR',
          toString: () => 'Something went wrong'
        }
      };

      ServerError.requestHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        'Request to the server failed.',
        expect.objectContaining({ exit: false })
      );
    });
  });

  describe('shouldExit behavior', () => {
    test('does not exit for sync endpoints', () => {
      const request = {
        statusCode: 500,
        options: { uri: 'https://example.com/api/app_builder/releases/sync' }
      };

      ServerError.responseHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ exit: false })
      );
    });

    test('does not exit for graph endpoints', () => {
      const request = {
        statusCode: 500,
        options: { uri: 'https://example.com/api/graph' }
      };

      ServerError.responseHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ exit: false })
      );
    });

    test('exits for other endpoints', () => {
      const request = {
        statusCode: 500,
        options: { uri: 'https://example.com/api/app_builder/marketplace_releases' }
      };

      ServerError.responseHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ exit: true })
      );
    });
  });

  describe('token censoring', () => {
    test('censors API tokens in default error output', () => {
      const request = {
        statusCode: 418,
        options: { uri: 'https://example.com/api' },
        response: {
          headers: {
            authorization: 'Token abc123def456abc123def456abc123def456abcd'
          }
        }
      };

      ServerError.default(request);

      expect(logger.Error).toHaveBeenCalled();
      const errorCall = logger.Error.mock.calls[0][0];
      expect(errorCall).not.toContain('abc123def456abc123def456abc123def456abcd');
      expect(errorCall).toContain('<censored>');
    });
  });

  describe('specific error methods', () => {
    test('gatewayTimeout logs and reports', async () => {
      const request = {
        options: { uri: 'https://example.com/api/deploy' }
      };

      await ServerError.gatewayTimeout(request);

      expect(logger.Debug).toHaveBeenCalled();
      expect(logger.Error).toHaveBeenCalled();
      expect(report).toHaveBeenCalledWith('[504] Gateway timeout');
    });

    test('badGateway logs and reports', async () => {
      const request = {
        options: { uri: 'https://example.com/api/deploy' }
      };

      await ServerError.badGateway(request);

      expect(logger.Debug).toHaveBeenCalled();
      expect(logger.Error).toHaveBeenCalled();
      expect(report).toHaveBeenCalledWith('[502] Bad Gateway');
    });

    test('internal logs and reports', async () => {
      const request = {
        options: { uri: 'https://example.com/api/deploy' }
      };

      await ServerError.internal(request);

      expect(logger.Debug).toHaveBeenCalled();
      expect(logger.Error).toHaveBeenCalled();
      expect(report).toHaveBeenCalledWith('[500] Internal error');
    });

    test('addressNotFound logs hostname', () => {
      const request = {
        cause: { hostname: 'bad.example.com' }
      };

      ServerError.addressNotFound(request);

      expect(logger.Debug).toHaveBeenCalled();
      expect(logger.Error).toHaveBeenCalledWith(
        'Could not resolve hostname: bad.example.com',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('netDown logs network error', () => {
      const request = {
        options: { uri: 'https://example.com/api' }
      };

      ServerError.netDown(request);

      expect(logger.Debug).toHaveBeenCalled();
      expect(logger.Error).toHaveBeenCalledWith(
        'Network is down',
        expect.objectContaining({ hideTimestamp: true })
      );
    });
  });
});
