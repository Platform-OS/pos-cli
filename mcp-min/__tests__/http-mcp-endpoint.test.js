/**
 * `/mcp`: MCP Streamable HTTP on the HTTP transport — 2026-07-28 exchanges, 2025-era clients
 * served statelessly, and what the Express bridge in protocol/http-endpoint.js adds: a body
 * limit, and a client that goes away cancelling its call.
 */
import http from 'http';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import startHttp from '../http-server.js';
import { MCP_BODY_LIMIT_BYTES } from '../protocol/http-endpoint.js';
import { abortableDelay, cancelled } from '../cancellation.js';
import { defaultTools, toolsWith } from './helpers/tools.js';

const MODERN = '2026-07-28';
const LEGACY = '2025-06-18';

// What the test tools saw, shared with the in-process server.
const polls = { count: 0, stopped: 0 };

const closed = { type: 'object', properties: {}, additionalProperties: false };
const tools = toolsWith({
  'test-echo': {
    description: 'echoes msg',
    inputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'], additionalProperties: false },
    handler: async ({ msg }, ctx) => ({ ok: true, echo: msg, transport: ctx.transport })
  },
  'test-fails': { description: 'reports a failure', inputSchema: closed, handler: async () => ({ ok: false, error: { code: 'TEST_FAILURE', message: 'it did not work' } }) },
  'test-progress': {
    description: 'reports progress',
    inputSchema: closed,
    handler: async (params, ctx) => {
      for (const step of [1, 2, 3]) {
        ctx.sendProgress(step, 3);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      return { ok: true, steps: 3 };
    }
  },
  'test-poll': {
    description: 'polls until cancelled',
    inputSchema: closed,
    handler: async (params, ctx) => {
      for (;;) {
        if (ctx.signal.aborted) {
          polls.stopped += 1;
          return cancelled();
        }
        polls.count += 1;
        await abortableDelay(25, ctx.signal);
      }
    }
  }
});

let server;
let base;

beforeAll(async () => {
  server = await startHttp({ port: 0, tools });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise(resolve => server.close(resolve)));

let nextId = 1;
const envelope = { 'io.modelcontextprotocol/protocolVersion': MODERN, 'io.modelcontextprotocol/clientCapabilities': {} };

const modernRequest = (method, params = {}) => ({ jsonrpc: '2.0', id: nextId++, method, params: { ...params, _meta: envelope } });
const modernHeaders = (message) => ({
  'MCP-Protocol-Version': MODERN,
  'Mcp-Method': message.method,
  ...(message.params?.name !== undefined && { 'Mcp-Name': message.params.name })
});

async function post(body, { headers = {}, contentType = 'application/json', signal } = {}) {
  const response = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, Accept: 'application/json, text/event-stream', ...headers },
    body: typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body),
    signal
  });
  const text = await response.text();
  return { status: response.status, type: response.headers.get('content-type'), text };
}

// A 2025-era exchange answers as SSE; pick out the message that answers `id`.
const sseMessages = text => text.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));

const modern = async (message, extraHeaders = {}) => {
  const res = await post(message, { headers: { ...modernHeaders(message), ...extraHeaders } });
  return { ...res, body: res.type?.includes('text/event-stream') ? sseMessages(res.text).find(m => m.id === message.id) : JSON.parse(res.text) };
};

const legacy = async (method, params) => {
  const message = { jsonrpc: '2.0', id: nextId++, method, ...(params && { params }) };
  const res = await post(message, { headers: { 'MCP-Protocol-Version': LEGACY } });
  return { ...res, body: res.text ? sseMessages(res.text).find(m => m.id === message.id) : undefined };
};

const toolResult = (result) => JSON.parse(result.content[0].text);

describe('a 2026-07-28 client', () => {
  test('discovers, lists and calls tools over plain JSON responses', async () => {
    const discovered = await modern(modernRequest('server/discover'));
    expect(discovered.status).toBe(200);
    expect(discovered.body.result.supportedVersions).toContain(MODERN);

    const listed = await modern(modernRequest('tools/list'));
    expect(listed.body.result.tools.map(t => t.name)).toContain('test-echo');

    const called = await modern(modernRequest('tools/call', { name: 'test-echo', arguments: { msg: 'hi' } }));
    expect(called.type).toContain('application/json');
    expect(called.body.result.isError).toBeUndefined();
    expect(toolResult(called.body.result)).toEqual({ ok: true, echo: 'hi', transport: 'http' });
  });

  test.each([
    ['without Mcp-Method', { 'Mcp-Method': undefined }, 'the required Mcp-Method header is absent'],
    ['with an Mcp-Method that disagrees with the body', { 'Mcp-Method': 'tools/list' }, 'the Mcp-Method header names tools/list'],
    ['without Mcp-Name', { 'Mcp-Name': undefined }, 'the required Mcp-Name header is absent'],
    ['with an Mcp-Name that disagrees with the body', { 'Mcp-Name': 'test-fails' }, 'Mcp-Name']
  ])('a tools/call %s is refused with 400 / -32020', async (_label, override, detail) => {
    const message = modernRequest('tools/call', { name: 'test-echo', arguments: { msg: 'x' } });
    const headers = { ...modernHeaders(message), ...override };
    for (const [name, value] of Object.entries(headers)) if (value === undefined) delete headers[name];

    const res = await post(message, { headers });
    const body = JSON.parse(res.text);
    expect(res.status).toBe(400);
    expect(body.error.code).toBe(-32020);
    expect(body.error.message).toContain(detail);
    expect(body.id).toBe(message.id);
  });

  test('an unsupported revision is refused with -32022 and the supported list', async () => {
    const message = { jsonrpc: '2.0', id: nextId++, method: 'tools/list', params: { _meta: { ...envelope, 'io.modelcontextprotocol/protocolVersion': '1900-01-01' } } };
    const res = await post(message, { headers: { 'MCP-Protocol-Version': '1900-01-01', 'Mcp-Method': 'tools/list' } });

    expect(res.status).toBe(400);
    expect(JSON.parse(res.text).error).toMatchObject({ code: -32022, data: { supported: [MODERN], requested: '1900-01-01' } });
  });

  test('progress for a call streams as SSE before the result', async () => {
    const message = modernRequest('tools/call', { name: 'test-progress', arguments: {} });
    message.params._meta = { ...message.params._meta, progressToken: 'p' };

    const res = await post(message, { headers: modernHeaders(message) });
    expect(res.type).toContain('text/event-stream');
    const messages = sseMessages(res.text);
    expect(messages.filter(m => m.method === 'notifications/progress').map(m => m.params.progress)).toEqual([1, 2, 3]);
    expect(toolResult(messages.at(-1).result)).toEqual({ ok: true, steps: 3 });
  });
});

describe('a 2025-era client, served statelessly', () => {
  test('initializes, lists and calls tools with no session', async () => {
    const init = await legacy('initialize', { protocolVersion: LEGACY, capabilities: {}, clientInfo: { name: 'pos-cli-tests', version: '1.0.0' } });
    expect(init.status).toBe(200);
    expect(init.body.result.protocolVersion).toBe(LEGACY);

    expect((await legacy('tools/list')).body.result.tools.map(t => t.name)).toContain('test-echo');
    expect(toolResult((await legacy('tools/call', { name: 'test-echo', arguments: { msg: 'old' } })).body.result)).toMatchObject({ echo: 'old' });
    expect((await legacy('ping')).body.result).toEqual({});
  });

  test('a notification is accepted with 202 and no body', async () => {
    const res = await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, { headers: { 'MCP-Protocol-Version': LEGACY } });

    expect(res.status).toBe(202);
    expect(res.text).toBe('');
  });

  test.each(['GET', 'DELETE'])('%s /mcp has no session to serve: 405', async (method) => {
    const response = await fetch(`${base}/mcp`, { method, headers: { Accept: 'text/event-stream' } });

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  });
});

describe.each([['2026-07-28', true], ['2025-06-18', false]])('tool failures reach a %s client as tool results', (_revision, isModern) => {
  const call = (name, args) => (isModern
    ? modern(modernRequest('tools/call', { name, arguments: args })).then(r => r.body)
    : legacy('tools/call', { name, arguments: args }).then(r => r.body));

  test('invalid arguments are INVALID_PARAMS', async () => {
    const { result } = await call('test-echo', { msg: 1 });

    expect(result.isError).toBe(true);
    expect(toolResult(result).error).toMatchObject({ code: 'INVALID_PARAMS', message: 'Invalid params: /msg must be string' });
  });

  test('{ ok: false } keeps its code', async () => {
    const { result } = await call('test-fails', {});

    expect(result.isError).toBe(true);
    expect(toolResult(result)).toEqual({ ok: false, error: { code: 'TEST_FAILURE', message: 'it did not work' } });
  });

  test('a client that goes away cancels the call, and the tool stops polling', async () => {
    const before = { ...polls };
    const controller = new AbortController();
    const message = isModern
      ? modernRequest('tools/call', { name: 'test-poll', arguments: {} })
      : { jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'test-poll', arguments: {} } };
    const headers = isModern ? modernHeaders(message) : { 'MCP-Protocol-Version': LEGACY };

    const outcome = post(message, { headers, signal: controller.signal }).then(() => 'answered', err => err.name);
    await expect.poll(() => polls.count - before.count, { timeout: 5000 }).toBeGreaterThan(2);
    controller.abort();

    expect(await outcome).toBe('AbortError');
    await expect.poll(() => polls.stopped - before.stopped, { timeout: 5000 }).toBe(1);
    const after = polls.count;
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(polls.count).toBe(after);
  });
});

describe('the request itself', () => {
  test('a body that is not JSON is refused with -32700', async () => {
    const res = await post('{nope', { headers: { 'MCP-Protocol-Version': LEGACY } });

    expect(res.status).toBe(400);
    expect(JSON.parse(res.text).error.code).toBe(-32700);
  });

  test('a body that is not declared as JSON is refused with 415', async () => {
    const res = await post('{}', { contentType: 'text/plain' });

    expect(res.status).toBe(415);
  });

  const tooLarge = () => JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { pad: 'x'.repeat(MCP_BODY_LIMIT_BYTES) } });

  test('a body declared larger than the limit is refused with 413 before it is read', async () => {
    const res = await post(tooLarge());

    expect(res.status).toBe(413);
    expect(JSON.parse(res.text)).toEqual({ jsonrpc: '2.0', error: { code: -32000, message: 'Request body too large' }, id: null });
  });

  test('a chunked body that grows past the limit is refused with 413', async () => {
    const { port } = server.address();
    const res = await new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: '/mcp', method: 'POST', headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, (response) => {
        let text = '';
        response.on('data', c => (text += c));
        response.on('end', () => resolve({ status: response.statusCode, text }));
      });
      req.on('error', reject);
      const body = tooLarge();
      for (let i = 0; i < body.length; i += 65536) req.write(body.slice(i, i + 65536));
      req.end();
    });

    expect(res.status).toBe(413);
    expect(JSON.parse(res.text).error.message).toBe('Request body too large');
  });
});

// The schema clients receive is the schema arguments are checked against: the same object,
// published unchanged.
test('every exposed tool publishes exactly the input schema it is validated against', async () => {
  const exposed = defaultTools();
  const serverForDefaults = await startHttp({ port: 0, tools: exposed });
  try {
    base = `http://127.0.0.1:${serverForDefaults.address().port}`;
    const { body } = await modern(modernRequest('tools/list'));

    expect(body.result.tools.map(t => t.name)).toEqual([...exposed.keys()]);
    for (const listed of body.result.tools) {
      expect(JSON.stringify(listed.inputSchema), listed.name).toBe(JSON.stringify(exposed.get(listed.name).inputSchema));
    }
  } finally {
    base = `http://127.0.0.1:${server.address().port}`;
    await new Promise(resolve => serverForDefaults.close(resolve));
  }
});
