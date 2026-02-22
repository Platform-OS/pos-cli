
import http from 'http';
import fs from 'fs';
import path from 'path';
import startHttp from '../http-server.js';
import fixtures from '../../test/utils/fixtures';

const PORT = 5930;
let server;

function httpRequest({ method = 'GET', path = '/', body = null, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port: PORT, path, method, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
      }
    );
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

beforeAll(async () => {
  // ensure .pos exists
  fixtures.writeDotPos({ staging: { url: 'https://staging.example.com' } });
  server = await startHttp({ port: PORT });
});

afterAll(() => {
  if (server) server.close();
  fixtures.removeDotPos();
});

test('GET /health returns ok', async () => {
  const res = await httpRequest({ method: 'GET', path: '/health' });
  expect(res.status).toBe(200);
  const parsed = JSON.parse(res.body);
  expect(parsed.status).toBe('ok');
});

test('GET /tools lists tools', async () => {
  const res = await httpRequest({ method: 'GET', path: '/tools' });
  expect(res.status).toBe(200);
  const parsed = JSON.parse(res.body);
  expect(Array.isArray(parsed.tools)).toBe(true);
  expect(parsed.tools.find(t => t.id === 'envs-list')).toBeDefined();
});

test('POST /call returns 400 when tool missing', async () => {
  const res = await httpRequest({ method: 'POST', path: '/call', body: {} });
  expect(res.status).toBe(400);
  const parsed = JSON.parse(res.body);
  expect(parsed.error).toBeDefined();
});

test('POST /call returns 404 for unknown tool', async () => {
  const res = await httpRequest({ method: 'POST', path: '/call', body: { tool: 'no-such' } });
  expect(res.status).toBe(404);
});

test('POST /call envs-list returns ok with data.environments', async () => {
  const res = await httpRequest({ method: 'POST', path: '/call', body: { tool: 'envs-list', params: {} } });
  expect(res.status).toBe(200);
  const parsed = JSON.parse(res.body);
  expect(parsed.result.ok).toBe(true);
  expect(Array.isArray(parsed.result.data.environments)).toBe(true);
});

// JSON-RPC initialize path
test('POST /call-stream initialize returns protocol info', async () => {
  const res = await httpRequest({ method: 'POST', path: '/call-stream', body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } } });
  expect(res.status).toBe(200);
  const parsed = JSON.parse(res.body);
  expect(parsed.result).toBeDefined();
  expect(parsed.result.serverInfo).toBeDefined();
});

// JSON-RPC tools/list
test('POST /call-stream tools/list returns tools array', async () => {
  const res = await httpRequest({ method: 'POST', path: '/call-stream', body: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} } });
  expect(res.status).toBe(200);
  const parsed = JSON.parse(res.body);
  expect(parsed.result.tools).toBeDefined();
  expect(Array.isArray(parsed.result.tools)).toBe(true);
});

// JSON-RPC tools/call -> envs-list
test('POST /call-stream tools/call envs-list returns environments', async () => {
  const res = await httpRequest({ method: 'POST', path: '/call-stream', body: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'envs-list' } } });
  expect(res.status).toBe(200);
  const parsed = JSON.parse(res.body);
  expect(parsed.result).toBeDefined();
  const content = parsed.result.content;
  expect(Array.isArray(content)).toBe(true);
});

// JSON-RPC tools/call -> platformos.graphql.exec error should set non-200
// We simulate by passing bad query that triggers resp.errors handling in tool
// Note: we inject a dummy environment in .pos via fixtures in beforeAll
// The tool will try to read auth from .pos and then fail at Gateway.graph if mocked
// For this HTTP test we rely on real module; we will pass endpoint to a fake URL and expect 500 due to thrown error

test('POST /call-stream tools/call graphql.exec with GraphQL errors returns 200 with error payload', async () => {
  const body = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'platformos.graphql.exec',
      arguments: { url: 'https://example.invalid', email: 'e', token: 't', query: 'gql_error' }
    }
  };
  const res = await httpRequest({ method: 'POST', path: '/call-stream', body });
  expect(res.status).toBe(200);
  const parsed = JSON.parse(res.body);
  expect(parsed.error).toBeDefined();
});

test('POST /call-stream tools/call liquid.exec logical error returns 200 with error payload', async () => {
  const body = {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'platformos.liquid.exec',
      arguments: { url: 'https://example.invalid', email: 'e', token: 't', template: 'logical_error' }
    }
  };
  const res = await httpRequest({ method: 'POST', path: '/call-stream', body });
  expect(res.status).toBe(200);
  const parsed = JSON.parse(res.body);
  expect(parsed.error).toBeDefined();
});
