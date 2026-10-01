/**
 * `--no-http`: MCP over stdio only, which is what `pos-cli ai init` writes. Stdio clients never use
 * the HTTP listener, and one listener per session races the others for the port — whichever wins
 * then serves every HTTP caller with its own credentials.
 */
import fs from 'fs';
import net from 'net';
import path from 'path';
import { spawnSync } from 'child_process';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { SERVERS } from '../../lib/ai.js';
import { parseServerArgs } from '../cli-args.js';
import {
  launch, stop, stopAll, exitWithin, initializeOverStdio, connectOutcome, makeWorkDir, serverEnv,
  MCP_BIN, MCP_CONFIG_BIN, POS_CLI_BIN, LISTENING, NOT_STARTED
} from './helpers/server-process.js';

const DISABLED = 'mcp-min: HTTP transport disabled (--no-http); serving MCP over stdio only';

let workDir;

beforeAll(() => {
  workDir = makeWorkDir('pos-cli-mcp-no-http');
});

afterAll(async () => {
  await stopAll();
  fs.rmSync(workDir, { recursive: true, force: true });
});

// A port nothing listens on, so "no process listens on it" can be checked without depending on
// what else runs on this machine (5910 may well be taken by an editor's older server).
const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

function expectNoBindAttempt(stderr) {
  expect(stderr).toContain(DISABLED);
  expect(stderr).not.toMatch(LISTENING);
  expect(stderr).not.toMatch(NOT_STARTED);
  expect(stderr).not.toContain('EADDRINUSE');
}

describe('--no-http', () => {
  test.each([
    ['pos-cli-mcp --no-http', [MCP_BIN, '--no-http']],
    ['pos-cli mcp --no-http', [POS_CLI_BIN, 'mcp', '--no-http']]
  ])('%s serves stdio and opens no listener', async (_label, args) => {
    const port = await freePort();
    const proc = launch({ workDir, args, env: { MCP_MIN_PORT: String(port) } });
    try {
      expect((await initializeOverStdio(proc)).result.serverInfo.name).toBe('pos-cli-mcp');
      expectNoBindAttempt(proc.stderr);
      expect(await connectOutcome('127.0.0.1', port)).toBe('ECONNREFUSED');
    } finally {
      await stop(proc);
    }
  }, 30000);

  // An editor's environment can carry a stale MCP_MIN_* value; with no listener there is nothing
  // it could expose, so it must not take stdio down with it.
  test('does not read MCP_MIN_*, so a malformed value does not stop a stdio server', async () => {
    const env = { MCP_MIN_HOST: 'not-an-address', MCP_MIN_PORT: 'eighty', MCP_MIN_ALLOWED_HOSTS: 'http://x' };

    const proc = launch({ workDir, args: [MCP_BIN, '--no-http'], env });
    try {
      expect((await initializeOverStdio(proc)).result).toBeDefined();
      expectNoBindAttempt(proc.stderr);
    } finally {
      await stop(proc);
    }

    // Control: the same environment does stop a server that would listen.
    const withHttp = launch({ workDir, args: [MCP_BIN], env });
    try {
      const exit = await exitWithin(withHttp, 15000);
      expect(exit?.code).toBe(1);
      expect(withHttp.stderr).toContain('MCP_MIN_');
    } finally {
      await stop(withHttp);
    }
  }, 30000);

  test('is a server option: pos-cli mcp-config refuses it', () => {
    const result = spawnSync(process.execPath, [MCP_CONFIG_BIN, '--no-http'], { cwd: workDir, env: serverEnv(workDir), encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unknown option '--no-http'");
  });
});

describe('the configuration pos-cli ai init writes', () => {
  // A project .mcp.json is committed and shared: the release that writes these arguments must
  // be one whose parser accepts all of them.
  test('is accepted by this release\'s argument parser', () => {
    expect(SERVERS['platformos-cli'].command).toBe('pos-cli-mcp');
    expect(parseServerArgs(SERVERS['platformos-cli'].args, { version: '0', writeOut: () => {}, writeErr: () => {} }))
      .toMatchObject({ start: true, http: false, selection: { profile: 'dev' } });
  });

  test('lets several sessions start at once without any HTTP bind attempt', async () => {
    const port = await freePort();
    const sessions = [1, 2, 3].map((n) => {
      const sessionDir = path.join(workDir, `session-${n}`);
      fs.mkdirSync(sessionDir, { recursive: true });
      return { sessionDir, proc: launch({ workDir: sessionDir, args: [MCP_BIN, ...SERVERS['platformos-cli'].args], env: { MCP_MIN_PORT: String(port) } }) };
    });
    try {
      await Promise.all(sessions.map(({ proc }) => initializeOverStdio(proc)));
      expect(await connectOutcome('127.0.0.1', port)).toBe('ECONNREFUSED');

      for (const { proc, sessionDir } of sessions) {
        expectNoBindAttempt(proc.stderr);
        const logFile = fs.readFileSync(path.join(sessionDir, 'mcp-min.log'), 'utf8');
        expect(logFile).toContain(DISABLED);
        expect(logFile).not.toContain('EADDRINUSE');
        expect(logFile).not.toMatch(NOT_STARTED);
      }
    } finally {
      await Promise.all(sessions.map(({ proc }) => stop(proc)));
    }
  }, 60000);
});
