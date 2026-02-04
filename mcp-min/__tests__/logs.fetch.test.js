/* eslint-env jest */
import { pathToFileURL } from 'url';
import path from 'path';
import { jest } from '@jest/globals';

// Mock proxy Gateway to control logs()
jest.unstable_mockModule('../../lib/proxy', () => {
  class GatewayMock {
    constructor({ url, token, email }) {
      this.url = url; this.token = token; this.email = email;
      this.calls = [];
    }
    async logs({ lastId }) {
      // Return synthetic batches based on lastId
      const data = {
        '0': { logs: [{ id: '1', message: 'a' }, { id: '2', message: 'b' }] },
        '2': { logs: [{ id: '3', message: 'c' }] }
      };
      return data[String(lastId)] || { logs: [] };
    }
  }
  return { default: GatewayMock, __esModule: true };
});

const fetchModPath = pathToFileURL(path.resolve(process.cwd(), 'mcp-min', 'logs', 'fetch.js')).href;

describe('platformos.logs.fetch', () => {
  let fetchTool;
  beforeAll(async () => {
    const mod = await import(fetchModPath);
    fetchTool = mod.default;
  });

  test('paginates via lastId and returns collected logs', async () => {
    class LocalGateway {
      async logs({ lastId }) {
        const data = {
          '0': { logs: [{ id: '1', message: 'a' }, { id: '2', message: 'b' }] },
          '2': { logs: [{ id: '3', message: 'c' }] }
        };
        return data[String(lastId)] || { logs: [] };
      }
    }
    const res = await fetchTool.handler({ url: 'https://x', email: 'e', token: 't', lastId: '0' }, { Gateway: LocalGateway });
    expect(Array.isArray(res.logs)).toBe(true);
    expect(res.logs.map((r) => r.id)).toEqual(['1', '2', '3']);
  });

  test('respects limit', async () => {
    class LocalGateway { async logs({ lastId }) { return { logs: [{ id: '1' }, { id: '2' }, { id: '3' }] }; } }
    const res = await fetchTool.handler({ url: 'https://x', email: 'e', token: 't', lastId: '0', limit: 2 }, { Gateway: LocalGateway });
    expect(res.logs.map((r) => r.id)).toEqual(['1', '2']);
  });
});
