
import { pathToFileURL } from 'url';
import path from 'path';
import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/proxy', () => {
  class GatewayMock {
    constructor() {}
    async graph(body) {
      if (body.query.includes('throw')) throw new Error('GQL');
      if (body.query.includes('gql_error')) return { errors: [{ message: 'Bad input' }], data: null };
      return { data: { ok: true } };
    }
  }
  return { default: GatewayMock, __esModule: true };
});

const toolUrl = pathToFileURL(path.resolve(process.cwd(), 'mcp-min', 'graphql', 'exec.js')).href;

describe('platformos.graphql.exec', () => {
  let tool;
  beforeAll(async () => {
    const mod = await import(toolUrl);
    tool = mod.default;
  });

  test('success returns data', async () => {
    class LocalGateway { async graph(body) { return { data: { ok: true } }; } }
    const res = await tool.handler({ url: 'https://x', email: 'e', token: 't', query: 'query { ok }' }, { Gateway: LocalGateway });
    expect(res.ok).toBe(true);
    expect(res.result.data.ok).toBe(true);
  });

  test('returns error object when Gateway throws', async () => {
    class LocalGateway { async graph() { throw new Error('GQL'); } }
    const res = await tool.handler({ url: 'https://x', email: 'e', token: 't', query: 'throw' }, { Gateway: LocalGateway });
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('GRAPHQL_EXEC_ERROR');
  });

  test('returns error object when GraphQL response contains errors', async () => {
    class LocalGateway { async graph() { return { errors: [{ message: 'Bad input' }], data: null }; } }
    const res = await tool.handler({ url: 'https://x', email: 'e', token: 't', query: 'gql_error' }, { Gateway: LocalGateway });
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('GRAPHQL_EXEC_ERROR');
  });
});
