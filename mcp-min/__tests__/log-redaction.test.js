/**
 * The log a running server actually writes. `redact.test.js` pins the rule; this pins that every
 * path a client can reach goes through it. Each case asserts the call really happened, so a test
 * cannot pass by the request having failed before anything was logged.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import os from 'os';
import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import {
  launch, stop, stopAll, boundUrl, request, initializeOverStdio, makeWorkDir, MCP_BIN
} from './helpers/server-process.js';
import { runTool } from '../run-tool.js';

// Distinct per case, so a leak can be traced to the path that leaked it.
const HEADER_TOKEN = 'sk-header-000111222333444555';
const COOKIE_VALUE = 'sk-cookie-000111222333444555';
const PARAM_TOKEN = 'sk-param-0001112223334445556';
const ENV_ADD_TOKEN = 'sk-envadd-00011122233344455';

let workDir;

beforeAll(() => {
  workDir = makeWorkDir('pos-cli-mcp-log-redaction');
});

afterAll(async () => {
  await stopAll();
  fs.rmSync(workDir, { recursive: true, force: true });
});

/** Everything the server wrote: the file it appends to and the stderr its client can see. */
function everythingLogged(proc, dir) {
  const file = path.join(dir, 'mcp-min.log');
  return `${fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''}\n${proc.stderr}`;
}

function post(baseUrl, route, body, headers = {}) {
  const url = new URL(route, baseUrl);
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      host: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers }
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => (text += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: text }));
    });
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(payload);
  });
}

/** A server of its own, so one case's log cannot be read as another's. */
function session(name, env = {}) {
  const dir = path.join(workDir, name);
  fs.mkdirSync(dir, { recursive: true });
  // Port 0: this machine may already have an MCP server on 5910, and this test is not about that.
  return { dir, proc: launch({ workDir: dir, args: [MCP_BIN], env: { MCP_MIN_PORT: '0', ...env } }) };
}

describe('the HTTP request logger', () => {
  test('records the request but not the credentials in it', async () => {
    const { dir, proc } = session('http-headers', { DEBUG: '1' });
    try {
      const baseUrl = await boundUrl(proc);

      const response = await post(baseUrl, '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, {
        Authorization: `Token ${HEADER_TOKEN}`,
        Cookie: `session=${COOKIE_VALUE}`,
        'Mcp-Session-Id': 'mcpmin-abcdef-0123456789',
        'User-Agent': 'redaction-test/1.0',
        Accept: 'application/json, text/event-stream'
      });
      // The request was served: this is a test about logging, not about a rejected request.
      expect(response.status).toBe(200);

      const logged = everythingLogged(proc, dir);
      expect(logged).toContain('HTTP request');
      expect(logged).not.toContain(HEADER_TOKEN);
      expect(logged).not.toContain(COOKIE_VALUE);
      expect(logged).not.toContain('mcpmin-abcdef-0123456789');
      expect(logged).toContain('"authorization":"[redacted]"');
      // Still useful: what was called, by what, over which route.
      expect(logged).toContain('"url":"/mcp"');
      expect(logged).toContain('redaction-test/1.0');
    } finally {
      await stop(proc);
    }
  }, 60000);
});

describe('tool parameters', () => {
  // Redaction covers the names it knows, but a tool's payload is the caller's shape —
  // `constants-set` puts an instance's API keys under `value` — so the route logs which
  // parameters arrived, not what was in them.
  test('are logged by name, with no value of any of them', async () => {
    const { dir, proc } = session('http-call-params', { DEBUG: '1' });
    try {
      const baseUrl = await boundUrl(proc);

      const response = await post(baseUrl, '/call', {
        tool: 'envs-list',
        params: {}
      });
      expect(response.status).toBe(200);

      // A tool that takes explicit credentials, pointed at a host that does not exist: the call
      // fails, but only after the params have been logged, which is the point.
      const withCredentials = await post(baseUrl, '/call', {
        tool: 'constants-list',
        params: { url: 'https://nowhere.invalid', email: 'someone@example.com', token: PARAM_TOKEN }
      });
      expect([200, 500]).toContain(withCredentials.status);

      const logged = everythingLogged(proc, dir);
      expect(logged).toContain('HTTP /call');
      expect(logged).toContain('["url","email","token"]');
      expect(logged).not.toContain(PARAM_TOKEN);
      expect(logged).not.toContain('sk-...556');
      expect(logged).not.toContain('someone@example.com');
      // The outcome is still there, which is what the line is for.
      expect(logged).toContain('"tool":"constants-list"');
      expect(logged).toContain('"kind":"unavailable"');
    } finally {
      await stop(proc);
    }
  }, 60000);
});

describe('a tool handed a credential', () => {
  // env-add's params object carries an instance API token, and its INFO line is written whether
  // or not anyone asked for debug output.
  test('env-add records that a token was given, never the token', async () => {
    const { dir, proc } = session('stdio-env-add');
    try {
      await initializeOverStdio(proc);

      const response = await request(proc, {
        jsonrpc: '2.0',
        id: 'add',
        method: 'tools/call',
        params: {
          name: 'env-add',
          arguments: {
            environment: 'redaction-test',
            url: 'https://redaction.example.com',
            email: 'someone@example.com',
            token: ENV_ADD_TOKEN
          }
        }
      });
      // It really ran: the environment was written to this session's .pos.
      expect(JSON.parse(response.result.content[0].text)).toMatchObject({ ok: true });
      expect(fs.readFileSync(path.join(dir, '.pos'), 'utf8')).toContain(ENV_ADD_TOKEN);

      const logged = everythingLogged(proc, dir);
      expect(logged).toContain('handler:START');
      expect(logged).toContain('"tokenProvided":true');
      expect(logged).not.toContain(ENV_ADD_TOKEN);
      expect(logged).toContain('redaction.example.com');
    } finally {
      await stop(proc);
    }
  }, 60000);

  // The case above runs without DEBUG, which is what most people run; this is the same call with
  // every debug line turned on as well.
  test('the same call with DEBUG on leaks nothing either', async () => {
    const { dir, proc } = session('stdio-env-add-debug', { DEBUG: '1' });
    try {
      await initializeOverStdio(proc);

      const response = await request(proc, {
        jsonrpc: '2.0',
        id: 'add',
        method: 'tools/call',
        params: {
          name: 'env-add',
          arguments: { environment: 'debug-test', url: 'https://redaction.example.com', email: 'someone@example.com', token: ENV_ADD_TOKEN }
        }
      });
      expect(JSON.parse(response.result.content[0].text)).toMatchObject({ ok: true });
      expect(fs.readFileSync(path.join(dir, '.pos'), 'utf8')).toContain(ENV_ADD_TOKEN);

      const logged = everythingLogged(proc, dir);
      expect(logged).not.toContain(ENV_ADD_TOKEN);
      expect(logged).toContain('"tokenProvided":true');
    } finally {
      await stop(proc);
    }
  }, 60000);
});

describe('the device-authorization flow', () => {
  // The Portal's token response *is* the credential, and its verification URL carries a one-time
  // user code.
  const DEVICE_CODE = 'device-code-998877665544332211';
  const ACCESS_TOKEN = 'sk-portal-112233445566778899';
  const USER_CODE = 'WXYZ-1234';

  let dir;

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  test('logs that a token arrived, not the token, the device code or the user code', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-min-device-auth-'));
    const logFile = path.join(dir, 'mcp-min.log');
    vi.resetModules();
    vi.stubEnv('MCP_MIN_LOG_FILE', logFile);
    vi.stubEnv('DEBUG', '1');
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const envAdd = (await import('../portal/env-add.js')).default;

    const stored = [];
    const fetchStub = async (url) => (url.endsWith('/oauth/authorize_device')
      ? {
        ok: true,
        status: 200,
        json: async () => ({
          verification_uri_complete: `https://portal.example.com/device?user_code=${USER_CODE}`,
          device_code: DEVICE_CODE,
          interval: 0.02
        })
      }
      : { ok: true, status: 200, json: async () => ({ access_token: ACCESS_TOKEN }) });

    const result = await runTool(envAdd, 
      { environment: 'device-test', url: 'https://redaction.example.com' },
      { fetch: fetchStub, storeEnvironment: entry => stored.push(entry), portalUrl: 'https://portal.example.com' }
    );
    expect(result.ok).toBe(true);
    // The flow really completed: the waiter stored the token it was given.
    await vi.waitFor(() => expect(stored).toHaveLength(1), { timeout: 5000 });
    expect(stored[0].token).toBe(ACCESS_TOKEN);

    const logged = `${fs.readFileSync(logFile, 'utf8')}\n${stderr.mock.calls.map(([line]) => line).join('')}`;
    expect(logged).toContain('waiter:tokenResponse');
    expect(logged).toContain('"accessTokenReceived":true');
    expect(logged).not.toContain(ACCESS_TOKEN);
    expect(logged).not.toContain(DEVICE_CODE);
    expect(logged).not.toContain(USER_CODE);
    // What a reader needs is still there: which environment, which Portal, how the poll went.
    expect(logged).toContain('device-test');
    expect(logged).toContain('portal.example.com');
  }, 30000);
});

describe('startup', () => {
  // The compile check probes every tool with `{}`, which rejects each one that requires a
  // property; logging those would open DEBUG with thirty meaningless lines.
  test('does not report a rejection for every tool that has required parameters', async () => {
    const { dir, proc } = session('startup-noise', { DEBUG: '1' });
    try {
      await initializeOverStdio(proc);

      const logged = everythingLogged(proc, dir);
      expect(logged).toContain('mcp-min: exposing');
      expect(logged).not.toContain('tool params rejected');
    } finally {
      await stop(proc);
    }
  }, 60000);
});
