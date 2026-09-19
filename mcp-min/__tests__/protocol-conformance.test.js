/**
 * MCP over stdio, driven with raw JSON-RPC lines the way clients send them: 2026-07-28 clients
 * (`server/discover` and the per-request `_meta` envelope) and clients on the 2025 revisions
 * (`initialize`), against a spawned server.
 *
 * The protocol itself belongs to the MCP TypeScript SDK; what is pinned here is what this
 * server promises on top of it — both eras served from one definition, tool failures reported
 * as tool results with an error code, cancellation reaching the tool, nothing ever written in
 * reply to a notification.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import { HEARTBEAT_MS } from '../protocol/server-factory.js';
import {
  launch, stop, stopAll, request, send, stdoutMessages, waitFor, closeStdin, exitWithin, makeWorkDir,
  MCP_BIN, REPO_ROOT
} from './helpers/server-process.js';

const MODERN = '2026-07-28';
const LEGACY_REVISIONS = ['2025-11-25', '2025-06-18', '2024-11-05'];
const CLIENT_INFO = { name: 'pos-cli-tests', version: '1.0.0' };

let workDir;
let testServerScript;

// A stdio server exposing the real default tools plus test tools whose behaviour each case needs.
const TEST_SERVER = `
import { toolsWith } from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, 'mcp-min', '__tests__', 'helpers', 'tools.js')).href)};
import startStdio from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, 'mcp-min', 'stdio-server.js')).href)};
import { abortableDelay, cancelled } from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, 'mcp-min', 'cancellation.js')).href)};
import { ToolError } from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, 'mcp-min', 'tool-error.js')).href)};

const closed = { type: 'object', properties: {}, additionalProperties: false };
startStdio({ tools: toolsWith({
  'test-echo': {
    description: 'echoes msg',
    inputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'], additionalProperties: false },
    handler: async ({ msg }, ctx) => ({ echo: msg, transport: ctx.transport })
  },
  'test-fails': { description: 'reports a failure', inputSchema: closed, handler: async () => { throw new ToolError('instance', 'TEST_FAILURE', 'it did not work'); } },
  'test-throws': { description: 'throws', inputSchema: closed, handler: async () => { throw new Error('kaboom'); } },
  'test-progress': {
    description: 'reports progress',
    inputSchema: { type: 'object', properties: { steps: { type: 'array', items: { type: 'number' } } } },
    handler: async ({ steps = [] }, ctx) => { for (const step of steps) ctx.sendProgress(step, 10, 'step ' + step); }
  },
  'test-quiet': { description: 'says nothing for a while', inputSchema: closed, handler: async () => { await new Promise(r => setTimeout(r, ${HEARTBEAT_MS} + 700)); } },
  'test-poll': {
    description: 'polls until cancelled',
    inputSchema: closed,
    handler: async (params, ctx) => {
      for (let i = 1; ; i++) {
        if (ctx.signal.aborted) { process.stderr.write('test-poll stopped\\n'); return cancelled(); }
        process.stderr.write('test-poll poll ' + i + '\\n');
        await abortableDelay(50, ctx.signal);
      }
    }
  }
}) });
`;

beforeAll(() => {
  workDir = makeWorkDir('pos-cli-mcp-conformance');
  testServerScript = path.join(workDir, 'test-server.mjs');
  fs.writeFileSync(testServerScript, TEST_SERVER);
});

afterAll(async () => {
  await stopAll();
  fs.rmSync(workDir, { recursive: true, force: true });
});

let nextId = 1;
const envelope = (extra = {}) => ({
  'io.modelcontextprotocol/protocolVersion': MODERN,
  'io.modelcontextprotocol/clientCapabilities': {},
  ...extra
});
const modern = (method, params = {}, meta = {}) => ({ jsonrpc: '2.0', id: `m${nextId++}`, method, params: { ...params, _meta: envelope(meta) } });
const legacy = (method, params) => ({ jsonrpc: '2.0', id: `l${nextId++}`, method, ...(params && { params }) });

async function withServer(fn, args = [testServerScript]) {
  const proc = launch({ workDir, args, env: { MCP_MIN_PORT: '0' } });
  try {
    return await fn(proc);
  } finally {
    await stop(proc);
  }
}

const openModern = async proc => (await request(proc, modern('server/discover'))).result;
const openLegacy = async (proc, protocolVersion = '2025-06-18') => {
  const init = await request(proc, legacy('initialize', { protocolVersion, capabilities: {}, clientInfo: CLIENT_INFO }));
  send(proc, { jsonrpc: '2.0', method: 'notifications/initialized' });
  return init;
};

// The body of a tool execution error, which the model reads.
const toolError = (response) => {
  expect(response.error).toBeUndefined();
  expect(response.result.isError).toBe(true);
  return JSON.parse(response.result.content[0].text);
};

const toolOk = (response) => {
  expect(response.error).toBeUndefined();
  expect(response.result.isError).toBeUndefined();
  return JSON.parse(response.result.content[0].text);
};

describe('a 2026-07-28 client', () => {
  test('discovers the server: supported revision, tools capability, package name and version', async () => {
    await withServer(async (proc) => {
      const discovered = await openModern(proc);

      expect(discovered.supportedVersions).toContain(MODERN);
      expect(discovered.capabilities.tools).toBeDefined();
      expect(discovered._meta['io.modelcontextprotocol/serverInfo']).toEqual({ name: 'pos-cli-mcp', version: pkg.version });
      expect(discovered.resultType).toBe('complete');
    }, [MCP_BIN, '--no-http']);
  }, 30000);

  test('lists and calls tools, with the result shape of this revision', async () => {
    await withServer(async (proc) => {
      await openModern(proc);

      const list = await request(proc, modern('tools/list'));
      expect(list.result.tools.find(t => t.name === 'test-echo').inputSchema)
        .toEqual({ type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'], additionalProperties: false });
      expect(list.result.resultType).toBe('complete');

      const call = await request(proc, modern('tools/call', { name: 'test-echo', arguments: { msg: 'hi' } }));
      expect(toolOk(call)).toMatchObject({ ok: true, data: { echo: 'hi', transport: 'stdio' } });
      expect(call.result.resultType).toBe('complete');
    });
  }, 30000);

  test('an unsupported revision is refused with -32022 and the supported list', async () => {
    await withServer(async (proc) => {
      const refused = await request(proc, modern('server/discover', {}, { 'io.modelcontextprotocol/protocolVersion': '1900-01-01' }));

      expect(refused.error.code).toBe(-32022);
      expect(refused.error.data).toEqual({ supported: [MODERN], requested: '1900-01-01' });
    });
  }, 30000);

  // `server/discover` alone is a probe: a client may still fall back to `initialize`. The first
  // enveloped request after it pins the connection to 2026-07-28, and from then on every
  // request must carry the envelope.
  test('once the connection is on this revision, a request without the envelope is refused with -32602', async () => {
    await withServer(async (proc) => {
      await openModern(proc);
      await request(proc, modern('tools/list'));

      const bare = await request(proc, legacy('tools/list', {}));
      expect(bare.error.code).toBe(-32602);
      expect(bare.error.message).toBe(
        'Request is missing the required _meta envelope for protocol revision 2026-07-28 ' +
        '(io.modelcontextprotocol/protocolVersion, io.modelcontextprotocol/clientCapabilities)'
      );

      const partial = await request(proc, { jsonrpc: '2.0', id: 'partial', method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': MODERN } } });
      expect(partial.error.code).toBe(-32602);
      expect(partial.error.message).toContain('Invalid _meta envelope for protocol revision 2026-07-28');
    });
  }, 30000);

  test('an opening request with an incomplete envelope is refused with -32602 naming the missing key', async () => {
    await withServer(async (proc) => {
      const partial = await request(proc, { jsonrpc: '2.0', id: 'opening', method: 'server/discover', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': MODERN } } });

      expect(partial.error).toMatchObject({ code: -32602, data: { envelope: { key: 'io.modelcontextprotocol/clientCapabilities', problem: 'missing' } } });
    });
  }, 30000);

  test('ping is not a method of this revision', async () => {
    await withServer(async (proc) => {
      await openModern(proc);

      expect((await request(proc, modern('ping'))).error).toEqual({ code: -32601, message: 'Method not found' });
    });
  }, 30000);
});

describe.each(LEGACY_REVISIONS)('a %s client', (revision) => {
  test('negotiates its revision, lists and calls tools, and is answered to ping', async () => {
    await withServer(async (proc) => {
      const init = await openLegacy(proc, revision);
      expect(init.result.protocolVersion).toBe(revision);
      expect(init.result.serverInfo).toEqual({ name: 'pos-cli-mcp', version: pkg.version });

      const list = await request(proc, legacy('tools/list'));
      expect(list.result.tools.map(t => t.name)).toContain('test-echo');

      expect(toolOk(await request(proc, legacy('tools/call', { name: 'test-echo', arguments: { msg: revision } })))).toMatchObject({ data: { echo: revision } });
      expect((await request(proc, legacy('ping'))).result).toEqual({});
    });
  }, 30000);
});

describe.each([['2026-07-28', true], ['2025-06-18', false]])('tool failures reach a %s client as tool results', (_revision, isModern) => {
  const call = (name, args) => (isModern ? modern('tools/call', { name, arguments: args }) : legacy('tools/call', { name, arguments: args }));
  const open = proc => (isModern ? openModern(proc) : openLegacy(proc));

  test('invalid arguments: INVALID_PARAMS, before the tool runs', async () => {
    await withServer(async (proc) => {
      await open(proc);

      const missing = toolError(await request(proc, call('test-echo', {})));
      // `kind` too: a rejection decided before the handler ran is still a failure, and the server
      // instructions tell the model every failure carries one. This was the single result that
      // arrived without it.
      expect(missing).toEqual({
        ok: false,
        error: {
          kind: 'input',
          code: 'INVALID_PARAMS',
          message: "Invalid params: (root) is missing required property 'msg'",
          details: [{ path: '(root)', message: "(root) is missing required property 'msg'" }]
        }
      });

      const unknown = toolError(await request(proc, call('test-echo', { msg: 'x', extra: 1 })));
      expect(unknown.error.message).toContain("unknown property 'extra'");
    });
  }, 30000);

  test('a tool reporting { ok: false }: its own code and message', async () => {
    await withServer(async (proc) => {
      await open(proc);

      expect(toolError(await request(proc, call('test-fails', {})))).toMatchObject({ ok: false, error: { code: 'TEST_FAILURE', message: 'it did not work' } });
    });
  }, 30000);

  test('a tool that throws: INTERNAL_ERROR with the message', async () => {
    await withServer(async (proc) => {
      await open(proc);

      expect(toolError(await request(proc, call('test-throws', {})))).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'kaboom' } });
    });
  }, 30000);

  test('an unknown tool stays a protocol error', async () => {
    await withServer(async (proc) => {
      await open(proc);

      expect((await request(proc, call('no-such-tool', {}))).error).toEqual({ code: -32602, message: 'Tool no-such-tool not found' });
    });
  }, 30000);

  test('progress goes out only when asked for, and only ever increases', async () => {
    await withServer(async (proc) => {
      await open(proc);
      const withToken = call('test-progress', { steps: [2, 5, 3, 9] });
      withToken.params._meta = { ...withToken.params._meta, progressToken: 'tok' };

      await request(proc, withToken);
      const progress = stdoutMessages(proc).filter(m => m.method === 'notifications/progress');
      expect(progress.map(m => m.params)).toEqual([
        { progressToken: 'tok', progress: 2, total: 10, message: 'step 2' },
        { progressToken: 'tok', progress: 5, total: 10, message: 'step 5' },
        { progressToken: 'tok', progress: 6, total: 10, message: 'step 3' },
        { progressToken: 'tok', progress: 9, total: 10, message: 'step 9' }
      ]);

      const before = stdoutMessages(proc).length;
      await request(proc, call('test-progress', { steps: [1, 2] }));
      expect(stdoutMessages(proc).slice(before).filter(m => m.method === 'notifications/progress')).toEqual([]);
    });
  }, 30000);

  test('a long call with a progress token gets a heartbeat', async () => {
    await withServer(async (proc) => {
      await open(proc);
      const quiet = call('test-quiet', {});
      quiet.params._meta = { ...quiet.params._meta, progressToken: 'hb' };

      await request(proc, quiet, 20000);
      const beats = stdoutMessages(proc).filter(m => m.method === 'notifications/progress' && m.params.progressToken === 'hb');
      expect(beats).toEqual([{ jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken: 'hb', progress: 1, message: 'working' } }]);
    });
  }, 30000);

  test('notifications/cancelled stops the tool polling, and nothing is sent for the call', async () => {
    await withServer(async (proc) => {
      await open(proc);
      const poll = call('test-poll', {});
      send(proc, poll);
      await waitFor(proc, p => p.stderr.includes('test-poll poll 3'), 'the tool to be polling');

      send(proc, { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: poll.id, reason: 'test', ...(isModern && { _meta: envelope() }) } });
      await waitFor(proc, p => p.stderr.includes('test-poll stopped'), 'the tool to stop polling');
      const polls = proc.stderr.match(/test-poll poll \d+/g).length;

      // Still answering, and still nothing for the cancelled call.
      await request(proc, isModern ? modern('tools/list') : legacy('tools/list'));
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(proc.stderr.match(/test-poll poll \d+/g)).toHaveLength(polls);
      expect(stdoutMessages(proc).find(m => m.id === poll.id)).toBeUndefined();
    });
  }, 30000);
});

// The heartbeat for a call with a progress token is an interval: left running, it holds the event
// loop open and the server outlives its client. Only a call that asked for progress has one, which
// is why the lifecycle tests cannot see this.
describe('a finished call holds nothing open', () => {
  test.each([['with a progress token', 'held'], ['without one', undefined]])('%s, the server exits when its client leaves', async (_label, progressToken) => {
    const proc = launch({ workDir, args: [testServerScript] });
    try {
      await openLegacy(proc);
      const call = legacy('tools/call', { name: 'test-progress', arguments: { steps: [1, 2] } });
      if (progressToken !== undefined) call.params._meta = { progressToken };
      expect(toolOk(await request(proc, call))).toMatchObject({ ok: true, data: null });

      closeStdin(proc);
      const exit = await exitWithin(proc, 10000);

      expect(exit, `still running\n${proc.stderr}`).not.toBeNull();
      expect(exit.code).toBe(0);
    } finally {
      await stop(proc);
    }
  }, 30000);
});

describe('notifications', () => {
  test.each([['2026-07-28', true], ['2025-06-18', false]])('are never answered (%s)', async (_revision, isModern) => {
    await withServer(async (proc) => {
      if (isModern) await openModern(proc);
      else await openLegacy(proc);
      const before = stdoutMessages(proc).length;

      send(proc, { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 'never-sent', ...(isModern && { _meta: envelope() }) } });
      send(proc, { jsonrpc: '2.0', method: 'notifications/no-such-notification', params: {} });
      send(proc, { jsonrpc: '2.0', method: 'notifications/initialized' });
      const marker = isModern ? modern('tools/list') : legacy('tools/list');
      await request(proc, marker);

      expect(stdoutMessages(proc).slice(before).map(m => m.id)).toEqual([marker.id]);
    });
  }, 30000);
});
