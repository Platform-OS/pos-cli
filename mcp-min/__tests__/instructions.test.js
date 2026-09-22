/**
 * The server-level instructions, which a client puts in front of the model once per session.
 *
 * The rule that matters is that they describe the server the client is actually talking to: a
 * selection that hides a tool must hide the guidance about it too, or the model is invited to call
 * something that is not there. It is checked over many selections rather than the default one,
 * because the default is exactly where this kind of bug does not show.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import registry from '../tools.js';
import { resolveTools } from '../tool-selection.js';
import { PROFILE_NAMES, profileTools } from '../profiles.js';
import { buildInstructions } from '../instructions.js';
import { ERROR_KINDS } from '../tool-error.js';
import { runTool } from '../run-tool.js';
import { resolveAuth } from '../auth.js';
import { launch, stopAll, request, send, boundUrl, makeWorkDir, MCP_BIN } from './helpers/server-process.js';

const NO_CONFIG = { tools: {} };
const resolve = (options = {}) =>
  resolveTools({ registry, config: NO_CONFIG, configPath: '(none)', ...options }).tools;

// A tool name is only a mention when it stands alone: `data-import` occurs inside
// `data-import-status`, and counting that would make the check report the wrong tool.
const mentions = (text) =>
  [...registry.keys()].filter(name => new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(text));

const names = (tools) => [...tools.keys()];

// Every profile, every single-tool server, every server missing one tool, and a config-disabled
// one: the shapes a real selection takes, rather than the one shipped by default.
const SELECTIONS = [
  ...PROFILE_NAMES.filter(profile => profileTools(profile, registry.keys()).length > 0)
    .map(profile => [`profile ${profile}`, () => resolve({ profile })]),
  ...[...registry.keys()].map(name => [`only ${name}`, () => resolve({ profile: 'none', include: [name] })]),
  ...[...registry.keys()].map(name => [`everything but ${name}`, () => resolve({ exclude: [name] })]),
  ['job-status disabled in the config', () =>
    resolveTools({ registry, config: { tools: { 'job-status': { enabled: false } } }, configPath: '(test)' }).tools]
];

describe('instructions describe the server the client is talking to', () => {
  test.each(SELECTIONS)('%s names no tool it does not expose', (_label, select) => {
    const tools = select();

    const dangling = mentions(buildInstructions(tools)).filter(name => !tools.has(name));

    expect(dangling).toEqual([]);
  });

  // Without this the rule above passes for instructions that never name a tool at all, which is
  // the easiest way to satisfy it and the least useful.
  test('the check is not vacuous: the default server does name tools', () => {
    expect(mentions(buildInstructions(resolve()))).toContain('deploy-start');
  });

  test('guidance goes when the tool it is about goes', () => {
    const withJobs = buildInstructions(resolve());
    const withoutJobs = buildInstructions(resolve({ exclude: ['job-status'] }));

    expect(withJobs).toContain('job_id');
    expect(withoutJobs).not.toContain('job_id');
    expect(withoutJobs.length).toBeLessThan(withJobs.length);
  });

  test('a server of local tools alone says nothing about credentials', () => {
    const local = resolve({ profile: 'none', include: ['check-run', 'generators-list'] });

    expect(names(local).every(name => !registry.get(name).inputSchema?.properties?.env)).toBe(true);
    expect(buildInstructions(local)).not.toContain('Credentials');
  });

  test('tools must be the exposed Map, so no caller can describe a server it did not resolve', () => {
    expect(() => buildInstructions({})).toThrow(TypeError);
    expect(() => buildInstructions([...registry])).toThrow(TypeError);
  });
});

describe('instructions claim nothing this server cannot do', () => {
  const text = () => buildInstructions(resolve());

  // The supervisor, the GraphQL and Liquid servers are registered separately and may not be there
  // at all. What else a client has is not knowable here, and guessing teaches the model to trust
  // guidance that can be wrong.
  test.each(['validate_code', 'pos_gql_search', 'liquid_search', 'platformos-supervisor'])(
    'no tool of another MCP server is named (%s)', (name) => {
      expect(text()).not.toContain(name);
    }
  );

  // Two rules at once. The safe path stays a tool of its own, so `deploy-start` must never grow a
  // `dryRun` flag — that flag is a deploy one boolean away. And the instructions must not describe
  // it: deploy-start's own description names `deploy-dry-run`, and saying it here again is the
  // duplication these instructions exist to avoid.
  test('the dry run is a tool, not a flag, and not restated here', () => {
    expect(registry.get('deploy-start').inputSchema.properties).not.toHaveProperty('dryRun');
    expect(registry.has('deploy-dry-run')).toBe(true);
    expect(text()).not.toMatch(/dry[ -]?run/i);
  });
});

/**
 * The refusal is conditional — `requireNamedInstance` stands aside for a single `.pos` entry
 * (`env-required.test.js`) — and the instructions stated it unconditionally, so an agent that read
 * them believed a forgotten `env` could not do damage. Prose an agent acts on has to be true.
 */
describe('what the instructions promise about env is what the guard does', () => {
  test('the refusal is stated as conditional, not absolute', () => {
    const text = buildInstructions(resolve());

    expect(text).toMatch(/more than one/);
    expect(text).not.toMatch(/could change an instance is refused and/);
  });
});

/**
 * The same rule again, for the sentence that replaced the refresh-token one: the instructions name
 * `details.remedy` and say it carries a command and who runs it, so an error that carries a remedy
 * has to have both. Half of it sends the model looking for a field that is not there; the missing
 * half is usually `runBy`, and without that an agent holding a shell runs a command that stops on a
 * password prompt.
 */
describe('the remedy the instructions promise is the one an error carries', () => {
  test('what is named is what runTool attaches', async () => {
    expect(buildInstructions(resolve())).toContain('details.remedy');

    const config = { staging: { url: 'https://staging.example.com', email: 'a@b.c', token: 'stored' } };
    const rejected = {
      annotations: { readOnlyHint: true },
      handler: async (params, ctx) => {
        await resolveAuth(params, ctx);
        throw Object.assign(new Error('Request failed with status 401'), { name: 'StatusCodeError', statusCode: 401 });
      }
    };

    const { error } = await runTool(rejected, { env: 'staging' }, {
      files: { getConfig: () => config },
      settings: { settingsFromDotPos: name => config[name] }
    });

    expect(Object.keys(error.details.remedy).sort()).toEqual(['command', 'runBy']);
  });
});

/**
 * The kinds are a closed set the instructions restate in the model's own terms, which is two lists
 * that have to agree — and they had drifted: `ERROR_KINDS` had eight members while the instructions
 * named five, so an evaluation's second call came back `kind: project` against guidance that
 * promised "the kind says what to do next" and did not mention it.
 *
 * Derived from the set rather than repeated here, so adding a kind fails this until it is described.
 * They are not generated from `ERROR_KINDS` directly on purpose: those strings document the table
 * for someone reading it, and saying them here in full costs about 200 bytes of every session.
 */
describe('the instructions describe every kind an error can carry', () => {
  const named = (text, kind) => new RegExp(`(?<![\\w-])${kind}:`).test(text);

  test('each member of the closed set is named, with what to do about it', () => {
    const text = buildInstructions(resolve());

    expect(Object.keys(ERROR_KINDS).filter(kind => !named(text, kind))).toEqual([]);
  });

  // Without this the check above passes for a server that authenticates nothing, which is the one
  // place the error taxonomy is least likely to come up.
  test('a server of local tools alone still describes them', () => {
    const local = resolve({ profile: 'none', include: ['check-run', 'generators-list'] });
    const text = buildInstructions(local);

    expect(Object.keys(ERROR_KINDS).filter(kind => !named(text, kind))).toEqual([]);
  });
});

describe('instructions are paid for on every session', () => {
  // Charged like the tool definitions are, and bounded for the same reason. Kept apart from the
  // tools/list budget so that each can be read on its own.
  //
  // Raised from 1200 in 6.6.0, when the refresh-token sentence (TASK-30) took full to 1186 and left
  // fourteen bytes. A ceiling that close fails on a reworded clause rather than on the growth it is
  // there to catch, which teaches the next person to raise it without thinking. This is the number
  // that still forces the conversation: full is 1346 and dev 1308, so an addition worth a sentence
  // fits and one worth a paragraph does not.
  //
  // Not raised again for TASK-40, which added the three kinds the list was missing: the
  // refresh-token sentence it replaced said in advance what `details.remedy` now says on the error
  // that needs it, and one general rule about remedies is shorter than one announcement per remedy.
  const BUDGET = 1400;

  test.each([['full', {}], ['dev', { profile: 'dev' }]])('%s fits the budget', (_label, options) => {
    const size = Buffer.byteLength(buildInstructions(resolve(options)));

    expect(size, `instructions are ${size} bytes`).toBeLessThanOrEqual(BUDGET);
    expect(size).toBeGreaterThan(0);
  });
});

// One spawned server, asked on every path a client can open it on. The selection is fixed for the
// process, so all four answers have to be the same string.
describe('every client is told the same thing', () => {
  let workDir;
  let proc;
  let base;
  const expected = () => buildInstructions(resolve({ profile: 'dev' }));

  beforeAll(async () => {
    workDir = makeWorkDir('pos-cli-mcp-instructions');
    proc = launch({ workDir, args: [MCP_BIN, '--profile', 'dev'], env: { MCP_MIN_PORT: '0' } });
    base = await boundUrl(proc);
  }, 30000);

  afterAll(async () => { await stopAll(); });

  const meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} };

  const overHttp = async (message, headers) => {
    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
      body: JSON.stringify(message)
    });
    const text = await response.text();
    return response.headers.get('content-type')?.includes('text/event-stream')
      ? JSON.parse(text.split('\n').filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join(''))
      : JSON.parse(text);
  };

  test('a 2026-07-28 client gets them from server/discover, over stdio and over HTTP', async () => {
    const overStdio = await request(proc, { jsonrpc: '2.0', id: 'd1', method: 'server/discover', params: { _meta: meta } });
    const http = await overHttp(
      { jsonrpc: '2.0', id: 'd2', method: 'server/discover', params: { _meta: meta } },
      { 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'server/discover' }
    );

    expect(overStdio.result.instructions).toBe(expected());
    expect(http.result.instructions).toBe(overStdio.result.instructions);
  }, 30000);

  test('a 2025-era client gets them from initialize, over stdio and over HTTP', async () => {
    const params = { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'pos-cli-tests', version: '1.0.0' } };
    const overStdio = await request(proc, { jsonrpc: '2.0', id: 'i1', method: 'initialize', params });
    send(proc, { jsonrpc: '2.0', method: 'notifications/initialized' });
    const http = await overHttp({ jsonrpc: '2.0', id: 'i2', method: 'initialize', params }, { 'MCP-Protocol-Version': '2025-06-18' });

    expect(overStdio.result.instructions).toBe(expected());
    expect(http.result.instructions).toBe(overStdio.result.instructions);
  }, 30000);
});
