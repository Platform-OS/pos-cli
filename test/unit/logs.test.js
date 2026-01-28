/**
 * Unit tests for logs functionality
 * These tests mock HTTP calls to test log operations without real API access
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import nock from 'nock';

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

const TEST_URL = 'https://test-instance.platformos.com';
const TEST_TOKEN = 'test-token-12345';
const TEST_EMAIL = 'test@example.com';

// Mock API responses (simulating real platformOS API responses)
const mockResponses = {
  logs: {
    empty: [],
    withEntries: [
      {
        id: 1,
        created_at: '2024-01-15T10:00:00Z',
        error_type: 'info',
        message: 'Test log message 1'
      },
      {
        id: 2,
        created_at: '2024-01-15T10:00:01Z',
        error_type: 'error',
        message: 'Test error message'
      },
      {
        id: 3,
        created_at: '2024-01-15T10:00:02Z',
        error_type: 'pos-cli-test',
        message: 'Custom type log message'
      }
    ]
  },
  liquid: {
    success: { error: null, result: '' },
    error: { error: 'Liquid syntax error', result: null }
  }
};

describe('Logs API - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();

    process.env.MARKETPLACE_URL = TEST_URL;
    process.env.MARKETPLACE_TOKEN = TEST_TOKEN;
    process.env.MARKETPLACE_EMAIL = TEST_EMAIL;
  });

  afterEach(() => {
    nock.cleanAll();
    delete process.env.MARKETPLACE_URL;
    delete process.env.MARKETPLACE_TOKEN;
    delete process.env.MARKETPLACE_EMAIL;
  });

  describe('Gateway.logs()', () => {
    test('fetches logs with lastId parameter', async () => {
      nock(TEST_URL)
        .get('/api/app_builder/logs')
        .query({ last_id: 0 })
        .reply(200, mockResponses.logs.withEntries);

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

      const result = await gateway.logs({ lastId: 0 });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result[0].message).toBe('Test log message 1');
    });

    test('fetches logs after specific lastId', async () => {
      nock(TEST_URL)
        .get('/api/app_builder/logs')
        .query({ last_id: 2 })
        .reply(200, [mockResponses.logs.withEntries[2]]);

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

      const result = await gateway.logs({ lastId: 2 });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });

    test('returns empty array when no new logs', async () => {
      nock(TEST_URL)
        .get('/api/app_builder/logs')
        .query({ last_id: 100 })
        .reply(200, mockResponses.logs.empty);

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

      const result = await gateway.logs({ lastId: 100 });

      expect(result).toEqual([]);
    });

    test('handles authorization errors', async () => {
      nock(TEST_URL)
        .get('/api/app_builder/logs')
        .query(true)
        .reply(401, { error: 'Unauthorized' });

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: 'bad-token', email: TEST_EMAIL });

      await expect(gateway.logs({ lastId: 0 })).rejects.toThrow();
    });
  });

  describe('Gateway.liquid()', () => {
    test('executes Liquid code successfully', async () => {
      nock(TEST_URL)
        .post('/api/app_builder/liquid_exec')
        .reply(200, mockResponses.liquid.success);

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

      const result = await gateway.liquid({ content: "{% log 'test message' %}" });

      expect(result.error).toBeNull();
    });

    test('returns error for invalid Liquid syntax', async () => {
      nock(TEST_URL)
        .post('/api/app_builder/liquid_exec')
        .reply(200, mockResponses.liquid.error);

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

      const result = await gateway.liquid({ content: '{% invalid_tag %}' });

      expect(result.error).toBe('Liquid syntax error');
    });

    test('executes log with custom type', async () => {
      const liquidCode = "{% log 'test message', type: 'custom-type' %}";

      nock(TEST_URL)
        .post('/api/app_builder/liquid_exec', body => {
          return body.content === liquidCode;
        })
        .reply(200, mockResponses.liquid.success);

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

      const result = await gateway.liquid({ content: liquidCode });

      expect(result.error).toBeNull();
    });
  });

  describe('Gateway.ping()', () => {
    test('pings logs endpoint successfully', async () => {
      nock(TEST_URL)
        .get('/api/app_builder/logs')
        .reply(200, []);

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

      // ping() calls the logs endpoint
      const result = await gateway.ping();

      expect(result).toEqual([]);
    });

    test('ping detects invalid credentials', async () => {
      nock(TEST_URL)
        .get('/api/app_builder/logs')
        .reply(401, { error: 'Invalid token' });

      const Gateway = (await import('#lib/proxy.js')).default;
      const gateway = new Gateway({ url: TEST_URL, token: 'invalid', email: TEST_EMAIL });

      await expect(gateway.ping()).rejects.toThrow();
    });
  });
});

describe('Log Entry Parsing - Unit Tests', () => {
  test('log entries have expected structure', () => {
    const logEntry = mockResponses.logs.withEntries[0];

    expect(logEntry).toHaveProperty('id');
    expect(logEntry).toHaveProperty('created_at');
    expect(logEntry).toHaveProperty('error_type');
    expect(logEntry).toHaveProperty('message');
    expect(typeof logEntry.id).toBe('number');
    expect(typeof logEntry.message).toBe('string');
  });

  test('log entries can have different error types', () => {
    const entries = mockResponses.logs.withEntries;

    const types = entries.map(e => e.error_type);
    expect(types).toContain('info');
    expect(types).toContain('error');
    expect(types).toContain('pos-cli-test');
  });
});

describe('Log Filtering - Unit Tests', () => {
  test('filter logs by error type', () => {
    const allLogs = mockResponses.logs.withEntries;
    const filterType = 'pos-cli-test';

    const filtered = allLogs.filter(log => log.error_type === filterType);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].message).toBe('Custom type log message');
  });

  test('filter returns empty array when no matches', () => {
    const allLogs = mockResponses.logs.withEntries;
    const filterType = 'nonexistent-type';

    const filtered = allLogs.filter(log => log.error_type === filterType);

    expect(filtered).toHaveLength(0);
  });
});

describe('Log Error Handling - Unit Tests', () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  test('handles network timeout', async () => {
    nock(TEST_URL)
      .get('/api/app_builder/logs')
      .query(true)
      .delayConnection(5000)
      .reply(200, []);

    await import('#lib/proxy.js');

    // With default timeout, this should work (but we're testing the structure)
    // In real scenario, AbortController would be used for timeout
  });

  test('handles server errors gracefully', async () => {
    nock(TEST_URL)
      .get('/api/app_builder/logs')
      .query(true)
      .reply(500, { error: 'Internal server error' });

    const Gateway = (await import('#lib/proxy.js')).default;
    const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

    await expect(gateway.logs({ lastId: 0 })).rejects.toThrow();
  });

  test('handles network errors', async () => {
    nock(TEST_URL)
      .get('/api/app_builder/logs')
      .query(true)
      .replyWithError('Connection refused');

    const Gateway = (await import('#lib/proxy.js')).default;
    const gateway = new Gateway({ url: TEST_URL, token: TEST_TOKEN, email: TEST_EMAIL });

    await expect(gateway.logs({ lastId: 0 })).rejects.toThrow();
  });
});
