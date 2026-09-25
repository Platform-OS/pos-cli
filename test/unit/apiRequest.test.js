/**
 * Unit tests for apiRequest module
 * Tests HTTP client, FormData builder, error handling, and keepalive behavior
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';

// Mock fs module
vi.mock('fs');

// Mock path module - just use actual implementation
// The actual path.basename handles both Unix and Windows paths correctly

// Mock logger
vi.mock('#lib/logger.js', () => ({
  default: {
    Debug: vi.fn(),
    Warn: vi.fn(),
    Error: vi.fn(),
    Info: vi.fn()
  }
}));

// Mock global fetch
global.fetch = vi.fn();

describe('apiRequest', () => {
  let apiRequest;

  beforeEach(async () => {
    vi.clearAllMocks();
    global.fetch.mockReset();

    // Import module fresh for each test
    const module = await import('#lib/apiRequest.js');
    apiRequest = module.apiRequest;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildFormData - file uploads', () => {
    test('builds FormData with file object containing path', async () => {
      const fileBuffer = Buffer.from('file content');
      const formData = {
        path: 'app/views/pages/index.liquid',
        marketplace_builder_file_body: {
          path: '/home/user/project/app/views/pages/index.liquid'
        }
      };

      fs.readFileSync.mockReturnValue(fileBuffer);

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'PUT',
        uri: 'https://example.com/api/sync',
        formData
      });

      expect(fs.readFileSync).toHaveBeenCalledWith('/home/user/project/app/views/pages/index.liquid');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/sync',
        expect.objectContaining({
          method: 'PUT',
          body: expect.any(FormData)
        })
      );
    });

    test('builds FormData with Buffer value', async () => {
      const bufferContent = Buffer.from('buffer content');
      const formData = {
        path: 'app/assets/file.txt',
        content: bufferContent
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/upload',
        formData
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/upload',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      );
    });

    test('builds FormData with string values', async () => {
      const formData = {
        path: 'app/views/pages/index.liquid',
        operation: 'sync'
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/sync',
        formData
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/sync',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      );
    });

    test('builds FormData with mixed types', async () => {
      const fileBuffer = Buffer.from('file content');
      const contentBuffer = Buffer.from('content');
      const formData = {
        path: 'app/views/pages/index.liquid',
        file: {
          path: '/home/user/project/file.txt'
        },
        buffer: contentBuffer,
        stringValue: 'test',
        numberValue: 123
      };

      fs.readFileSync.mockReturnValue(fileBuffer);

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/upload',
        formData
      });

      expect(fs.readFileSync).toHaveBeenCalledWith('/home/user/project/file.txt');
      expect(global.fetch).toHaveBeenCalled();
    });

    test('skips undefined values in FormData', async () => {
      const formData = {
        path: 'app/views/pages/index.liquid',
        undefinedValue: undefined,
        stringValue: 'test'
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/sync',
        formData
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    test('skips null values in FormData', async () => {
      const formData = {
        path: 'app/views/pages/index.liquid',
        nullValue: null,
        stringValue: 'test'
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/sync',
        formData
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    test('handles file path with special characters', async () => {
      const fileBuffer = Buffer.from('content');
      const formData = {
        file: {
          path: '/home/user/project/file with spaces & chars.txt'
        }
      };

      fs.readFileSync.mockReturnValue(fileBuffer);

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/upload',
        formData
      });

      expect(fs.readFileSync).toHaveBeenCalled();
    });

    test('handles Windows file paths', async () => {
      const fileBuffer = Buffer.from('content');
      const formData = {
        file: {
          path: 'C:\\Users\\user\\project\\file.txt'
        }
      };

      fs.readFileSync.mockReturnValue(fileBuffer);

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/upload',
        formData
      });

      expect(fs.readFileSync).toHaveBeenCalledWith('C:\\Users\\user\\project\\file.txt');
    });

    test('handles empty file', async () => {
      const emptyBuffer = Buffer.from('');
      const formData = {
        file: {
          path: '/home/user/project/empty.txt'
        }
      };

      fs.readFileSync.mockReturnValue(emptyBuffer);

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/upload',
        formData
      });

      expect(fs.readFileSync).toHaveBeenCalled();
    });

    test('handles large file buffer', async () => {
      const largeBuffer = Buffer.alloc(1024); // Small buffer for testing (simulating 10MB)
      const formData = {
        file: {
          path: '/home/user/project/large.zip'
        }
      };

      fs.readFileSync.mockReturnValue(largeBuffer);

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/upload',
        formData
      });

      expect(fs.readFileSync).toHaveBeenCalled();
    });
  });

  describe('buildFormData - edge cases', () => {
    test('handles empty FormData object', async () => {
      const formData = {};

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/test',
        formData
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/test',
        expect.objectContaining({
          body: expect.any(FormData)
        })
      );
    });

    test('handles object without path property', async () => {
      const formData = {
        data: {
          someProperty: 'value',
          anotherProperty: 123
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/test',
        formData
      });

      // Should convert object to string since it doesn't have a 'path' property
      expect(global.fetch).toHaveBeenCalled();
    });

    test('handles boolean values', async () => {
      const formData = {
        enabled: true,
        disabled: false
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/test',
        formData
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    test('handles number values', async () => {
      const formData = {
        count: 42,
        price: 99.99,
        zero: 0
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/test',
        formData
      });

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('HTTP methods', () => {
    test('sends GET request', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{"data": "test"}')
      });

      await apiRequest({
        method: 'GET',
        uri: 'https://example.com/api/data'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/data',
        expect.objectContaining({ method: 'GET' })
      );
    });

    test('sends POST request with JSON body', async () => {
      const body = { name: 'test', value: 123 };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/data',
        body
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/data',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(body)
        })
      );
    });

    test('sends PUT request', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'PUT',
        uri: 'https://example.com/api/data',
        body: { update: true }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/data',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    test('sends DELETE request', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'DELETE',
        uri: 'https://example.com/api/data/123'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/data/123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Error handling', () => {
    test('throws StatusCodeError for 404 response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValue('{"error": "Not found"}')
      });

      await expect(
        apiRequest({
          method: 'GET',
          uri: 'https://example.com/api/missing'
        })
      ).rejects.toMatchObject({
        name: 'StatusCodeError',
        statusCode: 404,
        response: {
          statusCode: 404,
          body: { error: 'Not found' }
        }
      });
    });

    test('throws StatusCodeError for 500 response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: vi.fn().mockResolvedValue('Internal Server Error')
      });

      await expect(
        apiRequest({
          method: 'POST',
          uri: 'https://example.com/api/data'
        })
      ).rejects.toMatchObject({
        name: 'StatusCodeError',
        statusCode: 500,
        response: {
          statusCode: 500,
          body: 'Internal Server Error'
        }
      });
    });

    test('throws StatusCodeError for 422 response with JSON error', async () => {
      const errorBody = {
        error: 'Validation failed',
        details: { field: 'email' }
      };

      global.fetch.mockResolvedValue({
        ok: false,
        status: 422,
        headers: new Headers(),
        text: vi.fn().mockResolvedValue(JSON.stringify(errorBody))
      });

      await expect(
        apiRequest({
          method: 'POST',
          uri: 'https://example.com/api/data'
        })
      ).rejects.toMatchObject({
        name: 'StatusCodeError',
        statusCode: 422,
        response: {
          statusCode: 422,
          body: errorBody
        }
      });
    });

    test('handles non-JSON error response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: vi.fn().mockResolvedValue('Plain text error')
      });

      await expect(
        apiRequest({
          method: 'GET',
          uri: 'https://example.com/api/data'
        })
      ).rejects.toMatchObject({
        name: 'StatusCodeError',
        statusCode: 500,
        response: {
          body: 'Plain text error'
        }
      });
    });

    test('throws RequestError for network failure', async () => {
      const networkError = new Error('ECONNREFUSED');
      global.fetch.mockRejectedValue(networkError);

      await expect(
        apiRequest({
          method: 'GET',
          uri: 'https://example.com/api/data'
        })
      ).rejects.toMatchObject({
        name: 'RequestError',
        cause: networkError
      });
    });

    test('throws RequestError for timeout', async () => {
      const timeoutError = new Error('Request timeout');
      global.fetch.mockRejectedValue(timeoutError);

      await expect(
        apiRequest({
          method: 'GET',
          uri: 'https://example.com/api/slow'
        })
      ).rejects.toMatchObject({
        name: 'RequestError'
      });
    });

    test('includes headers in error response', async () => {
      const headers = new Headers({
        'content-type': 'application/json',
        'x-request-id': 'abc123'
      });

      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        headers,
        text: vi.fn().mockResolvedValue('{"error": "Forbidden"}')
      });

      await expect(
        apiRequest({
          method: 'GET',
          uri: 'https://example.com/api/data'
        })
      ).rejects.toMatchObject({
        response: {
          headers: expect.objectContaining({
            'content-type': 'application/json',
            'x-request-id': 'abc123'
          })
        }
      });
    });

    test('includes uri in error options', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
        text: vi.fn().mockResolvedValue('Not found')
      });

      const uri = 'https://example.com/api/missing';

      await expect(
        apiRequest({ method: 'GET', uri })
      ).rejects.toMatchObject({
        options: { uri }
      });
    });
  });

  describe('keepalive option', () => {
    test('sets keepalive:true when forever:true is passed', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'GET',
        uri: 'https://example.com/api/logs',
        forever: true
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/logs',
        expect.objectContaining({
          keepalive: true
        })
      );
    });

    test('does not set keepalive when forever is not specified', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'GET',
        uri: 'https://example.com/api/data'
      });

      const fetchCall = global.fetch.mock.calls[0][1];
      expect(fetchCall.keepalive).toBeUndefined();
    });

    test('uses keepalive for long-polling requests', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{"status": "pending"}')
      });

      await apiRequest({
        method: 'GET',
        uri: 'https://example.com/api/status/123',
        forever: true
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/status/123',
        expect.objectContaining({
          keepalive: true
        })
      );
    });
  });

  describe('JSON response handling', () => {
    test('parses JSON response by default', async () => {
      const responseData = { data: 'test', count: 42 };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify(responseData))
      });

      const result = await apiRequest({
        method: 'GET',
        uri: 'https://example.com/api/data'
      });

      expect(result).toEqual(responseData);
    });

    test('returns empty object for empty response', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('')
      });

      const result = await apiRequest({
        method: 'GET',
        uri: 'https://example.com/api/data'
      });

      expect(result).toEqual({});
    });

    test('returns text for malformed JSON when json:true', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('not valid json')
      });

      const result = await apiRequest({
        method: 'GET',
        uri: 'https://example.com/api/data',
        json: true
      });

      expect(result).toBe('not valid json');
    });

    test('returns text when json:false', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('plain text response')
      });

      const result = await apiRequest({
        method: 'GET',
        uri: 'https://example.com/api/data',
        json: false
      });

      expect(result).toBe('plain text response');
    });
  });

  describe('Custom headers', () => {
    test('includes custom headers in request', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'GET',
        uri: 'https://example.com/api/data',
        headers: {
          'Authorization': 'Token abc123',
          'X-Custom-Header': 'value'
        }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Token abc123',
            'X-Custom-Header': 'value'
          })
        })
      );
    });

    test('merges custom headers with default headers', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({
        method: 'POST',
        uri: 'https://example.com/api/data',
        headers: {
          'Authorization': 'Token abc123'
        },
        body: { test: 'data' }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/data',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Token abc123',
            'Content-Type': 'application/json'
          })
        })
      );
    });
  });

  // Without a deadline these inherit undici's five-minute defaults, which reach an operator
  // as a command that stopped rather than a request that failed.
  describe('request deadline', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    // A fetch that answers only when its signal is aborted: the stalled connection the
    // deadline exists for.
    const stalledFetch = () =>
      global.fetch.mockImplementation((_uri, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }));
        });
      }));

    test('rejects a request that runs out of time as a network failure', async () => {
      stalledFetch();

      const promise = apiRequest({ uri: 'https://partners.platformos.com/api/pos_modules', timeout: 3000 });
      // ServerError reads .name to pick a handler and walks to .code for the message, so a
      // deadline has to arrive shaped like every other network failure, not as an AbortError.
      const rejection = expect(promise).rejects.toMatchObject({
        name: 'RequestError',
        code: 'ETIMEDOUT',
        options: { uri: 'https://partners.platformos.com/api/pos_modules' }
      });

      await vi.advanceTimersByTimeAsync(3000);
      await rejection;
    });

    test('leaves a request that answers in time alone', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{"id":1540}')
      });

      await expect(apiRequest({ uri: 'https://partners.platformos.com/api/x', timeout: 3000 }))
        .resolves.toEqual({ id: 1540 });

      // The deadline is cleared on the way out; an armed timer would outlive the command.
      expect(vi.getTimerCount()).toBe(0);
    });

    // A deadline used to be opt-in, and a call that asked for none was handed to fetch with no
    // signal at all. Every request is bounded now; `timeout` only shortens the default, which is
    // what the endpoints with a known answer time do. What that default is, and that it is not
    // reached early, is in 'a request that gets no response' below.
    test('bounds a request that asks for no timeout of its own', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{}')
      });

      await apiRequest({ uri: 'https://partners.platformos.com/api/x' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://partners.platformos.com/api/x',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      // Cleared on the way out all the same: an armed timer would outlive the command.
      expect(vi.getTimerCount()).toBe(0);
    });

    test("does not mistake the caller's own abort for a deadline", async () => {
      stalledFetch();
      const caller = new AbortController();

      const failure = apiRequest({ uri: 'https://partners.platformos.com/api/x', timeout: 60000, signal: caller.signal })
        .catch((e) => e);

      caller.abort();
      await vi.advanceTimersByTimeAsync(0);

      const error = await failure;
      expect(error.name).toBe('RequestError');
      expect(error.message).toMatch(/aborted/);
      // Not ETIMEDOUT: the deadline had not passed, and saying it had would send an
      // operator looking for a slow server instead of the code that cancelled the call.
      expect(error.code).toBeUndefined();
    });
  });
});

/**
 * A request that is never answered.
 *
 * Nothing here passed a timeout to `fetch`, so an instance that accepted a connection and then
 * said nothing held the call for ever. On the CLI a person presses Ctrl-C; the MCP server is
 * long-lived and answers concurrently, and its `ctx.signal` fires only when the *client* gives up,
 * which an agent waiting on a result does not do.
 *
 * Driven on fake timers: a test that really waited five minutes is one nobody runs.
 */
describe('a request that gets no response', () => {
  let apiRequest, RESPONSE_TIMEOUT_MS;

  /** Never resolves, and rejects the way `fetch` does when its signal aborts. */
  const silent = () => {
    const seen = {};
    global.fetch.mockImplementation((_uri, options) => new Promise((_resolve, reject) => {
      seen.signal = options.signal;
      options.signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }));
      }, { once: true });
    }));
    return seen;
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    const module = await import('#lib/apiRequest.js');
    ({ apiRequest, RESPONSE_TIMEOUT_MS } = module);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('comes back rather than hanging, once the bound is reached', async () => {
    silent();
    const call = apiRequest({ uri: 'https://x.example.com/api/app_builder/instance' });
    const settled = call.then(() => 'resolved', (err) => err);

    await vi.advanceTimersByTimeAsync(RESPONSE_TIMEOUT_MS);

    const err = await settled;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/No response in \d+s/);
  });

  // `classify` reads `code` off the chain: ETIMEDOUT is already in its unreachable set, so this
  // reaches a tool as `unavailable` with the host named, the same as a refused connection.
  test('carries the code and the uri that make it an unavailable instance, not a pos-cli defect', async () => {
    silent();
    const settled = apiRequest({ uri: 'https://x.example.com/api/app_builder/instance' }).catch(e => e);

    await vi.advanceTimersByTimeAsync(RESPONSE_TIMEOUT_MS);

    const err = await settled;
    expect(err.name).toBe('RequestError');
    expect(err.code).toBe('ETIMEDOUT');
    expect(err.options.uri).toContain('x.example.com');
  });

  test('is not reached one tick early', async () => {
    silent();
    let done = false;
    apiRequest({ uri: 'https://x.example.com/a' }).catch(() => { done = true; });

    await vi.advanceTimersByTimeAsync(RESPONSE_TIMEOUT_MS - 1);

    expect(done).toBe(false);
  });

  /**
   * Including a request that sends a file. It used to be given a longer bound of its own, on the
   * reasoning that headers cannot arrive until the upload has gone up — but `fetch` caps every
   * request at 300s however patient the caller is, so that bound could never be reached and only
   * made the failure the client's to report rather than ours.
   */
  test('a request carrying a file takes the same bound', async () => {
    fs.readFileSync.mockReturnValue(Buffer.from('zip'));
    silent();
    const settled = apiRequest({
      method: 'POST',
      uri: 'https://x.example.com/releases',
      formData: { file: { path: '/tmp/release.zip' } }
    }).catch(e => e);

    await vi.advanceTimersByTimeAsync(RESPONSE_TIMEOUT_MS);

    expect((await settled).code).toBe('ETIMEDOUT');
  });

  /**
   * The point of the number, and the thing that would silently undo this: a bound above the HTTP
   * client's own 300s cap can never fire, and the client's failure is `fetch failed` — which
   * `ServerError` cannot place, so it prints "Request to the server failed." with no host, no
   * duration and no sign that it timed out.
   */
  test('stays under the cap the HTTP client applies to every request', () => {
    expect(RESPONSE_TIMEOUT_MS).toBeLessThan(300000);
  });

  // The caller's own signal still works, and cancelling is not a timeout.
  test("the caller's signal still cancels, and is reported as itself", async () => {
    silent();
    const controller = new AbortController();
    const settled = apiRequest({ uri: 'https://x.example.com/a', signal: controller.signal }).catch(e => e);

    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    const err = await settled;
    expect(err.code).toBeUndefined();
    expect(err.message).not.toMatch(/No response in/);
  });

  // The clock stops when headers arrive; reading a slow body is never what the bound is for.
  test('a response that arrives leaves no timer behind', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => '{"ok":true}', headers: new Map() });

    await apiRequest({ uri: 'https://x.example.com/a' });

    expect(vi.getTimerCount()).toBe(0);
  });
});
