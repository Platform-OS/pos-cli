/**
 * How the MCP server is started and how it ends, observed on real processes started the way
 * MCP clients start them: `pos-cli-mcp`, `pos-cli mcp` (commander spawns the former), and
 * `node mcp-min/stdio-server.js`.
 *
 * Every server here is launched with a stdin pipe held open unless a test closes it, so a
 * server that should not have started — `pos-cli mcp --help` used to start one — shows up as
 * a process that never exits rather than slipping past on an early EOF.
 */
import fs from 'fs';
import http from 'http';
import net from 'net';
import os from 'os';
import { execFileSync } from 'child_process';
import { pathToFileURL } from 'url';
import path from 'path';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import {
  launch, stop, stopAll, waitFor, exitWithin, boundUrl, request, send, closeStdin, stdoutLines, stdoutMessages,
  initializeOverStdio, get, connectOutcome, listen, close, makeWorkDir,
  MCP_BIN, MCP_CONFIG_BIN, POS_CLI_BIN, STDIO_SERVER, INDEX, TOOL_SELECTION, REPO_ROOT, LISTENING
} from './helpers/server-process.js';

// The acceptance bound for "exits promptly" once stdin is closed.
const PROMPT_EXIT_MS = 5000;
// How long a process that should exit by itself is given before it counts as hung. Startup
// (node + commander + the module graph) is not what these tests measure, so this is generous.
const HANG_MS = 15000;

const SPELLINGS = [
  ['pos-cli-mcp', [MCP_BIN]],
  ['pos-cli mcp', [POS_CLI_BIN, 'mcp']]
];

let workDir;

beforeAll(() => {
  workDir = makeWorkDir('pos-cli-mcp-invocation');
});

afterAll(async () => {
  await stopAll();
  fs.rmSync(workDir, { recursive: true, force: true });
});

const INITIALIZE = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'pos-cli-tests', version: '1.0.0' } } };

/** Runs a command that is expected to exit by itself; stdin stays open (see file comment). */
async function runToExit(args, env = {}) {
  const proc = launch({ workDir, args, env: { MCP_MIN_PORT: '0', ...env } });
  try {
    const exit = await exitWithin(proc, HANG_MS);
    return { exit, stdout: proc.stdout, stderr: proc.stderr, elapsed: exit ? exit.at - proc.startedAt : null };
  } finally {
    await stop(proc);
  }
}

function assertNoTransportStarted(stderr) {
  expect(stderr).not.toContain('stdio transport started');
  expect(stderr).not.toMatch(LISTENING);
  expect(stderr).not.toContain('HTTP transport not started');
}

describe('both spellings start the same server', () => {
  test('`pos-cli mcp` answers initialize and lists exactly the tools `pos-cli-mcp` lists', async () => {
    const lists = {};
    for (const [name, args] of SPELLINGS) {
      const proc = launch({ workDir, args, env: { MCP_MIN_PORT: '0' } });
      try {
        const init = await request(proc, INITIALIZE);
        expect(init.result.serverInfo.name).toBe('pos-cli-mcp');
        const list = await request(proc, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
        lists[name] = list.result.tools;
      } finally {
        await stop(proc);
      }
    }

    expect(lists['pos-cli-mcp'].length).toBeGreaterThan(0);
    expect(lists['pos-cli mcp']).toEqual(lists['pos-cli-mcp']);
  }, 60000);

  test.each([[[]], [['--json']]])('`pos-cli mcp-config %j` prints what `pos-cli-mcp-config` prints', async (flags) => {
    const viaPosCli = await runToExit([POS_CLI_BIN, 'mcp-config', ...flags]);
    const direct = await runToExit([MCP_CONFIG_BIN, ...flags]);

    expect(direct.exit.code).toBe(0);
    expect(viaPosCli.exit.code).toBe(0);
    expect(direct.stdout).toContain('envs-list');
    expect(viaPosCli.stdout).toBe(direct.stdout);
  }, 40000);
});

describe('help and version never start a server', () => {
  test.each([
    ['pos-cli mcp --help', [POS_CLI_BIN, 'mcp', '--help']],
    ['pos-cli help mcp', [POS_CLI_BIN, 'help', 'mcp']],
    ['pos-cli-mcp --help', [MCP_BIN, '--help']],
    ['pos-cli-mcp -h', [MCP_BIN, '-h']]
  ])('%s prints usage and exits 0', async (_name, args) => {
    const { exit, stdout, stderr } = await runToExit(args);

    expect(exit, `still running after ${HANG_MS}ms\n${stderr}`).not.toBeNull();
    expect(exit.code).toBe(0);
    expect(stdout).toContain('Usage: pos-cli-mcp [options]');
    expect(stdout).toContain('pos-cli mcp-config');
    assertNoTransportStarted(stderr);
  }, HANG_MS + 5000);

  test.each([
    ['pos-cli mcp --version', [POS_CLI_BIN, 'mcp', '--version']],
    ['pos-cli mcp -v', [POS_CLI_BIN, 'mcp', '-v']],
    ['pos-cli-mcp --version', [MCP_BIN, '--version']],
    ['pos-cli-mcp -v', [MCP_BIN, '-v']]
  ])('%s prints the package version and exits 0', async (_name, args) => {
    const { exit, stdout, stderr } = await runToExit(args);

    expect(exit, `still running after ${HANG_MS}ms\n${stderr}`).not.toBeNull();
    expect(exit.code).toBe(0);
    expect(stdout).toBe(`${pkg.version}\n`);
    assertNoTransportStarted(stderr);
  }, HANG_MS + 5000);
});

describe('arguments the server does not understand stop it before any transport starts', () => {
  test.each([
    ['pos-cli mcp config', [POS_CLI_BIN, 'mcp', 'config'], 'run `pos-cli mcp-config`', 'pos-cli-mcp --help'],
    ['pos-cli-mcp config', [MCP_BIN, 'config'], 'run `pos-cli mcp-config`', 'pos-cli-mcp --help'],
    ['pos-cli mcp --profle dev', [POS_CLI_BIN, 'mcp', '--profle', 'dev'], "unknown option '--profle'", 'pos-cli-mcp --help'],
    ['pos-cli-mcp --profle dev', [MCP_BIN, '--profle', 'dev'], "unknown option '--profle'", 'pos-cli-mcp --help'],
    ['pos-cli mcp-config extra', [POS_CLI_BIN, 'mcp-config', 'extra'], 'too many arguments', 'pos-cli-mcp-config --help'],
    ['pos-cli-mcp-config --jsn', [MCP_CONFIG_BIN, '--jsn'], "unknown option '--jsn'", 'pos-cli-mcp-config --help']
  ])('%s exits 1 naming the valid invocation', async (_name, args, message, usage) => {
    const { exit, stdout, stderr } = await runToExit(args);

    expect(exit, `still running after ${HANG_MS}ms\n${stderr}`).not.toBeNull();
    expect(exit.code).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain(message);
    expect(stderr).toContain(`Run \`${usage}\` for usage information.`);
    assertNoTransportStarted(stderr);
  }, HANG_MS + 5000);
});

describe.each(SPELLINGS)('%s: a client closing stdin ends the server', (_name, args) => {
  test('it exits 0 promptly, releases its HTTP port, and wrote nothing but JSON-RPC to stdout', async () => {
    const proc = launch({ workDir, args, env: { MCP_MIN_PORT: '0' } });
    try {
      const url = await boundUrl(proc);
      await request(proc, INITIALIZE);
      send(proc, { jsonrpc: '2.0', method: 'notifications/initialized' });
      await request(proc, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
      await request(proc, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'envs-list', arguments: {} } });
      await request(proc, { jsonrpc: '2.0', id: 4, method: 'no/such-method', params: {} });

      const closedAt = Date.now();
      closeStdin(proc);
      const exit = await exitWithin(proc, HANG_MS);

      expect(exit, `still running ${HANG_MS}ms after stdin closed\n${proc.stderr}`).not.toBeNull();
      expect(exit.at - closedAt).toBeLessThan(PROMPT_EXIT_MS);
      expect(exit).toMatchObject({ code: 0, signal: null });
      expect(proc.stderr).toContain('stdin closed by the MCP client');
      expect(await connectOutcome('127.0.0.1', Number(new URL(url).port))).toBe('ECONNREFUSED');

      // Every line is a complete JSON-RPC message, and nothing trails the last newline.
      const lines = stdoutLines(proc);
      expect(lines.length).toBeGreaterThanOrEqual(4);
      expect(proc.stdout.endsWith('\n')).toBe(true);
      for (const line of lines) {
        expect(() => JSON.parse(line), line).not.toThrow();
        expect(JSON.parse(line).jsonrpc, line).toBe('2.0');
      }
    } finally {
      await stop(proc);
    }
  }, 60000);

  // The client quit right after starting the server, before sending anything.
  test('a stdin pipe closed before any message still ends it', async () => {
    const proc = launch({ workDir, args, env: { MCP_MIN_PORT: '0' } });
    try {
      const url = await boundUrl(proc);
      const closedAt = Date.now();
      closeStdin(proc);
      const exit = await exitWithin(proc, HANG_MS);

      expect(exit, `still running ${HANG_MS}ms after stdin closed\n${proc.stderr}`).not.toBeNull();
      expect(exit.at - closedAt).toBeLessThan(PROMPT_EXIT_MS);
      expect(exit.code).toBe(0);
      expect(proc.stdout).toBe('');
      expect(await connectOutcome('127.0.0.1', Number(new URL(url).port))).toBe('ECONNREFUSED');
    } finally {
      await stop(proc);
    }
  }, 60000);
});

describe('stdin that is not a client pipe', () => {
  // A file is not a client connection, so its end alone would not stop the server — but one
  // that carried messages was an MCP session, and its end is the end of that session.
  test('requests read from a file are answered, then the server exits', async () => {
    const requests = path.join(workDir, 'requests.jsonl');
    fs.writeFileSync(requests, `${JSON.stringify(INITIALIZE)}\n${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`);
    const fd = fs.openSync(requests, 'r');
    const proc = launch({ workDir, args: [MCP_BIN], env: { MCP_MIN_PORT: '0' }, stdin: fd });
    fs.closeSync(fd);
    try {
      const exit = await exitWithin(proc, HANG_MS);

      expect(exit, `still running\n${proc.stderr}`).not.toBeNull();
      expect(exit.code).toBe(0);
      expect(stdoutMessages(proc).map(m => m.id)).toEqual([1, 2]);
      expect(proc.stderr).toContain('stdin closed by the MCP client');
    } finally {
      await stop(proc);
    }
  }, 60000);
});

describe('HTTP-only use, with no MCP client on stdin', () => {
  test('stdin from /dev/null keeps the HTTP transport serving', async () => {
    const proc = launch({ workDir, args: [MCP_BIN], env: { MCP_MIN_PORT: '0' }, stdin: 'ignore' });
    try {
      const url = await boundUrl(proc);
      await waitFor(proc, p => p.stderr.includes('stdin closed before any message'), 'stdin EOF to be noticed');

      expect(await get(`${url}/health`)).toEqual({ status: 200, body: '{"status":"ok"}' });
      await new Promise(resolve => setTimeout(resolve, 1500));
      expect(proc.exit).toBeNull();
      expect(await get(`${url}/health`)).toEqual({ status: 200, body: '{"status":"ok"}' });
    } finally {
      await stop(proc);
    }
  }, 60000);
});

describe('work in flight when the client leaves', () => {
  // A platformOS instance stand-in that answers /api/graph only when the test says so, so the
  // call is provably still running when stdin closes.
  async function startSlowInstance() {
    let release;
    const released = new Promise(resolve => (release = resolve));
    let received;
    const requestReceived = new Promise(resolve => (received = resolve));
    const server = http.createServer((req, res) => {
      req.resume();
      received();
      released.then(() => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ data: { answeredAfterShutdownBegan: true } }));
      });
    });
    const port = await listen(server, 0, '127.0.0.1');
    return { url: `http://127.0.0.1:${port}`, requestReceived, release, stop: () => { server.closeAllConnections(); return close(server); } };
  }

  const graphCall = (id, url) => ({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name: 'graphql-exec', arguments: { url, email: 'mcp-test@example.com', token: 'test-token', query: '{ slow }' } }
  });

  test('a stdio tool call running when stdin closes still gets its response written, then the server exits', async () => {
    const instance = await startSlowInstance();
    const proc = launch({ workDir, args: [MCP_BIN], env: { MCP_MIN_PORT: '0' } });
    try {
      await initializeOverStdio(proc);
      send(proc, graphCall(42, instance.url));
      await instance.requestReceived;

      closeStdin(proc);
      await waitFor(proc, p => p.stderr.includes('stdin closed by the MCP client'), 'shutdown to begin');
      expect(proc.exit).toBeNull();

      const releasedAt = Date.now();
      instance.release();
      const exit = await exitWithin(proc, HANG_MS);

      expect(exit, `still running\n${proc.stderr}`).not.toBeNull();
      expect(exit.code).toBe(0);
      expect(exit.at - releasedAt).toBeLessThan(PROMPT_EXIT_MS);
      const response = stdoutMessages(proc).find(m => m.id === 42);
      expect(response, proc.stdout).toBeDefined();
      expect(response.result.content[0].text).toContain('answeredAfterShutdownBegan');
    } finally {
      await stop(proc);
      await instance.stop();
    }
  }, 60000);

  // Keep-alive is what the drain has to handle: a finished response on a keep-alive
  // connection would otherwise hold the process open for the 5 s keep-alive timeout.
  test('an HTTP call running when stdin closes gets its response, an open SSE stream is ended, and the server exits', async () => {
    const instance = await startSlowInstance();
    const proc = launch({ workDir, args: [MCP_BIN], env: { MCP_MIN_PORT: '0' } });
    const agent = new http.Agent({ keepAlive: true });
    try {
      const url = new URL(await boundUrl(proc));
      await initializeOverStdio(proc);

      const sseClosed = new Promise((resolve, reject) => {
        http.get({ host: url.hostname, port: url.port, path: '/', headers: { Accept: 'text/event-stream' } }, (res) => {
          res.on('data', () => {});
          res.on('close', resolve);
        }).on('error', reject);
      });

      const callResponse = new Promise((resolve, reject) => {
        const req = http.request({ host: url.hostname, port: url.port, path: '/call', method: 'POST', agent, headers: { 'Content-Type': 'application/json' } }, (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', c => (body += c));
          res.on('end', () => resolve({ status: res.statusCode, body, at: Date.now() }));
        });
        req.on('error', reject);
        req.end(JSON.stringify({ tool: 'graphql-exec', params: graphCall(0, instance.url).params.arguments }));
      });
      await instance.requestReceived;

      closeStdin(proc);
      await waitFor(proc, p => p.stderr.includes('stdin closed by the MCP client'), 'shutdown to begin');
      await sseClosed;
      expect(proc.exit).toBeNull();

      instance.release();
      const response = await callResponse;
      const exit = await exitWithin(proc, HANG_MS);

      expect(response.status).toBe(200);
      expect(response.body).toContain('answeredAfterShutdownBegan');
      expect(exit, `still running\n${proc.stderr}`).not.toBeNull();
      expect(exit.code).toBe(0);
      expect(exit.at - response.at).toBeLessThan(2500);
    } finally {
      agent.destroy();
      await stop(proc);
      await instance.stop();
    }
  }, 60000);
});

describe('a call that never finishes cannot keep the server alive', () => {
  // A stdio server with a tool that never returns and holds the event loop open, as a stuck
  // poll would. The deadline is injected; the production value is pinned in lifecycle.test.js.
  const stuckServer = (deadlineMs) => {
    const script = [
      `import { toolsWith } from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, 'mcp-min', '__tests__', 'helpers', 'tools.js')).href)};`,
      `import startStdio from ${JSON.stringify(pathToFileURL(STDIO_SERVER).href)};`,
      `import { createShutdown } from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, 'mcp-min', 'lifecycle.js')).href)};`,
      "const tools = toolsWith({ stuck: { description: 'never returns', inputSchema: { type: 'object' }, handler: () => new Promise(() => { setInterval(() => {}, 1000); }) } });",
      `startStdio({ tools, shutdown: createShutdown({ deadlineMs: ${deadlineMs} }) });`
    ].join('\n');
    return launch({ workDir, args: ['--input-type=module', '-e', script] });
  };

  async function startStuckCall(proc) {
    await initializeOverStdio(proc);
    send(proc, { jsonrpc: '2.0', id: 'stuck', method: 'tools/call', params: { name: 'stuck', arguments: {} } });
    await new Promise(resolve => setTimeout(resolve, 300));
    closeStdin(proc);
    await waitFor(proc, p => p.stderr.includes('stdin closed by the MCP client'), 'shutdown to begin');
    return Date.now();
  }

  test('the process exits when the deadline passes, without a response to the stuck call', async () => {
    const proc = stuckServer(1500);
    try {
      const shutdownAt = await startStuckCall(proc);
      const exit = await exitWithin(proc, HANG_MS);

      expect(exit, `still running\n${proc.stderr}`).not.toBeNull();
      expect(exit.code).toBe(0);
      expect(exit.at - shutdownAt).toBeGreaterThanOrEqual(1000);
      expect(exit.at - shutdownAt).toBeLessThan(1500 + PROMPT_EXIT_MS);
      expect(proc.stderr).toContain('exiting anyway');
      expect(stdoutMessages(proc).find(m => m.id === 'stuck')).toBeUndefined();
    } finally {
      await stop(proc);
    }
  }, 60000);

  // Without this, the test above would also pass if the stuck tool did not actually hold the
  // process open and it exited on its own.
  test('control: before the deadline, the stuck call does keep the process alive', async () => {
    const proc = stuckServer(60000);
    try {
      await startStuckCall(proc);
      expect(await exitWithin(proc, 3000)).toBeNull();
    } finally {
      await stop(proc);
    }
  }, 60000);
});

describe('node mcp-min/stdio-server.js (direct run)', () => {
  test.each([[[]], [['--cwd', '.']]])('with %j it exits 0 promptly when stdin closes', async (extra) => {
    const proc = launch({ workDir, args: [STDIO_SERVER, ...extra] });
    try {
      await initializeOverStdio(proc);
      const closedAt = Date.now();
      closeStdin(proc);
      const exit = await exitWithin(proc, HANG_MS);

      expect(exit, `still running\n${proc.stderr}`).not.toBeNull();
      expect(exit.at - closedAt).toBeLessThan(PROMPT_EXIT_MS);
      expect(exit.code).toBe(0);
    } finally {
      await stop(proc);
    }
  }, 60000);
});

// A wrapper that dies must not leave its server behind. Signals are POSIX; on Windows the
// stdin rule above is what covers a killed parent.
describe.skipIf(process.platform === 'win32')('when `pos-cli mcp` itself is killed', () => {
  const childrenOf = (pid) => execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' })
    .split('\n')
    .map(line => line.trim().split(/\s+/).map(Number))
    .filter(([, ppid]) => ppid === pid)
    .map(([child]) => child);

  const alive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return err.code === 'EPERM';
    }
  };

  async function gone(pid, ms = PROMPT_EXIT_MS) {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (!alive(pid)) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return !alive(pid);
  }

  // stdin is one end of a Unix socket pair whose other end the test holds, like a client's
  // pipe: it stays open when the wrapper dies. A spawn stdin pipe would not — Node destroys
  // child.stdin when the child exits, which would close it the moment pos-cli is killed.
  async function clientSocketPair() {
    const socketPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-sock-')), 'stdin.sock');
    const listener = net.createServer();
    await listen(listener, socketPath);
    const accepted = new Promise(resolve => listener.once('connection', resolve));
    const client = net.connect(socketPath);
    await new Promise((resolve, reject) => client.once('connect', resolve).once('error', reject));
    const serverEnd = await accepted;
    listener.close();
    return { client, serverEnd };
  }

  async function startWrapped() {
    const { client, serverEnd } = await clientSocketPair();
    const proc = launch({ workDir, args: [POS_CLI_BIN, 'mcp'], env: { MCP_MIN_PORT: '0' }, stdin: serverEnd, input: client });
    // The child has its own copy of the descriptor; this process only needs the client end.
    serverEnd.destroy();
    const port = Number(new URL(await boundUrl(proc)).port);
    await initializeOverStdio(proc);
    const [server] = childrenOf(proc.child.pid);
    expect(server, 'the server process spawned by pos-cli').toBeDefined();
    return { proc, port, server, client };
  }

  test('SIGTERM to the parent terminates the server', async () => {
    const { proc, port, server, client } = await startWrapped();
    try {
      proc.child.kill('SIGTERM');
      await exitWithin(proc, HANG_MS);

      expect(await gone(server)).toBe(true);
      expect(await connectOutcome('127.0.0.1', port)).toBe('ECONNREFUSED');
    } finally {
      client.destroy();
      await stop(proc);
      if (alive(server)) process.kill(server, 'SIGKILL');
    }
  }, 60000);

  test('SIGKILL to the parent orphans the server only until the client closes its pipe', async () => {
    const { proc, port, server, client } = await startWrapped();
    try {
      proc.child.kill('SIGKILL');
      await exitWithin(proc, HANG_MS);

      // The orphan is real: nothing but stdin tells it the client is gone.
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(alive(server)).toBe(true);

      closeStdin(proc);
      expect(await gone(server)).toBe(true);
      expect(await connectOutcome('127.0.0.1', port)).toBe('ECONNREFUSED');
    } finally {
      client.destroy();
      if (alive(server)) process.kill(server, 'SIGKILL');
    }
  }, 60000);
});

// After an uncaught exception the process's state is undefined, and this one holds credentials
// and (with HTTP on) a port that anything local can reach. It drains instead of carrying on:
// responses in flight are written, the port is released, and the exit code says it was not clean.
describe('an uncaught exception', () => {
  test('shuts the server down rather than leaving it serving', async () => {
    const script = [
      `import { start } from ${JSON.stringify(pathToFileURL(INDEX).href)};`,
      `import { selectTools } from ${JSON.stringify(pathToFileURL(TOOL_SELECTION).href)};`,
      "await start({ selection: selectTools({ profile: 'none', include: ['envs-list'], env: {} }), http: false });",
      // Thrown from a timer, which is where an uncaught exception actually comes from: a
      // background task nobody awaited.
      "setTimeout(() => { throw new Error('boom from the test'); }, 50);"
    ].join('\n');

    const proc = launch({ workDir, args: ['--input-type=module', '-e', script] });
    try {
      const exit = await exitWithin(proc, 20000);

      expect(exit, `still running\n${proc.stderr}`).not.toBeNull();
      expect(exit.code).toBe(1);
      expect(proc.stderr).toContain('Uncaught exception, shutting down');
      expect(proc.stderr).toContain('boom from the test');
      // It drains rather than dying: whatever a tool is in the middle of writing still gets to
      // finish, and the transports are stopped through the same path a client disconnect uses.
      expect(proc.stderr).toContain('uncaught exception; shutting down once in-flight work finishes');
    } finally {
      await stop(proc);
    }
  }, 40000);
});
