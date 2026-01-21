/**
 * Unit tests for apiRequest module
 * Tests HTTP client, FormData builder, error handling, and keepalive behavior
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

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
});
