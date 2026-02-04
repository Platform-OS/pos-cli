
import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

import constantsListTool from '../constants/list.js';
import constantsSetTool from '../constants/set.js';
import constantsUnsetTool from '../constants/unset.js';

const mockSettings = {
  fetchSettings: (env) => {
    if (env === 'staging') {
      return { url: 'https://staging.example.com', email: 'test@example.com', token: 'secret123' };
    }
    return null;
  }
};

describe('constants-list', () => {
  test('lists constants successfully', async () => {
    class MockGateway {
      async graph() {
        return {
          data: {
            constants: {
              results: [
                { name: 'API_KEY', value: 'abc123', updated_at: '2025-01-01T00:00:00Z' },
                { name: 'SECRET', value: 'xyz789', updated_at: '2025-01-02T00:00:00Z' }
              ]
            }
          }
        };
      }
    }

    const res = await constantsListTool.handler(
      { env: 'staging' },
      { Gateway: MockGateway, settings: mockSettings }
    );

    expect(res.ok).toBe(true);
    expect(res.data.constants).toHaveLength(2);
    expect(res.data.constants[0].name).toBe('API_KEY');
    expect(res.data.constants[0].value).toBe('abc123');
    expect(res.data.count).toBe(2);
  });

  test('returns empty list when no constants', async () => {
    class MockGateway {
      async graph() {
        return { data: { constants: { results: [] } } };
      }
    }

    const res = await constantsListTool.handler(
      { env: 'staging' },
      { Gateway: MockGateway, settings: mockSettings }
    );

    expect(res.ok).toBe(true);
    expect(res.data.constants).toHaveLength(0);
    expect(res.data.count).toBe(0);
  });

  test('returns error when env not found', async () => {
    const res = await constantsListTool.handler(
      { env: 'unknown' },
      { settings: mockSettings }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('CONSTANTS_LIST_FAILED');
    expect(res.error.message).toContain('unknown');
  });

  test('handles GraphQL errors', async () => {
    class MockGateway {
      async graph() {
        return { errors: [{ message: 'Unauthorized' }] };
      }
    }

    const res = await constantsListTool.handler(
      { env: 'staging' },
      { Gateway: MockGateway, settings: mockSettings }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('GRAPHQL_ERROR');
    expect(res.error.message).toBe('Unauthorized');
  });

  test('has correct schema', () => {
    expect(constantsListTool.inputSchema.required).toContain('env');
  });
});

describe('constants-set', () => {
  test('sets constant successfully', async () => {
    let capturedQuery;
    class MockGateway {
      async graph({ query }) {
        capturedQuery = query;
        return {
          data: {
            constant_set: { name: 'API_KEY', value: 'newvalue' }
          }
        };
      }
    }

    const res = await constantsSetTool.handler(
      { env: 'staging', name: 'API_KEY', value: 'newvalue' },
      { Gateway: MockGateway, settings: mockSettings }
    );

    expect(res.ok).toBe(true);
    expect(res.data.name).toBe('API_KEY');
    expect(res.data.value).toBe('newvalue');
    expect(capturedQuery).toContain('constant_set');
    expect(capturedQuery).toContain('API_KEY');
  });

  test('escapes quotes in name and value', async () => {
    let capturedQuery;
    class MockGateway {
      async graph({ query }) {
        capturedQuery = query;
        return { data: { constant_set: { name: 'test', value: 'val' } } };
      }
    }

    await constantsSetTool.handler(
      { env: 'staging', name: 'KEY"WITH"QUOTES', value: 'value"here' },
      { Gateway: MockGateway, settings: mockSettings }
    );

    expect(capturedQuery).toContain('\\"');
  });

  test('returns error when env not found', async () => {
    const res = await constantsSetTool.handler(
      { env: 'unknown', name: 'KEY', value: 'val' },
      { settings: mockSettings }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('CONSTANTS_SET_FAILED');
  });

  test('handles GraphQL errors', async () => {
    class MockGateway {
      async graph() {
        return { errors: [{ message: 'Invalid name' }] };
      }
    }

    const res = await constantsSetTool.handler(
      { env: 'staging', name: 'BAD', value: 'val' },
      { Gateway: MockGateway, settings: mockSettings }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('GRAPHQL_ERROR');
  });

  test('has correct schema', () => {
    expect(constantsSetTool.inputSchema.required).toContain('env');
    expect(constantsSetTool.inputSchema.required).toContain('name');
    expect(constantsSetTool.inputSchema.required).toContain('value');
  });
});

describe('constants-unset', () => {
  test('deletes constant successfully', async () => {
    let capturedQuery;
    class MockGateway {
      async graph({ query }) {
        capturedQuery = query;
        return {
          data: {
            constant_unset: { name: 'OLD_KEY' }
          }
        };
      }
    }

    const res = await constantsUnsetTool.handler(
      { env: 'staging', name: 'OLD_KEY' },
      { Gateway: MockGateway, settings: mockSettings }
    );

    expect(res.ok).toBe(true);
    expect(res.data.name).toBe('OLD_KEY');
    expect(res.data.deleted).toBe(true);
    expect(capturedQuery).toContain('constant_unset');
  });

  test('handles non-existent constant', async () => {
    class MockGateway {
      async graph() {
        return { data: { constant_unset: null } };
      }
    }

    const res = await constantsUnsetTool.handler(
      { env: 'staging', name: 'NONEXISTENT' },
      { Gateway: MockGateway, settings: mockSettings }
    );

    expect(res.ok).toBe(true);
    expect(res.data.name).toBe('NONEXISTENT');
    expect(res.data.deleted).toBe(false);
  });

  test('returns error when env not found', async () => {
    const res = await constantsUnsetTool.handler(
      { env: 'unknown', name: 'KEY' },
      { settings: mockSettings }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('CONSTANTS_UNSET_FAILED');
  });

  test('handles GraphQL errors', async () => {
    class MockGateway {
      async graph() {
        return { errors: [{ message: 'Forbidden' }] };
      }
    }

    const res = await constantsUnsetTool.handler(
      { env: 'staging', name: 'KEY' },
      { Gateway: MockGateway, settings: mockSettings }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('GRAPHQL_ERROR');
  });

  test('has correct schema', () => {
    expect(constantsUnsetTool.inputSchema.required).toContain('env');
    expect(constantsUnsetTool.inputSchema.required).toContain('name');
  });
});
