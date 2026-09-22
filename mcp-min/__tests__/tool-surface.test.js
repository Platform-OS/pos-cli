/**
 * The tool selection as clients meet it: a spawned `pos-cli-mcp` with --profile,
 * --include-tools and --exclude-tools, observed on every path that lists or calls tools, and
 * `pos-cli mcp-config` asked about the same selection.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import startHttp from '../http-server.js';
import registry from '../tools.js';
import {
  launch, stop, stopAll, boundUrl, request, send, stdoutMessages, waitFor, exitWithin, makeWorkDir, serverEnv,
  MCP_BIN, MCP_CONFIG_BIN, POS_CLI_BIN, STDIO_SERVER, LISTENING
} from './helpers/server-process.js';

const DEV_TOOLS = [
  'envs-list', 'logs-fetch', 'liquid-exec', 'graphql-exec', 'job-status', 'deploy-dry-run',
  'deploy-start', 'unit-tests-run', 'tests-run-async', 'check-run'
];

// The profile exists to keep this payload small, so growth past the budget needs a deliberate
// bump rather than a quiet one. Currently 6,228 bytes over stdio, plus 1,101 of server
// instructions (budgeted separately in instructions.test.js, since a client is charged for each
// once).
//
// Raised from 6,000 for `deploy-dry-run` (TASK-25), which costs 739 bytes of it. The bump was
// argued rather than assumed: `deploy-start` is in this profile and a deploy that is not partial
// deletes every file missing from the build, so without the dry run an agent here can only find
// that out by causing it. `deploy-start`'s own description names the dry run, and a description
// may not point at a tool its profile hides — so the two travel together or neither does.
const DEV_TOOLS_LIST_BYTE_BUDGET = 6500;

// Exactly what pos-cli-mcp exposed before profiles existed (captured from 6.5.1 over stdio).
const PRE_PROFILES_TOOLS = [
  'envs-list', 'logs-fetch', 'liquid-exec', 'graphql-exec', 'generators-list', 'generators-help', 'generators-run',
  'migrations-list', 'migrations-generate', 'migrations-run', 'deploy-start', 'deploy-status', 'deploy-wait',
  'data-import', 'data-import-status', 'data-export', 'data-export-status', 'data-clean', 'data-clean-status',
  'data-validate', 'unit-tests-run', 'tests-run-async', 'tests-run-async-result', 'check-run', 'sync-file',
  'uploads-push', 'constants-list', 'constants-set', 'constants-unset', 'instance-create', 'partners-list',
  'partner-get', 'endpoints-list', 'env-add'
];
// Each a deliberate widening of what a bare `pos-cli-mcp` exposes, and the reason the byte count
// below moves.
const ADDED_SINCE_PROFILES = ['job-status', 'deploy-dry-run'];
// The six per-operation status tools job-status replaced, removed in 6.6.0. Listed rather than
// deleted from PRE_PROFILES_TOOLS so this file still records what 6.5.1 shipped and what became
// of it: an agent on a 6.x server saw these, and a config or a launch flag naming one now has to
// be answered (tools-config.js keeps a tombstone for each).
const REMOVED_IN_7 = [
  'deploy-status', 'deploy-wait', 'data-import-status', 'data-export-status', 'data-clean-status',
  'tests-run-async-result'
];

const BARE_TOOLS = [
  ...PRE_PROFILES_TOOLS.slice(0, PRE_PROFILES_TOOLS.indexOf('deploy-start')),
  'job-status',
  'deploy-dry-run',
  ...PRE_PROFILES_TOOLS.slice(PRE_PROFILES_TOOLS.indexOf('deploy-start'))
].filter(name => !REMOVED_IN_7.includes(name));

// The bare surface pays for every tool it lists.
//
// 25,764 before the descriptions were rewritten against one standard; 25,694 once check-run
// stopped naming a pos-cli dependency as though the caller had to install it; 20,799 once `env`
// and the auth triple moved into schemas/auth.js and stopped being restated per tool, and the
// tool descriptions were cut to what a model can act on; 20,109 once the credential precedence
// moved into the server instructions, which say it once a session rather than in every schema;
// 20,848 with deploy-dry-run.
//
// 21,444 once the schemas declared the defaults their handlers were already applying, the three
// parameters with no description at all got one, and `data-validate` said which field to branch
// on. All three are the same bargain: a description rule here forbids restating a default in prose
// *because the schema carries it*, and for twelve parameters it did not — `strictTypes` reads as
// off when the handler has it on. A parameter the model has to guess at costs more than the bytes
// that would have explained it.
//
// 21,492 once the descriptions were reviewed for *selection* rather than only for accuracy: two
// tools that overlapped now say which to reach for. `partners-list` lost the `partner_id` branch
// that duplicated `partner-get` (a saving), and `liquid-exec` names `graphql-exec` for queries,
// since it can run them itself and nothing said which was meant.
//
// 17,997 once the six per-operation status tools were removed (6.6.0) — 3,495 bytes, 16% of what
// a bare server sent, for tools whose own descriptions told the model not to use them. The cost
// was never only tokens: two of them answer with less than the truth. `deploy-status` reports the
// release and ignores the asset phase, and `deploy-wait` returns as soon as the release settles,
// so a deploy still uploading assets reads as finished on both.
//
// 17,727 once `env` stopped saying "the first entry if omitted" on all eighteen tools that take
// it. That was a warning the model had to remember; TASK-31 made it a refusal it receives at the
// moment it matters, so the parameter can just say what it is.
//
// 17,860 once deploy-dry-run's description gained `verdict`. It reads the release the dry run
// creates rather than the push response, so it can now say whether the deploy would be refused at
// all — and an agent that does not know to look at that field is back to the failure the field
// exists for.
const BARE_TOOLS_LIST_BYTES = 17860;

const HANG_MS = 15000;

let workDir;

beforeAll(() => {
  workDir = makeWorkDir('pos-cli-mcp-tool-surface');
});

afterAll(async () => {
  await stopAll();
  fs.rmSync(workDir, { recursive: true, force: true });
});

let nextId = 1;
const rpc = (method, params = {}) => ({ jsonrpc: '2.0', id: `t${nextId++}`, method, params });

function httpJson(baseUrl, method, path, body) {
  const url = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: url.hostname, port: url.port, path: url.pathname, method, headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', c => (text += c));
        res.on('end', () => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }));
      }
    );
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

// The /mcp endpoint answers a 2025-era request as an SSE message and a 2026-07-28 one as JSON.
async function mcpPost(baseUrl, message, { modern = false } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  let body = message;
  if (modern) {
    headers['MCP-Protocol-Version'] = '2026-07-28';
    headers['Mcp-Method'] = message.method;
    if (message.params?.name !== undefined) headers['Mcp-Name'] = message.params.name;
    body = { ...message, params: { ...message.params, _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} } } };
  } else {
    headers['MCP-Protocol-Version'] = '2025-06-18';
  }
  const response = await fetch(new URL('/mcp', baseUrl), { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await response.text();
  const json = response.headers.get('content-type')?.includes('text/event-stream')
    ? text.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6))).find(m => m.id === message.id)
    : JSON.parse(text);
  return { status: response.status, body: json };
}

/** Starts a server with the given arguments and collects what each list path exposes. */
async function withServer(args, fn, { bin = [MCP_BIN] } = {}) {
  const proc = launch({ workDir, args: [...bin, ...args], env: { MCP_MIN_PORT: '0' } });
  try {
    const baseUrl = await boundUrl(proc);
    await request(proc, rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'pos-cli-tests', version: '1.0.0' } }));
    return await fn({ proc, baseUrl });
  } finally {
    await stop(proc);
  }
}

async function listedEverywhere({ proc, baseUrl }) {
  const stdio = (await request(proc, rpc('tools/list'))).result.tools;
  const mcpLegacy = (await mcpPost(baseUrl, rpc('tools/list'))).body.result.tools;
  const mcpModern = (await mcpPost(baseUrl, rpc('tools/list'), { modern: true })).body.result.tools;
  return { stdio, mcpLegacy, mcpModern };
}

function expectSameEverywhere(lists, expectedNames) {
  expect(lists.stdio.map(t => t.name)).toEqual(expectedNames);
  expect(lists.mcpLegacy).toEqual(lists.stdio);
  expect(lists.mcpModern).toEqual(lists.stdio);
}

function mcpConfigJson(args) {
  const result = spawnSync(process.execPath, [MCP_CONFIG_BIN, '--json', ...args], { cwd: workDir, env: serverEnv(workDir), encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

describe('which tools are listed', () => {
  test('bare pos-cli-mcp lists what it listed before profiles plus the tools added since, byte for byte, on every path', async () => {
    // Nothing that was exposed before profiles has quietly stopped being exposed.
    expect(BARE_TOOLS.filter(name => !ADDED_SINCE_PROFILES.includes(name)))
      .toEqual(PRE_PROFILES_TOOLS.filter(name => !REMOVED_IN_7.includes(name)));

    const bare = await withServer([], listedEverywhere);
    expectSameEverywhere(bare, BARE_TOOLS);
    expect(Buffer.byteLength(JSON.stringify(bare.stdio))).toBe(BARE_TOOLS_LIST_BYTES);

    const full = await withServer(['--profile', 'full'], listedEverywhere);
    expect(full).toEqual(bare);
  }, 60000);

  test('--profile dev lists the dev set in registry order on every path, within its byte budget', async () => {
    const lists = await withServer(['--profile', 'dev'], listedEverywhere);

    expectSameEverywhere(lists, DEV_TOOLS);
    const bytes = Buffer.byteLength(JSON.stringify(lists.stdio));
    expect(bytes, `dev tools/list is ${bytes} bytes`).toBeLessThanOrEqual(DEV_TOOLS_LIST_BYTE_BUDGET);
  }, 60000);

  test('`pos-cli mcp` passes the selection through to the same server', async () => {
    const lists = await withServer(['mcp', '--profile', 'none', '--include-tools', 'sync-file,envs-list'], listedEverywhere, { bin: [POS_CLI_BIN] });

    expectSameEverywhere(lists, ['envs-list', 'sync-file']);
  }, 60000);

  test.each([
    ['an allowlist', ['--profile', 'none', '--include-tools', 'graphql-exec,envs-list'], ['envs-list', 'graphql-exec']],
    ['the same allowlist as repeated flags', ['--profile', 'none', '--include-tools', 'graphql-exec', '--include-tools', 'envs-list'], ['envs-list', 'graphql-exec']],
    ['dev plus one tool minus another', ['--profile', 'dev', '--include-tools', 'sync-file', '--exclude-tools', 'job-status,check-run'],
      ['envs-list', 'logs-fetch', 'liquid-exec', 'graphql-exec', 'deploy-dry-run', 'deploy-start',
        'unit-tests-run', 'tests-run-async', 'sync-file']],
    ['full minus a group', ['--exclude-tools', 'data-import,data-export,data-clean'],
      BARE_TOOLS.filter(name => !['data-import', 'data-export', 'data-clean'].includes(name))]
  ])('%s', async (_label, args, expected) => {
    const lists = await withServer(args, listedEverywhere);

    expectSameEverywhere(lists, expected);
    // What pos-cli mcp-config reports for the same options is what the server serves.
    const config = mcpConfigJson(args);
    expect(config.exposed).toEqual(lists.stdio.map(t => ({ name: t.name, description: t.description })));
  }, 60000);
});

describe('a selection that does not resolve stops startup', () => {
  // The bundled config disables nothing, so the refusal for including a disabled tool needs a
  // config that does. The rule it guards is what stops --include-tools from re-enabling a tool an
  // operator switched off, which would make the config cosmetic.
  let disablingConfig;

  beforeAll(() => {
    disablingConfig = path.join(workDir, 'disables-constants-list.json');
    fs.writeFileSync(disablingConfig, JSON.stringify({ tools: { 'constants-list': { enabled: false } } }));
  });

  // [label, args, expected message, extra env (lazy: workDir exists only once beforeAll has run)]
  const REFUSALS = [
    ['an unknown profile', ['--profile', 'devv'], '--profile devv: no such profile. Available profiles: full, dev, none.'],
    ['a prototype name as a profile', ['--profile', 'constructor'], '--profile constructor: no such profile. Available profiles: full, dev, none.'],
    ['an unknown tool to include', ['--include-tools', 'deploy-strt'], '--include-tools: no such tool: deploy-strt (did you mean deploy-start?).'],
    ['an unknown tool to exclude', ['--exclude-tools', 'toString'], '--exclude-tools: no such tool: toString.'],
    ['a tool in both flags', ['--include-tools', 'sync-file', '--exclude-tools', 'sync-file'],
      'Named in both --include-tools and --exclude-tools: sync-file. Name each tool in only one of them.'],
    ['including a tool the tools config disables', ['--profile', 'dev', '--include-tools', 'constants-list'],
      /^--include-tools names tools disabled in the tools config at .+disables-constants-list\.json: constants-list\. Enable them there, or remove them from --include-tools\.$/,
      () => ({ MCP_TOOLS_CONFIG: disablingConfig })],
    ['an empty selection', ['--profile', 'none'],
      'No tools to expose: profile none with --include-tools (none) and --exclude-tools (none) leaves none enabled. Choose another profile or name tools with --include-tools.']
  ];

  test.each(REFUSALS)('%s: one message, exit 1, nothing started', async (_label, args, message, extraEnv) => {
    const proc = launch({ workDir, args: [MCP_BIN, ...args], env: { MCP_MIN_PORT: '0', ...extraEnv?.() } });
    try {
      const exit = await exitWithin(proc, HANG_MS);

      expect(exit, `still running\n${proc.stderr}`).not.toBeNull();
      expect(exit.code).toBe(1);
      expect(proc.stdout).toBe('');
      expect(proc.stderr).not.toContain('stdio transport started');
      expect(proc.stderr).not.toMatch(LISTENING);
      expect(proc.stderr).not.toMatch(/^\s+at .+:\d+:\d+\)?$/m);
      if (message instanceof RegExp) expect(proc.stderr.trim()).toMatch(message);
      else expect(proc.stderr.trim()).toBe(message);
    } finally {
      await stop(proc);
    }
  }, 30000);

  test.each(REFUSALS)('pos-cli mcp-config refuses %s with the same message', (_label, args, message, extraEnv) => {
    const extra = extraEnv?.() ?? {};
    const server = spawnSync(process.execPath, [MCP_BIN, ...args], { cwd: workDir, env: serverEnv(workDir, { MCP_MIN_PORT: '0', ...extra }), input: '', encoding: 'utf8', timeout: HANG_MS });
    const config = spawnSync(process.execPath, [MCP_CONFIG_BIN, ...args], { cwd: workDir, env: serverEnv(workDir, extra), encoding: 'utf8', timeout: HANG_MS });

    expect(config.status).toBe(1);
    expect(config.stdout).toBe('');
    expect(config.stderr.trim()).toBe(server.stderr.trim());
    if (message instanceof RegExp) expect(config.stderr.trim()).toMatch(message);
    else expect(config.stderr.trim()).toBe(message);
  }, 30000);
});

// A hidden tool that can still be called would make profiles cosmetic: the HTTP transport has
// no authentication. Checked with a registered tool this server does not expose, and with
// names inherited from Object.prototype, which used to reach past the lookup (TASK-5).
describe('a tool that is not exposed cannot be called', () => {
  let proc;
  let baseUrl;

  beforeAll(async () => {
    proc = launch({ workDir, args: [MCP_BIN, '--profile', 'none', '--include-tools', 'envs-list'], env: { MCP_MIN_PORT: '0' } });
    baseUrl = await boundUrl(proc);
    await request(proc, rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'pos-cli-tests', version: '1.0.0' } }));
  }, 30000);

  afterAll(() => stop(proc));

  const HIDDEN = ['deploy-start', 'constructor', 'toString', '__proto__', 'hasOwnProperty'];

  // The SDK paths answer an unknown tool with -32602 "Tool <name> not found". Names inherited
  // from Object.prototype come back as "Tool <name> disabled" — the SDK keeps its registry in a
  // plain object — which is still the same refusal: a protocol error, and nothing runs.
  const PROTOTYPE_NAMES = new Set(['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']);
  const sdkNotFound = (error, name) => expect(error).toEqual({
    code: -32602,
    message: `Tool ${name} ${PROTOTYPE_NAMES.has(name) ? 'disabled' : 'not found'}`
  });
  const toolText = result => {
    expect(result.isError).toBeUndefined();
    return result.content[0].text;
  };

  const PATHS = {
    'stdio tools/call': {
      call: async name => (await request(proc, rpc('tools/call', { name, arguments: {} }))),
      found: response => expect(toolText(response.result)).toContain('environments'),
      notFound: (response, name) => sdkNotFound(response.error, name)
    },
    'HTTP /mcp tools/call, 2025-era client': {
      call: name => mcpPost(baseUrl, rpc('tools/call', { name, arguments: {} })),
      found: response => expect(toolText(response.body.result)).toContain('environments'),
      notFound: (response, name) => sdkNotFound(response.body.error, name)
    },
    'HTTP /mcp tools/call, 2026-07-28 client': {
      call: name => mcpPost(baseUrl, rpc('tools/call', { name, arguments: {} }), { modern: true }),
      found: response => expect(toolText(response.body.result)).toContain('environments'),
      notFound: (response, name) => sdkNotFound(response.body.error, name)
    },
  };

  describe.each(Object.keys(PATHS))('%s', (path) => {
    const { call, found, notFound } = PATHS[path];

    test('reaches an exposed tool', async () => {
      found(await call('envs-list'));
    });

    test.each(HIDDEN)('answers %s as not found', async (name) => {
      notFound(await call(name), name);
    });
  });

  // A method named after an Object.prototype function must not reach that function and answer
  // nothing, leaving the client waiting for its id. A tool name is not a method either.
  test.each(['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__', 'envs-list', 'deploy-start'])(
    'the stdio protocol dispatcher answers the method %s as not found',
    async (method) => {
      const response = await request(proc, rpc(method, {}), 5000);

      expect(response.error).toEqual({ code: -32601, message: 'Method not found' });
    }
  );
});

// A transport that fell back to every registered tool when not handed a selection would undo
// the selection for whichever caller forgot to pass it — silently, on an unauthenticated port.
describe('a transport has no default tool set', () => {
  const NOT_A_SELECTION = [
    ['no tools', undefined],
    ['a plain object of tools', { 'envs-list': registry.get('envs-list') }]
  ];

  test.each(NOT_A_SELECTION)('startHttp refuses %s', async (_label, tools) => {
    const outcome = await startHttp({ port: 0, tools }).then(
      server => new Promise(resolve => server.close(() => resolve('started'))),
      error => error
    );

    expect(outcome).toEqual(new TypeError('startHttp: tools must be the Map of exposed tools'));
  });

  test.each(NOT_A_SELECTION)('startStdio refuses %s', (_label, tools) => {
    // In its own process: a startStdio that did start would take over this worker's stdin.
    const script = [
      `import startStdio from ${JSON.stringify(pathToFileURL(STDIO_SERVER).href)};`,
      `import registry from ${JSON.stringify(pathToFileURL(path.join(path.dirname(STDIO_SERVER), 'tools.js')).href)};`,
      `const tools = ${tools === undefined ? 'undefined' : "{ 'envs-list': registry.get('envs-list') }"};`,
      "try { startStdio({ tools }); console.log('STARTED'); } catch (err) { console.log(`REFUSED ${err.name}: ${err.message}`); }"
    ].join('\n');
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: workDir, env: serverEnv(workDir), input: '', encoding: 'utf8', timeout: HANG_MS
    });

    expect(result.stdout).toBe('REFUSED TypeError: startStdio: tools must be the Map of exposed tools\n');
  });
});
