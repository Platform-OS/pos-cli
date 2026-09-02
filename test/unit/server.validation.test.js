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

  // 0 is the "from the beginning" sentinel. Before the schema supplied it as a default,
  // an absent cursor put the string "undefined" into the upstream URL.
  test('defaults an absent cursor to 0', async () => {
    const res = await agent.get('/api/logs');

    expect(res.status).toBe(200);
    expect(forwarded.logs.at(-1).lastId).toBe(0);
  });

  // gui/next up to this change built the query with `args.last ?? null`, so every first
  // poll sent the literal string "null". Ajv will not coerce that to an integer, which
  // made the admin Logs page 400 on load. Installed GUI builds still send it.
  test.each(['null', '', 'undefined'])('accepts the cursor an older gui/next sends: %p', async value => {
    const res = await agent.get('/api/logs').query({ lastId: value });

    expect(res.status).toBe(200);
    expect(forwarded.logs.at(-1).lastId).toBe(0);
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

describe('/api/logsv2 payload shapes', () => {
  // gui/next posts the search as an object; the GET route can only ever deliver a string.
  // Both branches are live in Gateway.logsv2, and the union is why the Ajv instance runs
  // with allowUnionTypes.
  test('accepts query as an object on POST', async () => {
    const res = await agent.post('/api/logsv2').send({ query: { sql: 'select 1', from: 0, size: 10 } });

    expect(res.status).toBe(200);
    expect(forwarded.logsv2.at(-1).query).toEqual({ sql: 'select 1', from: 0, size: 10 });
  });

  test('accepts query as a string on GET', async () => {
    const res = await agent.get('/api/logsv2').query({ query: 'select 1' });

    expect(res.status).toBe(200);
    expect(forwarded.logsv2.at(-1).query).toBe('select 1');
  });

  // Coercing mode narrows a scalar into the string half of the union rather than
  // rejecting it; the route is a pass-through, so normalising is the useful behaviour.
  test('coerces a scalar query into the string branch of the union', async () => {
    const res = await agent.post('/api/logsv2').send({ query: 42 });

    expect(res.status).toBe(200);
    expect(forwarded.logsv2.at(-1).query).toBe('42');
  });

  test('rejects a query that matches neither branch of the union', async () => {
    const res = await agent.post('/api/logsv2').send({ query: ['select 1'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('/query');
  });

  // The route runs POST bodies through coercing mode too, so a client that spells a
  // numeric field as a string is normalised rather than rejected.
  test('coerces numeric fields in a POST body', async () => {
    const res = await agent.post('/api/logsv2').send({ sql: 'select 1', size: '25', from: '5' });

    expect(res.status).toBe(200);
    expect(forwarded.logsv2.at(-1).size).toBe(25);
    expect(forwarded.logsv2.at(-1).from).toBe(5);
  });

  test('accepts a searchAround payload', async () => {
    const res = await agent.post('/api/logsv2').send({ key: 'abc', stream_name: 'logs', size: 10 });

    expect(res.status).toBe(200);
    expect(forwarded.logsv2.at(-1).key).toBe('abc');
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

// A schema that will not compile is our defect, not the caller's, so the GUI routes must
// answer 500 rather than 400 — while still refusing to forward the request upstream.
describe('uncompilable schema on a GUI route', () => {
  test('answers 500 and does not call the gateway', async () => {
    const express = (await import('express')).default;
    const bodyParser = (await import('body-parser')).default;
    const { validate } = await import('#lib/validation/index.js');

    let forwardedCalls = 0;
    const app = express();
    app.use(bodyParser.json());
    app.post('/broken', (req, res) => {
      const result = validate({ type: 'not-a-real-type' }, req.body);
      if (!result.valid) {
        return res.status(result.schemaError ? 500 : 400).json({ error: `Invalid request: ${result.message}` });
      }
      forwardedCalls += 1;
      return res.json({ ok: true });
    });

    const res = await request(app).post('/broken').send({ anything: true });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Schema failed to compile');
    expect(forwardedCalls).toBe(0);
  });
});
