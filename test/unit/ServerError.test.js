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

  /**
   * An Instance that could not reach the Partner Portal has not judged the token at all,
   * so the advice a 401 carries -- check it, refresh it -- is the one thing that cannot
   * help. Reported as a 401 (which is what this was before the Instance distinguished it)
   * it costs an operator a working credential while they hunt for a problem that was never
   * theirs, and it stops being reproducible the moment the Portal comes back.
   */
  // A token missing a scope is valid; it is just not allowed to do this. The 401 advice
  // -- refresh the token -- would only mint another one with the same scopes.
  describe('the Partner Portal refusing a global token', () => {
    const refusal = (error) => ({
      name: 'StatusCodeError',
      statusCode: 403,
      options: { uri: 'https://partners.platformos.com/api/tasks/instance/deploy' },
      response: { statusCode: 403, body: { error, errors: ['from the portal'] } }
    });

    test('explains an account without a second factor', async () => {
      await ServerError.handler(refusal('two_factor_not_enabled'));

      const [message] = logger.Error.mock.calls[0];
      expect(message).toContain('two-factor authentication is not enabled on its account');
      expect(message).not.toContain('To refresh your token');
      expect(report).toHaveBeenCalledWith('[403] Two-factor authentication not enabled');
    });

    // The Portal answers it 401, like every two-factor refusal; it must not read as a
    // credential to refresh.
    test('explains an account without a second factor when it arrives as a 401', async () => {
      const request = refusal('two_factor_not_enabled');
      request.statusCode = 401;
      request.response.statusCode = 401;

      await ServerError.handler(request);

      const [message] = logger.Error.mock.calls[0];
      expect(message).toContain('two-factor authentication is not enabled on its account');
      expect(message).not.toContain('To refresh your token');
    });

    // The URL is the Portal's, not the instance's, so it is not presented as the instance.
    test('explains an instance the token does not reach, without naming the Portal as it', async () => {
      await ServerError.handler(refusal('instance_not_covered'));

      const [message] = logger.Error.mock.calls[0];
      expect(message).toContain('This token does not reach this instance, or its owner cannot change it');
      expect(message).not.toContain('partners.platformos.com');
      expect(report).toHaveBeenCalledWith('[403] Instance not covered by token');
    });
  });

  describe('insufficient scope', () => {
    const refusal = (uri, body) => ({
      name: 'StatusCodeError',
      statusCode: 403,
      options: { uri },
      response: { statusCode: 403, body: { error: 'insufficient_scope', ...body } }
    });

    test('names the missing scope and the instance, and never suggests refresh-token as a fix', async () => {
      await ServerError.handler(refusal('https://shop.example.com/api/app_builder/marketplace_releases', {
        required_scopes: ['code:write'],
        errors: [{ message: 'This token does not have the code:write scope' }]
      }));

      const [message, options] = logger.Error.mock.calls[0];
      expect(message).toContain('This token does not have the code:write scope needed for this on shop.example.com.');
      expect(message).toContain('Partner Portal Tokens page');
      expect(message).not.toContain('To refresh your token');
      expect(options).toEqual(expect.objectContaining({ exit: true }));
      expect(report).toHaveBeenCalledWith('[403] Insufficient scope');
    });

    test('names every missing scope of a GraphQL operation, and keeps a graph session alive', async () => {
      await ServerError.handler(refusal('https://shop.example.com/api/graph', {
        required_scopes: ['records:write', 'users:write']
      }));

      const [message, options] = logger.Error.mock.calls[0];
      expect(message).toContain('the records:write and users:write scopes');
      expect(options).toEqual(expect.objectContaining({ exit: false }));
    });

    test.each([
      ['GraphQL-shaped errors', [{ message: 'Liquid needs liquid:exec' }]],
      ['plain string errors', ['Liquid needs liquid:exec']]
    ])('falls back to the reason in %s when no scope is named', async (_name, errors) => {
      await ServerError.handler(refusal('https://shop.example.com/api/app_builder/liquid_exec', { errors }));

      expect(logger.Error.mock.calls[0][0]).toContain("This token's scopes do not allow this on shop.example.com.\nLiquid needs liquid:exec");
    });

    test('leaves any other 403 to the default report', async () => {
      await ServerError.handler({
        name: 'StatusCodeError',
        statusCode: 403,
        options: { uri: 'https://shop.example.com/x' },
        response: { statusCode: 403, body: { error: 'forbidden' } }
      });

      expect(logger.Error.mock.calls[0][0]).not.toContain('scope');
      expect(report).not.toHaveBeenCalled();
    });
  });

  describe('partner portal unavailable', () => {
    const unavailable = (body = {}) => ({
      name: 'StatusCodeError',
      statusCode: 503,
      options: { uri: 'https://shop.example.com/api/app_builder/marketplace_releases' },
      response: {
        statusCode: 503,
        headers: { 'retry-after': '15' },
        body: { error: 'partner_portal_unavailable', errors: ['The Partner Portal at https://partners.example.com answered HTTP 502.'], ...body }
      }
    });

    test('repeats what the instance said and rules out refreshing the token', async () => {
      await ServerError.handler(unavailable());

      expect(logger.Error).toHaveBeenCalledWith(
        'The Partner Portal at https://partners.example.com answered HTTP 502.' +
          '\nThis is not something `pos-cli env refresh-token` can fix — the token was never the problem.',
        expect.objectContaining({ hideTimestamp: true })
      );
      expect(report).toHaveBeenCalledWith('[503] Partner Portal unavailable');
    });

    test('falls back to its own wording when the instance sent no explanation', async () => {
      await ServerError.handler(unavailable({ errors: [] }));

      expect(logger.Error).toHaveBeenCalledWith(
        'This Instance could not reach the Partner Portal to verify your API token.' +
          '\nThis is not something `pos-cli env refresh-token` can fix — the token was never the problem.',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    // 503 is also what a proxy in front of an Instance answers when the Instance itself is
    // down, and saying "the Partner Portal" about that would send someone to the wrong
    // status page.
    test('does not blame the portal for an unrelated 503', async () => {
      await ServerError.handler({ name: 'StatusCodeError', statusCode: 503, options: { uri: 'https://shop.example.com/x' }, response: { statusCode: 503, body: 'nginx' } });

      expect(logger.Error).toHaveBeenCalledWith(
        'The server is temporarily unavailable. Please try again in a moment.',
        expect.objectContaining({ hideTimestamp: true })
      );
      expect(report).toHaveBeenCalledWith('[503] Service Unavailable');
    });
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

    test('handles 401 unauthorized with refresh-token hint', () => {
      const request = {
        statusCode: 401,
        options: { uri: 'https://example.com/api/deploy' }
      };

      ServerError.responseHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        expect.stringContaining('You are unauthorized to do this operation.'),
        expect.objectContaining({ hideTimestamp: true })
      );
      expect(logger.Error).toHaveBeenCalledWith(
        expect.stringContaining('pos-cli env refresh-token'),
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

    test('handles ECONNREFUSED error', async () => {
      const request = {
        cause: {
          code: 'ECONNREFUSED'
        },
        options: { uri: 'http://example.com/api/app_builder/marketplace_releases' }
      };

      await ServerError.requestHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        'Could not connect to http://example.com/api/app_builder/marketplace_releases. Make sure the server is running.',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('handles ECONNRESET error', async () => {
      const request = {
        cause: {
          code: 'ECONNRESET'
        },
        options: { uri: 'https://example.com/api' }
      };

      await ServerError.requestHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        'Could not connect to https://example.com/api. Make sure the server is running.',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('handles ETIMEDOUT error', async () => {
      const request = {
        cause: {
          code: 'ETIMEDOUT'
        },
        options: { uri: 'https://example.com/api' }
      };

      await ServerError.requestHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        'Connection to https://example.com/api timed out. The server may be overloaded or unreachable.',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('handles ECONNABORTED error', async () => {
      const request = {
        cause: {
          code: 'ECONNABORTED'
        },
        options: { uri: 'https://example.com/api' }
      };

      await ServerError.requestHandler(request);

      expect(logger.Error).toHaveBeenCalledWith(
        'Connection to https://example.com/api timed out. The server may be overloaded or unreachable.',
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

    test('connectionRefused logs helpful message with URL', async () => {
      const reason = {
        options: { uri: 'http://example.com/api/app_builder/marketplace_releases' }
      };

      await ServerError.connectionRefused(reason);

      expect(logger.Debug).toHaveBeenCalled();
      expect(logger.Error).toHaveBeenCalledWith(
        'Could not connect to http://example.com/api/app_builder/marketplace_releases. Make sure the server is running.',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('connectionRefused logs helpful message without URL', async () => {
      await ServerError.connectionRefused({});

      expect(logger.Error).toHaveBeenCalledWith(
        'Could not connect. Make sure the server is running.',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('connectionTimedOut logs helpful message with URL', async () => {
      const reason = {
        options: { uri: 'https://example.com/api' }
      };

      await ServerError.connectionTimedOut(reason);

      expect(logger.Debug).toHaveBeenCalled();
      expect(logger.Error).toHaveBeenCalledWith(
        'Connection to https://example.com/api timed out. The server may be overloaded or unreachable.',
        expect.objectContaining({ hideTimestamp: true })
      );
    });
  });
});
