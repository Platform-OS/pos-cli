/**
 * Both MCP transports must reject params that do not match the schema they advertise in
 * tools/list, before the params ever reach a handler.
 */
import http from 'http';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import startHttp from '../http-server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stdioScript = resolve(__dirname, '..', 'stdio-server.js');

const PORT = 5931;
let server;

const post = (path, body) =>
  new Promise((resolvePromise, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port: PORT, path, method: 'POST', headers: { 'Content-Type': 'application/json' } },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolvePromise({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
      }
    );
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });

// No .pos fixture on purpose: every assertion here is about params being rejected before
// a handler runs, and writing .pos into the working directory races other suites.
beforeAll(async () => {
  server = await startHttp({ port: PORT });
});

afterAll(() => {
  if (server) server.close();
});

describe('HTTP POST /call', () => {
  test('rejects a missing required param with 400', async () => {
    const res = await post('/call', { tool: 'constants-set', params: { env: 'staging' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("missing required property 'name'");
    expect(res.body.details).toBeInstanceOf(Array);
  });

  test('rejects an unknown param with 400', async () => {
    const res = await post('/call', { tool: 'envs-list', params: {} });
    expect(res.status).toBe(200);

    const rejected = await post('/call', { tool: 'constants-list', params: { env: 'staging', wat: 1 } });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error).toContain("unknown property 'wat'");
  });

  test('rejects a param of the wrong type with 400', async () => {
    const res = await post('/call', { tool: 'logs-fetch', params: { limit: 'all' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('/limit');
  });

  test('still accepts params that match the schema', async () => {
    const res = await post('/call', { tool: 'envs-list', params: {} });

    expect(res.status).toBe(200);
    expect(res.body.result.ok).toBe(true);
  });
});

describe('HTTP JSON-RPC tools/call', () => {
  test('rejects invalid params with -32602', async () => {
    const res = await post('/call-stream', {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'constants-set', arguments: { env: 'staging' } }
    });

    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32602);
    expect(res.body.error.message).toContain("missing required property 'name'");
  });

  test('accepts valid params', async () => {
    const res = await post('/call-stream', {
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: { name: 'envs-list', arguments: {} }
    });

    expect(res.body.error).toBeUndefined();
    expect(res.body.result.content).toBeDefined();
  });
});

describe('stdio tools/call', () => {
  test('rejects invalid params with -32602', () => new Promise((done, reject) => {
    const child = spawn(process.execPath, [stdioScript], { stdio: ['pipe', 'pipe', 'pipe'] });
    let buffered = '';
    let initialized = false;

    const fail = err => { child.kill(); reject(err); };

    child.stdout.on('data', chunk => {
      buffered += chunk.toString();

      if (!initialized && buffered.includes('protocolVersion')) {
        initialized = true;
        child.stdin.write(JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'constants-set', arguments: { env: 'staging' } }
        }) + '\n');
        return;
      }

      const line = buffered.split('\n').find(l => l.includes('"id":2'));
      if (!line) return;

      try {
        const response = JSON.parse(line);
        expect(response.error.code).toBe(-32602);
        expect(response.error.message).toContain("missing required property 'name'");
        child.kill();
        done();
      } catch (err) {
        fail(err);
      }
    });

    child.on('error', fail);

    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {} }
    }) + '\n');
  }), 15000);
});
