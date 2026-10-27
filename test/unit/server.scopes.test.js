/**
 * What the GUI server tells the GUI about a token's scopes, and how it passes on the
 * Instance's refusal. The server enforces nothing itself -- the Instance does -- so the
 * refusal has to reach the browser intact for the GUI to show it.
 */
import { describe, test, expect, vi, afterEach } from 'vitest';
import request from 'supertest';

const refusalBody = {
  error: 'insufficient_scope',
  required_scopes: ['records:write'],
  errors: [{ message: 'This token does not have the records:write scope' }]
};

const insufficientScope = () =>
  Object.assign(new Error('This token does not have the records:write scope'), {
    name: 'StatusCodeError',
    statusCode: 403,
    response: { statusCode: 403, body: refusalBody }
  });

vi.mock('#lib/proxy.js', () => ({
  default: class Gateway {
    graph() {
      return Promise.reject(insufficientScope());
    }
    liquid() {
      return Promise.reject(insufficientScope());
    }
  }
}));

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Success: vi.fn(), Error: vi.fn(), Print: vi.fn(), Warn: vi.fn() }
}));

let server;

const boot = async (options) => {
  const { start } = await import('#lib/server.js');
  server = start({ PORT: 0, HOST: '127.0.0.1', MARKETPLACE_URL: 'https://example.com' }, undefined, options);
  return request(server);
};

afterEach(() => server?.close());

describe('GET /info', () => {
  test("reports the token's scopes", async () => {
    const res = await (await boot({ scopes: ['*:read'] })).get('/info');

    expect(JSON.parse(res.text)).toEqual(expect.objectContaining({ MPKIT_URL: 'https://example.com', scopes: ['*:read'] }));
  });

  test('reports no scopes -- full access -- by default', async () => {
    const res = await (await boot()).get('/info');

    expect(JSON.parse(res.text).scopes).toBeNull();
  });
});

describe('a refused mutation', () => {
  test('reaches the browser as the 403 the Instance sent, body included', async () => {
    const res = await (await boot({ scopes: ['*:read'] })).post('/api/graph').send({ query: 'mutation { x }' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual(refusalBody);
  });
});
