/**
 * The HTTP transport runs every enabled tool — data-clean, deploy-start, graphql-exec — with
 * this machine's platformOS credentials and has no authentication. These tests pin what
 * stands in for it: a loopback-only bind, and a Host/Origin check that runs before any
 * route, body parser or tool.
 *
 * Requests are written to a raw socket so that exactly the headers under test are sent —
 * an HTTP client library always adds a Host header, and a missing Host is one of the cases.
 */
import http from 'http';
import net from 'net';
import os from 'os';
import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

vi.mock('../auth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, resolveAuth: vi.fn(actual.resolveAuth) };
});

import startHttp from '../http-server.js';
import hostValidation from '../host-validation.js';
import { defaultTools } from './helpers/tools.js';
import { resolveAuth } from '../auth.js';

// One map for the default server, so a spy on one of its tools is on the object it dispatches to.
const tools = defaultTools();

const lanAddress = Object.values(os.networkInterfaces())
  .flat()
  .find(i => i && !i.internal && i.family === 'IPv4')?.address;

const NO_LAN_REASON = 'skipped: this machine has no non-loopback IPv4 interface';

/**
 * @param {number} port
 * @param {object} req
 * @param {string} [req.host] - Host header value; omitted entirely when null (HTTP/1.0 only)
 * @param {Record<string,string>} [req.headers]
 * @param {string|object} [req.body] - objects are JSON-encoded
 */
function rawRequest(port, { method = 'GET', path = '/', host, headers = {}, body, httpVersion = '1.1' } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
    const lines = [`${method} ${path} HTTP/${httpVersion}`];
    if (host !== null) lines.push(`Host: ${host ?? `127.0.0.1:${port}`}`);
    for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${value}`);
    if (payload) lines.push('Content-Type: application/json', `Content-Length: ${Buffer.byteLength(payload)}`);
    lines.push('Connection: close', '', '');

    const socket = net.connect({ host: '127.0.0.1', port });
    let raw = '';
    const timer = setTimeout(() => {
      socket.destroy();
      // A response that never ends is a stream that was opened — report what arrived.
      resolve(parse(raw, { streaming: true }));
    }, 1500);
    socket.setEncoding('utf8');
    socket.on('data', chunk => (raw += chunk));
    socket.on('end', () => {
      clearTimeout(timer);
      resolve(parse(raw, { streaming: false }));
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    socket.write(lines.join('\r\n') + payload);
  });
}

function parse(raw, { streaming }) {
  const split = raw.indexOf('\r\n\r\n');
  const head = split === -1 ? raw : raw.slice(0, split);
  const [statusLine, ...headerLines] = head.split('\r\n');
  const headers = Object.fromEntries(headerLines.map(line => {
    const i = line.indexOf(':');
    return [line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()];
  }));
  return { status: Number(statusLine.split(' ')[1]), headers, body: split === -1 ? '' : raw.slice(split + 4), streaming };
}

const forbidden = (message) => ({ jsonrpc: '2.0', error: { code: -32000, message }, id: null });

function expectForbidden(res, message) {
  expect(res.status).toBe(403);
  expect(res.streaming).toBe(false);
  expect(res.headers['content-type']).toMatch(/^application\/json/);
  expect(JSON.parse(res.body)).toEqual(forbidden(message));
}

const connectOutcome = (host, port) => new Promise((resolve) => {
  const socket = net.connect({ host, port });
  socket.setTimeout(5000);
  socket.once('connect', () => { socket.destroy(); resolve('connected'); });
  socket.once('timeout', () => { socket.destroy(); resolve('timeout'); });
  socket.once('error', (err) => resolve(err.code));
});

const MCP_ACCEPT = 'application/json, text/event-stream';
const MODERN_ENVELOPE = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} };
const modernMcpHeaders = name => ({ Accept: MCP_ACCEPT, 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'tools/call', 'Mcp-Name': name });

// Every route, including the long-lived SSE handshake and a path with no route at all: the
// check is app-level, so a route added later is covered without anyone remembering to.
const ROUTES = [
  { name: 'GET /' },
  { name: 'GET / (SSE handshake)', headers: { Accept: 'text/event-stream' } },
  { name: 'GET /health', path: '/health' },
  { name: 'GET /tools', path: '/tools' },
  { name: 'POST /call', method: 'POST', path: '/call', body: { tool: 'envs-list', params: {} } },
  {
    name: 'POST /call-stream (JSON-RPC)',
    method: 'POST',
    path: '/call-stream',
    body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'envs-list', arguments: {} } }
  },
  { name: 'POST /call-stream (legacy stream)', method: 'POST', path: '/call-stream', body: { tool: 'envs-list', params: {} } },
  { name: 'GET /no-such-route', path: '/no-such-route' },
  {
    name: 'POST /mcp (2026-07-28)',
    method: 'POST',
    path: '/mcp',
    headers: modernMcpHeaders('envs-list'),
    body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'envs-list', arguments: {}, _meta: MODERN_ENVELOPE } }
  },
  {
    name: 'POST /mcp (2025-era)',
    method: 'POST',
    path: '/mcp',
    headers: { Accept: MCP_ACCEPT },
    body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'envs-list', arguments: {} } }
  },
  { name: 'GET /mcp', path: '/mcp', headers: { Accept: 'text/event-stream' } }
];

// Messages are the ones @modelcontextprotocol/express 2.0.0 sends, so TASK-15's switch to
// its middleware is invisible to clients.
const REJECTIONS = [
  { name: 'a disallowed Host', request: port => ({ host: `evil.example:${port}` }), message: 'Invalid Host: evil.example' },
  { name: 'a LAN address as Host', request: () => ({ host: '192.168.18.12:5910' }), message: 'Invalid Host: 192.168.18.12' },
  { name: 'a missing Host', request: () => ({ host: null, httpVersion: '1.0' }), message: 'Missing Host header' },
  { name: 'a disallowed Origin', request: () => ({ headers: { Origin: 'http://evil.example' } }), message: 'Invalid Origin: evil.example' },
  { name: 'Origin: null', request: () => ({ headers: { Origin: 'null' } }), message: 'Invalid Origin header: null' }
];

const merge = (route, rejection, port) => {
  const extra = rejection.request(port);
  return { ...route, ...extra, headers: { ...route.headers, ...extra.headers } };
};

describe('default server', () => {
  let server;
  let port;

  beforeAll(async () => {
    server = await startHttp({ port: 0, tools });
    port = server.address().port;
  });

  afterAll(() => new Promise(resolve => server.close(resolve)));

  describe('binds loopback only', () => {
    test('the listener is bound to 127.0.0.1', () => {
      expect(server.listening).toBe(true);
      expect(server.address().address).toBe('127.0.0.1');
    });

    test.skipIf(!lanAddress)(
      lanAddress ? `refuses a connection to this machine's LAN address (${lanAddress})` : `refuses LAN connections — ${NO_LAN_REASON}`,
      async () => {
        expect(await connectOutcome(lanAddress, port)).toBe('ECONNREFUSED');
      },
      15000
    );
  });

  describe.each(ROUTES)('$name', (route) => {
    test.each(REJECTIONS)('answers 403 to $name', async (rejection) => {
      const res = await rawRequest(port, merge(route, rejection, port));
      expectForbidden(res, rejection.message);
    });
  });

  // Host is judged first, as in the SDK, so a request failing both reports the Host.
  test('a request with both a bad Host and a bad Origin is reported by its Host', async () => {
    const res = await rawRequest(port, { path: '/health', host: 'evil.example', headers: { Origin: 'http://evil.example' } });
    expectForbidden(res, 'Invalid Host: evil.example');
  });

  test.each([
    ['a lookalike of localhost', 'localhost.evil.example', 'Invalid Host: localhost.evil.example'],
    ['a rebinding-style name for 127.0.0.1', '127.0.0.1.nip.io', 'Invalid Host: 127.0.0.1.nip.io'],
    ['credentials smuggled before the host', 'localhost@evil.example', 'Invalid Host: evil.example'],
    ['a Host that does not parse', 'a b', 'Invalid Host header: a b']
  ])('rejects %s', async (_name, host, message) => {
    expectForbidden(await rawRequest(port, { path: '/health', host }), message);
  });

  test.each([
    ['a file:// page', 'file://', 'Invalid Origin header: file://'],
    ['a lookalike of localhost', 'http://localhost.evil.example:5910', 'Invalid Origin: localhost.evil.example'],
    ['an origin that does not parse', 'not a url', 'Invalid Origin header: not a url']
  ])('rejects an Origin from %s', async (_name, origin, message) => {
    expectForbidden(await rawRequest(port, { path: '/health', headers: { Origin: origin } }), message);
  });

  // If the check ran after bodyParser, a malformed body would be answered 400 by the parser
  // — i.e. the request was read and processed before anyone asked where it came from.
  test('rejects before the body is parsed', async () => {
    const res = await rawRequest(port, {
      method: 'POST',
      path: '/call',
      headers: { Origin: 'http://evil.example' },
      body: '{"tool": "data-clean", this is not json'
    });
    expectForbidden(res, 'Invalid Origin: evil.example');

    const control = await rawRequest(port, { method: 'POST', path: '/call', body: '{"tool": "data-clean", this is not json' });
    expect(control.status).toBe(400);
  });

  describe('accepts requests addressed to this machine', () => {
    test.each([
      'localhost',
      'localhost:1',
      'LOCALHOST:5910',
      '127.0.0.1',
      '[::1]',
      '[::1]:5910'
    ])('Host %j, no Origin', async (host) => {
      const res = await rawRequest(port, { path: '/health', host });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
    });

    test.each([
      'http://localhost:3000',
      'https://localhost',
      'http://127.0.0.1:6274',
      'http://[::1]:8080'
    ])('Origin %j', async (origin) => {
      const res = await rawRequest(port, { path: '/health', host: `localhost:${port}`, headers: { Origin: origin } });
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
    });

    test('an empty Origin counts as absent', async () => {
      const res = await rawRequest(port, { path: '/health', headers: { Origin: '' } });
      expect(res.status).toBe(200);
    });

    test('a POST from a localhost page still has its body parsed and dispatched', async () => {
      const res = await rawRequest(port, {
        method: 'POST',
        path: '/call',
        headers: { Origin: 'http://localhost:3000' },
        body: { tool: 'no-such-tool', params: {} }
      });
      expect(res.status).toBe(404);
      expect(JSON.parse(res.body)).toEqual({ error: 'tool not found: no-such-tool' });
    });

    test('the SSE handshake still opens for an allowed request', async () => {
      const res = await rawRequest(port, { headers: { Accept: 'text/event-stream', Origin: 'http://localhost:3000' } });
      expect(res.status).toBe(200);
      expect(res.streaming).toBe(true);
      expect(res.body).toContain('event: endpoint');
    });
  });

  describe('a rejected request never reaches a tool', () => {
    let handler;

    beforeEach(() => {
      vi.mocked(resolveAuth).mockClear();
      handler = vi.spyOn(tools.get('data-clean'), 'handler');
    });

    afterEach(() => {
      handler.mockRestore();
    });

    // Valid params with the correct confirmation string: nothing but the Host/Origin check
    // stands between these requests and an instance wipe.
    const CLEAN = { tool: 'data-clean', params: { env: 'staging', confirmation: 'CLEAN DATA', includeSchema: true } };
    const CLEAN_RPC = {
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: { name: 'data-clean', arguments: CLEAN.params }
    };

    test.each(REJECTIONS)('POST /call data-clean with $name', async (rejection) => {
      const res = await rawRequest(port, { ...rejection.request(port), method: 'POST', path: '/call', body: CLEAN });

      // The tool is checked first: that nothing ran is the property, the 403 is how it is reported.
      expect(handler).not.toHaveBeenCalled();
      expect(resolveAuth).not.toHaveBeenCalled();
      expectForbidden(res, rejection.message);
    });

    test.each(REJECTIONS)('JSON-RPC tools/call data-clean with $name', async (rejection) => {
      const res = await rawRequest(port, { ...rejection.request(port), method: 'POST', path: '/call-stream', body: CLEAN_RPC });

      // The tool is checked first: that nothing ran is the property, the 403 is how it is reported.
      expect(handler).not.toHaveBeenCalled();
      expect(resolveAuth).not.toHaveBeenCalled();
      expectForbidden(res, rejection.message);
    });

    const CLEAN_MCP = [
      ['2026-07-28', modernMcpHeaders('data-clean'), { ...CLEAN_RPC, params: { ...CLEAN_RPC.params, _meta: MODERN_ENVELOPE } }],
      ['2025-era', { Accept: MCP_ACCEPT }, CLEAN_RPC]
    ];

    describe.each(CLEAN_MCP)('POST /mcp (%s) data-clean', (_era, headers, body) => {
      test.each(REJECTIONS)('with $name', async (rejection) => {
        const extra = rejection.request(port);
        const res = await rawRequest(port, { ...extra, headers: { ...headers, ...extra.headers }, method: 'POST', path: '/mcp', body });

        // The tool is checked first: that nothing ran is the property, the 403 is how it is reported.
        expect(handler).not.toHaveBeenCalled();
        expect(resolveAuth).not.toHaveBeenCalled();
        expectForbidden(res, rejection.message);
      });

      // The spies are wired to what /mcp actually calls.
      test('control: from an allowed origin it reaches the handler and resolves credentials', async () => {
        vi.mocked(resolveAuth).mockRejectedValueOnce(new Error('stopped before any network call'));

        const res = await rawRequest(port, { method: 'POST', path: '/mcp', headers: { ...headers, Origin: 'http://localhost:3000' }, body });

        expect(res.status).toBe(200);
        expect(res.body).toContain('stopped before any network call');
        expect(handler).toHaveBeenCalledTimes(1);
        expect(resolveAuth).toHaveBeenCalledTimes(1);
      });
    });

    // Without this, the two assertions above would also pass if the spies were not wired to
    // what the server actually calls.
    test('control: the same request from an allowed origin reaches the handler and resolves credentials', async () => {
      vi.mocked(resolveAuth).mockRejectedValueOnce(new Error('stopped before any network call'));

      const res = await rawRequest(port, { method: 'POST', path: '/call', headers: { Origin: 'http://localhost:3000' }, body: CLEAN });

      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).result.ok).toBe(false);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(resolveAuth).toHaveBeenCalledTimes(1);
    });
  });
});

describe('startHttp', () => {
  test('binds and answers the addresses and hostnames it is given', async () => {
    const server = await startHttp({ port: 0, tools, host: '0.0.0.0', allowedHostnames: ['localhost', '127.0.0.1', 'devbox.local'] });
    try {
      const { port } = server.address();
      expect(server.address().address).toBe('0.0.0.0');
      expect((await rawRequest(port, { path: '/health', host: `devbox.local:${port}` })).status).toBe(200);
      expectForbidden(await rawRequest(port, { path: '/health', host: `[::1]:${port}` }), 'Invalid Host: [::1]');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  // The counterpart of the default-server test above: proves the LAN probe reaches this
  // machine, so ECONNREFUSED there means "not bound", not "unroutable".
  test.skipIf(!lanAddress)(
    lanAddress ? `an explicit 0.0.0.0 bind is reachable on ${lanAddress} and still validates Host` : `0.0.0.0 bind — ${NO_LAN_REASON}`,
    async () => {
      const server = await startHttp({ port: 0, tools, host: '0.0.0.0' });
      try {
        const { port } = server.address();
        expect(await connectOutcome(lanAddress, port)).toBe('connected');

        const res = await new Promise((resolve, reject) => {
          http.get({ host: lanAddress, port, path: '/health' }, (r) => {
            let body = '';
            r.on('data', c => (body += c));
            r.on('end', () => resolve({ status: r.statusCode, body }));
          }).on('error', reject);
        });
        expect(res.status).toBe(403);
        expect(JSON.parse(res.body)).toEqual(forbidden(`Invalid Host: ${lanAddress}`));
      } finally {
        await new Promise(resolve => server.close(resolve));
      }
    },
    15000
  );

  test('rejects with the listen error instead of resolving when the port is taken', async () => {
    const holder = net.createServer();
    await new Promise(resolve => holder.listen(0, '127.0.0.1', resolve));
    const { port } = holder.address();
    try {
      await expect(startHttp({ port, tools })).rejects.toMatchObject({ code: 'EADDRINUSE', port });
    } finally {
      await new Promise(resolve => holder.close(resolve));
    }
  });

  test('refuses an allowlist that is not an array, which would match by substring', async () => {
    const notAnArray = new TypeError('hostValidation: allowedHostnames must be an array of hostnames');
    expect(() => hostValidation('localhost,127.0.0.1')).toThrow(notAnArray);
    await expect(startHttp({ port: 0, tools, allowedHostnames: 'localhost,127.0.0.1' })).rejects.toThrow(notAnArray);
  });
});
