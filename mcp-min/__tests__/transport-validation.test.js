/**
 * Both MCP transports must reject params that do not match the schema they advertise in
 * tools/list, before the params ever reach a handler.
 */
import { spawn, spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { describe, test, expect } from 'vitest';
import startHttp from '../http-server.js';
import registry from '../tools.js';
import { rejectionFor } from '../validate-params.js';
import { toolsWith } from './helpers/tools.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const stdioScript = resolve(__dirname, '..', 'stdio-server.js');

// A schema Ajv cannot compile: our own defect, which must never be blamed on the caller.
const BROKEN_SCHEMA_TOOL = {
  description: 'Test-only tool whose schema does not compile',
  inputSchema: { type: 'not-a-real-type' },
  handler: async () => ({ ok: true, data: { reached: 'handler' } })
};


// Drives one request through a freshly spawned stdio server and resolves with the
// response carrying the same id.
const runStdio = message => new Promise((done, reject) => {
  const child = spawn(process.execPath, [stdioScript], { cwd: repoRoot, stdio: 'pipe' });

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
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'pos-cli-tests', version: '1.0.0' } }
  })}\n`);
});

// A tool call the protocol layer accepted and the tool layer refused: a tool execution error,
// which the model can read and correct, not a JSON-RPC error.
const toolError = response => {
  expect(response.error).toBeUndefined();
  expect(response.result.isError).toBe(true);
  return JSON.parse(response.result.content[0].text).error;
};

describe('stdio tools/call', () => {
  test('rejects invalid params as an INVALID_PARAMS tool error, before the handler', async () => {
    const response = await runStdio({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'constants-set', arguments: { env: 'staging' } }
    });

    const error = toolError(response);
    expect(error.code).toBe('INVALID_PARAMS');
    expect(error.message).toContain("missing required property 'name'");
    expect(error.details).toEqual([{ path: '(root)', message: "(root) is missing required property 'name'" }, { path: '(root)', message: "(root) is missing required property 'value'" }]);
  }, 20000);

  test('rejects an unknown param the same way', async () => {
    const error = toolError(await runStdio({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'constants-list', arguments: { env: 'staging', dropTable: true } }
    }));

    expect(error.code).toBe('INVALID_PARAMS');
    expect(error.message).toContain("unknown property 'dropTable'");
  }, 20000);

  test('accepts valid params', async () => {
    const response = await runStdio({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'envs-list', arguments: {} }
    });

    expect(response.error).toBeUndefined();
    expect(response.result.isError).toBeUndefined();
    expect(JSON.parse(response.result.content[0].text).ok).toBe(true);
  }, 20000);
});

// A schema that will not compile is our defect, never the caller's. The SDK builds tools/list
// from the schemas, so one it cannot use would fail the list for every tool; both transports
// therefore refuse to start with one, naming it.
describe('an uncompilable tool schema', () => {
  const REFUSAL = /^Tool input schemas that do not compile: broken-schema \(Schema failed to compile: /;

  test('stops startHttp before it listens', async () => {
    const outcome = await startHttp({ port: 0, tools: toolsWith({ 'broken-schema': BROKEN_SCHEMA_TOOL }) }).then(
      started => new Promise(resolveClose => started.close(() => resolveClose('started'))),
      error => error
    );

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.message).toMatch(REFUSAL);
  });

  test('stops startStdio before it reads stdin', () => {
    const script = [
      `import { toolsWith } from ${JSON.stringify(pathToFileURL(resolve(__dirname, 'helpers', 'tools.js')).href)};`,
      `import startStdio from ${JSON.stringify(pathToFileURL(stdioScript).href)};`,
      "try { startStdio({ tools: toolsWith({ 'broken-schema': { inputSchema: { type: 'not-a-real-type' }, handler: async () => ({ ok: true }) } }) }); console.log('STARTED'); }",
      'catch (err) { console.log(`REFUSED ${err.message}`); }'
    ].join('\n');
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: repoRoot, input: '', encoding: 'utf8', timeout: 20000 });

    expect(result.stdout).toMatch(/^REFUSED /);
    expect(result.stdout.slice('REFUSED '.length)).toMatch(REFUSAL);
  }, 20000);

  // The legacy HTTP routes still map a rejection themselves; the mapping stays pinned even
  // though a transport can no longer start with such a schema.
  test('is mapped by rejectionFor to 500 / -32603, not to the caller-blaming 400 / -32602', () => {
    const rejection = rejectionFor('broken-schema', BROKEN_SCHEMA_TOOL, {});

    expect(rejection).toMatchObject({ httpStatus: 500, jsonRpcCode: -32603 });
    expect(rejection.message).toContain('Schema failed to compile');
    expect(rejectionFor('constants-set', registry.get('constants-set'), {})).toMatchObject({ httpStatus: 400, jsonRpcCode: -32602 });
  });
});

// Invoking a tool by naming it as the method (`{"method":"envs-list"}`) predates MCP: over stdio
// only MCP methods are served.
describe('stdio direct method invocation', () => {
  test('is answered as an unknown method, and the tool does not run', async () => {
    const response = await runStdio({ jsonrpc: '2.0', id: 5, method: 'envs-list', params: {} });

    expect(response.result).toBeUndefined();
    expect(response.error).toEqual({ code: -32601, message: 'Method not found' });
  }, 20000);
});

