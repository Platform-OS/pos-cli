/**
 * Both MCP transports must reject params that do not match the schema they advertise in
 * tools/list, before the params ever reach a handler.
 */
import http from 'http';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import startHttp from '../http-server.js';
import tools from '../tools.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const stdioScript = resolve(__dirname, '..', 'stdio-server.js');

// A schema Ajv cannot compile, registered as a tool so the schemaError branch — which
// maps to 500 / -32603 rather than the caller-blaming 400 / -32602 — is reachable.
const BROKEN_SCHEMA_TOOL = {
  description: 'Test-only tool whose schema does not compile',
  inputSchema: { type: 'not-a-real-type' },
  handler: async () => ({ ok: true, data: { reached: 'handler' } })
};

let server;
let PORT;

const post = (path, body) =>
  new Promise((resolvePromise, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port: PORT, path, method: 'POST', headers: { 'Content-Type': 'application/json' } },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () =>
          resolvePromise({ status: res.statusCode, headers: res.headers, body: data ? JSON.parse(data) : null })
        );
      }
    );
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });

// No .pos fixture on purpose: every assertion here is about params being rejected before
// a handler runs, and writing .pos into the working directory races other suites.
beforeAll(async () => {
  // The registry is a live object shared with http-server, so adding an entry here is
  // visible to the running server. Port 0 lets the OS assign a free one, which removes
  // the collision this suite previously risked with a hardcoded 5931.
  tools['broken-schema'] = BROKEN_SCHEMA_TOOL;
  server = await startHttp({ port: 0 });
  PORT = server.address().port;
});

afterAll(() => {
  delete tools['broken-schema'];
  if (server) server.close();
});


// Drives one request through a freshly spawned stdio server and resolves with the
// response carrying the same id. `injectBrokenTool` starts the server from an inline
// module that adds the uncompilable-schema tool to the live registry first — the server
// reads tools[name] per request, so a mutation before startStdio() is visible.
const runStdio = (message, { injectBrokenTool = false } = {}) => new Promise((done, reject) => {
  const inline = [
    `import tools from ${JSON.stringify(pathToFileURL(resolve(__dirname, '..', 'tools.js')).href)};`,
    `import startStdio from ${JSON.stringify(pathToFileURL(stdioScript).href)};`,
    `tools['broken-schema'] = { inputSchema: { type: 'not-a-real-type' }, handler: async () => ({ ok: true }) };`,
    'startStdio();'
  ].join('\n');

  const child = injectBrokenTool
    ? spawn(process.execPath, ['--input-type=module', '-e', inline], { cwd: repoRoot, stdio: 'pipe' })
    : spawn(process.execPath, [stdioScript], { cwd: repoRoot, stdio: 'pipe' });

  let buffered = '';
  let sent = false;
  let settled = false;

  const finish = (fn, value) => {
    if (settled) return;
    settled = true;
    child.kill();
    fn(value);
  };

  child.stdout.on('data', chunk => {
    buffered += chunk.toString();

    if (!sent && buffered.includes('protocolVersion')) {
      sent = true;
      child.stdin.write(`${JSON.stringify(message)}\n`);
      return;
    }

    for (const line of buffered.split('\n')) {
      if (!line.trim()) continue;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (parsed.id === message.id) return finish(done, parsed);
    }
  });

  child.on('error', err => finish(reject, err));

  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: 'init',
    method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {} }
  })}\n`);
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
  test('rejects invalid params with -32602', async () => {
    const response = await runStdio({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'constants-set', arguments: { env: 'staging' } }
    });

    expect(response.error.code).toBe(-32602);
    expect(response.error.message).toContain("missing required property 'name'");
  }, 20000);

  test('accepts valid params', async () => {
    const response = await runStdio({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'envs-list', arguments: {} }
    });

    expect(response.error).toBeUndefined();
    expect(response.result.content).toBeDefined();
  }, 20000);
});

// A schema that will not compile is our defect, not the caller's, so it must not be
// reported as 400 / -32602. The mapping lives in one place (rejectionFor); these cover
// each transport path that consumes it.
describe('uncompilable schema is reported as a server error', () => {
  test('HTTP POST /call answers 500, not 400', async () => {
    const res = await post('/call', { tool: 'broken-schema', params: {} });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Schema failed to compile');
    expect(JSON.stringify(res.body)).not.toContain('reached');   // handler never ran
  });

  test('HTTP JSON-RPC tools/call answers -32603, not -32602', async () => {
    const res = await post('/call-stream', {
      jsonrpc: '2.0',
      id: 21,
      method: 'tools/call',
      params: { name: 'broken-schema', arguments: {} }
    });

    expect(res.body.error.code).toBe(-32603);
    expect(res.body.error.message).toContain('Schema failed to compile');
  });

  test('HTTP /call-stream legacy path answers 500 before opening the stream', async () => {
    const res = await post('/call-stream', { tool: 'broken-schema', params: {} });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Schema failed to compile');
  });

  test('stdio tools/call answers -32603', async () => {
    const response = await runStdio(
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'broken-schema', arguments: {} } },
      { injectBrokenTool: true }
    );

    expect(response.error.code).toBe(-32603);
    expect(response.error.message).toContain('Schema failed to compile');
  });
});

// The legacy path invokes a tool by naming it as the JSON-RPC method directly, and
// answers non-JSON-RPC callers with a bare { id, error } instead of an error object.
describe('stdio legacy direct invocation', () => {
  test('rejects invalid params with -32602 for a JSON-RPC caller', async () => {
    const response = await runStdio({ jsonrpc: '2.0', id: 3, method: 'constants-set', params: { env: 'staging' } });

    expect(response.error.code).toBe(-32602);
    expect(response.error.message).toContain("missing required property 'name'");
  });

  test('rejects invalid params with a bare error string for a non-JSON-RPC caller', async () => {
    const response = await runStdio({ id: 4, method: 'constants-set', params: { env: 'staging' } });

    expect(typeof response.error).toBe('string');
    expect(response.error).toContain('Invalid params');
    expect(response.result).toBeUndefined();
  });

  test('accepts valid params on the legacy path', async () => {
    const response = await runStdio({ jsonrpc: '2.0', id: 5, method: 'envs-list', params: {} });

    expect(response.error).toBeUndefined();
    expect(response.result.ok).toBe(true);
  });
});

// HTTP /call-stream legacy streaming path: validation runs before the SSE handshake, so
// a rejection is still an ordinary JSON response with a status code.
describe('HTTP /call-stream legacy streaming', () => {
  test('rejects invalid params with 400 before the stream opens', async () => {
    const res = await post('/call-stream', { tool: 'constants-set', params: { env: 'staging' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("missing required property 'name'");
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  test('rejects an unknown param with 400', async () => {
    const res = await post('/call-stream', { tool: 'constants-list', params: { env: 'staging', nope: 1 } });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("unknown property 'nope'");
  });
});
