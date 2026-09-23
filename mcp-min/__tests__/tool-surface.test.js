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
  'envs-list', 'logs-fetch', 'liquid-exec', 'graphql-exec', 'page-fetch', 'job-status', 'deploy-dry-run',
  'deploy-start', 'unit-tests-run', 'check-run'
];

// The profile exists to keep this payload small, so growth past the budget needs a deliberate
// bump rather than a quiet one. Currently 9,243 bytes over stdio, plus the server instructions
// (budgeted separately in instructions.test.js, since a client is charged for each once).
//
// Two kinds of growth, argued differently. **Prose** — a description that was wrong, a parameter
// that needed explaining — comes out of existing text: the profile has no claim on more bytes for
// saying the same things at greater length. **A tool** is a surface decision, argued on what an
// agent cannot otherwise do, and it may move the budget.
//
// 6,000 → 6,500  deploy-dry-run (TASK-25, 739 B). deploy-start is here, and a non-partial deploy
//                deletes every file missing from the build; without this an agent learns that by
//                causing it. deploy-start's description names it, and a description may not point
//                at a tool its profile hides.
// 6,500 → 7,000  TASK-41/42/43 (411 B). One purchase: four descriptions in this profile stated
//                things that were not true, and two of them ended in a wrong conclusion rather
//                than a retry. A wrong description is not cheaper than a longer one. The prose
//                argument is spent here — a further description comes out of existing text.
// 7,000 → 8,000  TASK-44. page-fetch (720 B), the verify step of edit → check → deploy → verify,
//                which an agent could not take without leaving the server; plus 128 B naming the
//                admin_* family on graphql-exec, bought because a capability nobody can find is
//                one the profile pays for and does not get. A wrapper tool for that family would
//                have been 450–900 B to duplicate what graphql-exec already does.
// 8,000 → 9,600  TASK-45 (1,524 B). The largest raise with the least text behind it: three short
//                sentences on url/email/token, spread into nine of this profile's tools, each
//                publishing its own copy. The multiplication is the cost — even empty descriptions
//                would be about a thousand of it. Bought because those parameters decide which
//                instance a call reaches, they sit on deploy-start, and they are read while the
//                argument is being filled in, which the instructions (a fifteenth of the price)
//                are not.
//
// No raise for round 2's F10/F13: correcting them *returned* 126 bytes. page-fetch stopped
// publishing `email` and `token`, which it never sent, and logs-fetch spent 53 of the saving on
// saying which renders reach the error log instead of a claim that was wrong.
//
// 9,600 → 9,000 because three corrections in a row gave bytes back (F10/F13, F1/F3/F4, F2) and a
// budget sitting a kilobyte above the actual has stopped being one: it would let the next change
// spend the whole of the TASK-45 raise again without anyone arguing for it. Lowering a ceiling is
// not a saving and is not counted as one; it is what keeps the ceiling load-bearing.
//
// 9,000 → 9,400  TASK-57 (481 B). logs-fetch gained `since`, `errorType` and `contains`. Argued
//                as a capability rather than as prose: round 2 of the evaluation was set "find one
//                error in the logs without reading everything" and could only do it because that
//                instance held five rows. The instance cannot narrow anything — measured
//                2026-09-22, `/logs` answers error_type, q, search, order and limit identically to
//                a nonsense parameter — so the choice was these three parameters or a second log
//                tool, and the one TASK-28 planned needs logsv2, which is unreachable (TASK-56).
//                A tool would have been 450–900 B and a second log tool to pick wrongly between.
const DEV_TOOLS_LIST_BYTE_BUDGET = 9400;

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
const ADDED_SINCE_PROFILES = ['job-status', 'deploy-dry-run', 'page-fetch'];
// Removed in 6.6.0: the six per-operation status tools job-status replaced, and tests-run-async,
// which could not work — the tests module answers /_tests/run_async with a test_name and no id,
// and the /_tests/results/:id it polled has never existed there. Listed rather than deleted from
// PRE_PROFILES_TOOLS so this file still records what 6.5.1 shipped and what became of it: an agent
// on a 6.x server saw these, and a config or a launch flag naming one now has to be answered
// (tools-config.js keeps a tombstone for each).
const REMOVED_IN_7 = [
  'deploy-status', 'deploy-wait', 'data-import-status', 'data-export-status', 'data-clean-status',
  'tests-run-async-result', 'tests-run-async'
];

const BARE_TOOLS = [
  ...PRE_PROFILES_TOOLS.slice(0, PRE_PROFILES_TOOLS.indexOf('generators-list')),
  'page-fetch',
  ...PRE_PROFILES_TOOLS.slice(PRE_PROFILES_TOOLS.indexOf('generators-list'), PRE_PROFILES_TOOLS.indexOf('deploy-start')),
  'job-status',
  'deploy-dry-run',
  ...PRE_PROFILES_TOOLS.slice(PRE_PROFILES_TOOLS.indexOf('deploy-start'))
].filter(name => !REMOVED_IN_7.includes(name));

// The bare surface pays for every tool it lists. Each figure is what a bare `pos-cli-mcp` sent
// after the change beside it; the reasoning for the recent ones is in CHANGELOG.md.
//
// 25,764  before the descriptions were written against one standard
// 25,694  check-run stopped naming a pos-cli dependency as though the caller had to install it
// 20,799  `env` and the auth triple moved into schemas/auth.js instead of being restated per tool
// 20,109  the credential precedence moved into the server instructions, said once a session
// 20,848  deploy-dry-run
// 21,444  schemas declared the defaults their handlers already applied, and three undescribed
//         parameters got descriptions — a parameter a model has to guess at costs more than the
//         bytes that would have explained it
// 21,492  descriptions reviewed for *selection*: two overlapping tools now say which to reach for
// 17,997  the six per-operation status tools removed (6.6.0) — 3,495 B, 16% of the surface, for
//         tools whose own descriptions told the model not to use them, two of which also answered
//         with less than the truth
// 17,727  `env` stopped warning "the first entry if omitted" on eighteen tools; TASK-31 made that
//         a refusal received at the moment it matters
// 17,860  deploy-dry-run's description gained `verdict`
// 17,962  liquid-exec's `locals` said where the values actually are (TASK-41)
// 18,157  logs-fetch said which stream it reads and how its cursor resumes (TASK-42); 33 B of it
//         is the row-id pattern that refuses a cursor carrying its own query parameters
// 18,471  job-status said to read `warnings` on a completed job, deploy-dry-run gained
//         `discarded`, unit-tests-run said where a test file has to live (TASK-43)
// 19,305  page-fetch (720 B) and the admin_* pointer (TASK-44)
// 22,725  url, email and token carried descriptions (TASK-45) — 3,420 B for three sentences,
//         because twenty-one tools spread `authProperties` and each publishes its own copy
// 22,599  page-fetch stopped publishing `email` and `token` (round 2, F10) and logs-fetch said
//         which renders reach the error log (F13) — a correction that gave 126 B back
// 22,504  unit-tests-run dropped `path`, which the tests module never read, and stopped sending
//         a whole-suite run to tests-run-async (round 2, F1/F3/F4)
// 22,593  graphql-exec said the schema is introspectable (round 2, F12) — 90 B, against the round
//         trip an evaluation lost to `Field 'name' doesn't exist on type 'LiquidPartial'` on its
//         first call. Prose, so it comes out of the tool payload the same release gave back.
// 21,978  tests-run-async removed (round 2, F2). Not a saving that was sought: the tool could not
//         work at all, and 615 B is what a broken one costs every agent on every request.
// 22,026  check-run's autoFix points at `fixable` (round 2, F9), which is what tells a caller
//         whether the pass had anything to do — 48 B, out of the 615 the line above returned.
// 22,099  deploy-dry-run says some categories carry a count and no paths (round 2, F7) — 73 B,
//         against an evaluation that read the mismatch as a bug and spent an admin_assets query
//         checking. The layout that went with it is in the instructions, not here: it belongs to
//         the project rather than to a tool, and is charged once a session instead of per request.
// 22,580  logs-fetch gained since, errorType and contains (TASK-57) — 481 B on the one tool that
//         changed, the same 481 B the dev profile pays, where the argument for them is made.
// 22,601  logs-fetch says what a liquid-exec render contributes (21 B). It had claimed such a
//         render "never appears here, not even its errors", which is false: the errors are
//         recorded, only the render's own `{% log %}` is not. A description that sends an agent
//         away from the place its answer is costs more than the 21 bytes.
// 22,598  graphql-exec calls a bad document an input failure rather than an instance one (TASK-54),
//         which is what it now answers: 3 B back, and the sentence stops contradicting the `kind`.
// 22,529  job-status stopped listing the kinds of job it reads (round 3, F10). It named a data
//         import, export and clean, which `--profile dev` hides, and an async test run, which no
//         longer exists in any profile — `tests-run-async` was removed in this release and the
//         description outlived it. A caller has the job_id; the kinds were never its to know.
const BARE_TOOLS_LIST_BYTES = 22529;

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
      ['envs-list', 'logs-fetch', 'liquid-exec', 'graphql-exec', 'page-fetch', 'deploy-dry-run', 'deploy-start',
        'unit-tests-run', 'sync-file']],
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
