/**
 * Request validation on the local GUI server.
 *
 * These routes proxy to the connected instance with the user's API token attached, and
 * lib/server.js allows any origin, so malformed input must be rejected before it is
 * forwarded upstream.
 */
import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

const forwarded = { graph: [], liquid: [], logs: [], logsv2: [], sync: [] };

vi.mock('#lib/proxy.js', () => ({
  default: class Gateway {
    graph(body) {
      forwarded.graph.push(body);
      return Promise.resolve({ data: {} });
    }
    liquid(body) {
      forwarded.liquid.push(body);
      return Promise.resolve({ result: 'ok' });
    }
    logs(params) {
      forwarded.logs.push(params);
      return Promise.resolve({ logs: [] });
    }
    logsv2(params) {
      forwarded.logsv2.push(params);
      return Promise.resolve({ logs: [] });
    }
    sync(formData) {
      forwarded.sync.push(formData);
      return Promise.resolve({ status: 'ok' });
    }
  }
}));

vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Success: vi.fn(), Error: vi.fn(), Print: vi.fn(), Warn: vi.fn() }
}));

let server;
let agent;

beforeAll(async () => {
  const { start } = await import('#lib/server.js');
  // Port 0 lets the OS pick a free port, so the suite never collides with a real GUI.
  server = start({ PORT: 0, HOST: '127.0.0.1', MARKETPLACE_URL: 'https://example.com' });
  agent = request(server);
});

afterAll(() => {
  if (server) server.close();
});

describe('POST /api/graph', () => {
  test('forwards a well-formed query', async () => {
    const res = await agent.post('/api/graph').send({ query: '{ records { id } }' });

    expect(res.status).toBe(200);
    expect(forwarded.graph.at(-1).query).toBe('{ records { id } }');
  });

  test('rejects a missing query without calling upstream', async () => {
    const before = forwarded.graph.length;
    const res = await agent.post('/api/graph').send({ variables: {} });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("missing required property 'query'");
    expect(forwarded.graph).toHaveLength(before);
  });

  test('rejects an empty query', async () => {
    const res = await agent.post('/api/graph').send({ query: '' });
    expect(res.status).toBe(400);
  });

  test('rejects a query of the wrong type', async () => {
    const res = await agent.post('/api/graph').send({ query: { evil: true } });
    expect(res.status).toBe(400);
  });

  test('rejects a non-object body', async () => {
    const res = await agent.post('/api/graph').set('Content-Type', 'application/json').send('"just a string"');
    expect(res.status).toBe(400);
  });

  test('keeps accepting extra fields the pre-built GraphiQL bundle may send', async () => {
    const res = await agent
      .post('/api/graph')
      .send({ query: '{ a }', operationName: 'A', variables: { x: 1 }, extensions: {} });

    expect(res.status).toBe(200);
  });
});

describe('/api/liquid', () => {
  test('forwards a well-formed POST body', async () => {
    const res = await agent.post('/api/liquid').send({ content: '{{ 1 | plus: 1 }}' });

    expect(res.status).toBe(200);
    expect(forwarded.liquid.at(-1)).toEqual({ content: '{{ 1 | plus: 1 }}' });
  });

  test('rejects a POST with no content', async () => {
    const res = await agent.post('/api/liquid').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("missing required property 'content'");
  });

  test('reads content from the query string on GET, matching the GUI form', async () => {
    const res = await agent.get('/api/liquid').query({ content: '{{ 2 }}' });

    expect(res.status).toBe(200);
    expect(forwarded.liquid.at(-1).content).toBe('{{ 2 }}');
  });

  test('rejects a GET with no content', async () => {
    const res = await agent.get('/api/liquid');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/logs', () => {
  test('coerces the cursor to a number', async () => {
    const res = await agent.get('/api/logs').query({ lastId: '42' });

    expect(res.status).toBe(200);
    expect(forwarded.logs.at(-1).lastId).toBe(42);
  });

  test('allows a first poll with no cursor', async () => {
    const res = await agent.get('/api/logs');

    expect(res.status).toBe(200);
    expect(forwarded.logs.at(-1).lastId).toBeUndefined();
  });

  // Gateway.logs interpolates the cursor into the request URL, so a value carrying its
  // own query parameters must not reach it.
  test('rejects a cursor that smuggles extra query parameters', async () => {
    const before = forwarded.logs.length;
    const res = await agent.get('/api/logs').query({ lastId: '1&admin=true' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('/lastId');
    expect(forwarded.logs).toHaveLength(before);
  });

  test('rejects a non-numeric cursor', async () => {
    expect((await agent.get('/api/logs').query({ lastId: 'newest' })).status).toBe(400);
  });

  test('rejects a negative cursor', async () => {
    expect((await agent.get('/api/logs').query({ lastId: '-1' })).status).toBe(400);
  });
});

describe('/api/logsv2', () => {
  test('coerces numeric query-string params on GET', async () => {
    const res = await agent.get('/api/logsv2').query({ sql: 'select 1', size: '25', from: '0' });

    expect(res.status).toBe(200);
    expect(forwarded.logsv2.at(-1).size).toBe(25);
    expect(forwarded.logsv2.at(-1).from).toBe(0);
  });

  test('rejects a numeric param that is not a number', async () => {
    const res = await agent.get('/api/logsv2').query({ sql: 'select 1', size: 'lots' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('/size');
  });

  test('rejects a negative size', async () => {
    const res = await agent.post('/api/logsv2').send({ sql: 'select 1', size: -5 });
    expect(res.status).toBe(400);
  });

  test('accepts a POST search body', async () => {
    const res = await agent.post('/api/logsv2').send({ sql: 'select 1', size: 10 });
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/app_builder/marketplace_releases/sync', () => {
  const url = '/api/app_builder/marketplace_releases/sync';

  test('forwards a complete upload', async () => {
    const res = await agent
      .put(url)
      .field('path', 'views/pages/index.liquid')
      .attach('marketplace_builder_file_body', Buffer.from('hello'), 'index.liquid');

    expect(res.status).toBe(200);
    expect(forwarded.sync.at(-1).path).toBe('views/pages/index.liquid');
  });

  test('rejects a missing path', async () => {
    const res = await agent
      .put(url)
      .attach('marketplace_builder_file_body', Buffer.from('hello'), 'index.liquid');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("missing required property 'path'");
  });

  // Previously this dereferenced undefined and surfaced as an unhandled 500.
  test('rejects a missing file with 400 rather than crashing', async () => {
    const res = await agent.put(url).field('path', 'views/pages/index.liquid');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('marketplace_builder_file_body');
  });
});
