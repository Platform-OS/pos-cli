/**
 * Startup of the real entry point, bin/pos-cli-mcp.js, as MCP clients launch it: what it
 * binds, what it says it bound, what it does when it cannot bind, and that a malformed
 * MCP_MIN_* value stops it before either transport starts.
 *
 * The log is the only way a user learns where the unauthenticated HTTP transport is — or
 * that it is not running and something else answers on its port — so its lines are asserted
 * against what a client can actually reach.
 */
import http from 'http';
import net from 'net';
import fs from 'fs';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
  launch, stop, stopAll, waitFor, boundUrl, initializeOverStdio, get, connectOutcome, listen, close, makeWorkDir,
  lanAddress, NO_LAN_REASON, STARTUP_TIMEOUT, LISTENING, NOT_STARTED
} from './helpers/server-process.js';

let workDir;

beforeAll(() => {
  // No .pos here, and no MPKIT_* in the server's environment: nothing this suite starts can reach an instance.
  workDir = makeWorkDir('pos-cli-mcp-startup');
});

// Each test stops what it launched in its own finally block — an afterEach would also kill
// the servers of concurrent tests still running. This is only the safety net.
afterAll(async () => {
  await stopAll();
  fs.rmSync(workDir, { recursive: true, force: true });
});

const start = (env = {}) => launch({ workDir, env });

const canBindIPv6Loopback = await (async () => {
  const probe = net.createServer();
  try {
    await listen(probe, 0, '::1');
    await close(probe);
    return true;
  } catch {
    return false;
  }
})();

// Only where this process really is refused a privileged port: not as root, not where
// unprivileged ports start at 0, and not on Windows, which has no privileged ports.
const privilegedPortRefused = await (async () => {
  const probe = net.createServer();
  try {
    await listen(probe, 1, '127.0.0.1');
    await close(probe);
    return false;
  } catch (err) {
    return err.code === 'EACCES';
  }
})();

describe('a malformed MCP_MIN_* value stops startup', () => {
  test.concurrent.each([
    ['MCP_MIN_HOST', 'not a host'],
    ['MCP_MIN_HOST', '[::1]'],
    ['MCP_MIN_PORT', 'abc'],
    ['MCP_MIN_ALLOWED_HOSTS', 'http://devbox.local'],
    ['MCP_MIN_ALLOWED_HOSTS', 'devbox.local,,10.0.0.5'],
    ['MCP_MIN_ALLOWED_HOSTS', 'devbox.local:5910'],
    ['MCP_MIN_ALLOWED_HOSTS', '*.example.com']
  ])('%s=%j', async (name, value) => {
    // Port 0, so a value wrongly accepted binds a free port rather than 5910.
    const proc = start({ MCP_MIN_PORT: '0', [name]: value });
    try {
      const exit = await Promise.race([
        proc.exited,
        new Promise(resolve => setTimeout(() => resolve(null), STARTUP_TIMEOUT))
      ]);

      expect(exit, `still running\n${proc.stderr}`).not.toBeNull();
      expect(exit.code).toBe(1);
      expect(proc.stdout).toBe('');

      // One message naming the variable and the value, through the logger, not a stack trace.
      const lines = proc.stderr.trim().split(/\r?\n/);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(name);
      expect(lines[0]).toContain(`"${value}"`);
      expect(proc.stderr).not.toMatch(/^\s+at .+:\d+:\d+\)?$/m);

      // Neither transport got as far as starting.
      expect(proc.stderr).not.toContain('stdio transport started');
      expect(proc.stderr).not.toMatch(/listening/i);
    } finally {
      await stop(proc);
    }
  }, STARTUP_TIMEOUT + 5000);
});

describe('default startup', () => {
  test('logs the address actually bound, which answers, and binds loopback only', async () => {
    const proc = start({ MCP_MIN_PORT: '0' });
    try {
      const url = await boundUrl(proc);

      // Port 0 is resolved to the real port; a log echoing the configuration would say :0.
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      const port = Number(new URL(url).port);
      expect(port).toBeGreaterThan(0);

      expect(await get(`${url}/health`)).toEqual({ status: 200, body: '{"status":"ok"}' });
      expect(proc.stderr).not.toMatch(/no authentication/);
      expect(proc.stderr).not.toMatch(NOT_STARTED);

      if (lanAddress) expect(await connectOutcome(lanAddress, port)).toBe('ECONNREFUSED');
    } finally {
      await stop(proc);
    }
  }, STARTUP_TIMEOUT + 10000);

  test.skipIf(!canBindIPv6Loopback)(
    canBindIPv6Loopback ? 'an IPv6 bind address is logged in URL form' : 'IPv6 bind — skipped: ::1 is not available on this machine',
    async () => {
      const proc = start({ MCP_MIN_HOST: '::1', MCP_MIN_PORT: '0' });
      try {
        const url = await boundUrl(proc);

        expect(url).toMatch(/^http:\/\/\[::1\]:\d+$/);
        expect(await get(`${url}/health`)).toEqual({ status: 200, body: '{"status":"ok"}' });
        expect(proc.stderr).not.toMatch(/no authentication/);
      } finally {
        await stop(proc);
      }
    },
    STARTUP_TIMEOUT + 5000
  );
});

describe('when the port is taken', () => {
  test('reports the failure with code, host and port, never claims to listen, and keeps serving stdio', async () => {
    const holder = net.createServer();
    const port = await listen(holder, 0, '127.0.0.1');
    const proc = start({ MCP_MIN_PORT: String(port) });
    try {
      const line = await waitFor(proc, p => p.stderr.split('\n').find(l => NOT_STARTED.test(l)), 'the bind failure');

      expect(line).toContain('[ERROR');
      expect(line).toContain('EADDRINUSE');
      expect(line).toContain(`127.0.0.1:${port}`);
      expect(line).toContain('older pos-cli-mcp');

      const response = await initializeOverStdio(proc);
      expect(response.result.protocolVersion).toBeDefined();
      expect(proc.exit).toBeNull();
      expect(proc.stderr).not.toMatch(/listening/i);
    } finally {
      await stop(proc);
      await close(holder);
    }
  }, STARTUP_TIMEOUT + 10000);

  // The upgrade case: an older pos-cli-mcp holds the port on every interface. Where the OS
  // refuses the loopback bind (Linux), that must be reported; where it allows it, the log may
  // say "listening" only if 127.0.0.1 then really reaches the new server, not the old one.
  test('by a listener on all interfaces, the log tells the truth about who answers 127.0.0.1', async () => {
    const old = http.createServer((req, res) => res.end('OLD'));
    const port = await listen(old, 0);
    const proc = start({ MCP_MIN_PORT: String(port) });
    try {
      await waitFor(proc, p => LISTENING.test(p.stderr) || NOT_STARTED.test(p.stderr), 'a bind outcome');

      if (process.platform === 'linux') {
        expect(proc.stderr).toMatch(NOT_STARTED);
      }

      if (NOT_STARTED.test(proc.stderr)) {
        // Linux refuses with EADDRINUSE; Windows may refuse a bind that would shadow another
        // process's wildcard listener with EACCES instead.
        expect(proc.stderr).toMatch(process.platform === 'linux' ? /\(EADDRINUSE\)/ : /\((EADDRINUSE|EACCES)\)/);
        expect(proc.stderr).toContain(`127.0.0.1:${port}`);
        expect(proc.stderr).not.toMatch(/listening/i);
        expect((await get(`http://127.0.0.1:${port}/health`)).body).toBe('OLD');
      } else {
        expect(await get(`http://127.0.0.1:${port}/health`)).toEqual({ status: 200, body: '{"status":"ok"}' });
      }

      expect((await initializeOverStdio(proc)).result.protocolVersion).toBeDefined();
    } finally {
      await stop(proc);
      await close(old);
    }
  }, STARTUP_TIMEOUT + 10000);
});

describe('other bind failures', () => {
  // 192.0.2.0/24 is TEST-NET-1 (RFC 5737): never assigned to a local interface.
  test('an address that is not on this machine is reported, not warned about, and stdio keeps serving', async () => {
    const proc = start({ MCP_MIN_HOST: '192.0.2.1', MCP_MIN_PORT: '0' });
    try {
      const line = await waitFor(proc, p => p.stderr.split('\n').find(l => NOT_STARTED.test(l)), 'the bind failure');

      expect(line).toContain('(EADDRNOTAVAIL)');
      expect(line).toContain('192.0.2.1');
      expect(line).toContain('MCP_MIN_HOST');
      expect((await initializeOverStdio(proc)).result.protocolVersion).toBeDefined();
      expect(proc.stderr).not.toMatch(/listening/i);
      // Nothing was exposed, so there is nothing to warn about.
      expect(proc.stderr).not.toMatch(/no authentication/);
    } finally {
      await stop(proc);
    }
  }, STARTUP_TIMEOUT + 10000);

  test.skipIf(!privilegedPortRefused)(
    privilegedPortRefused
      ? 'a privileged port is reported with code, host and port'
      : 'privileged port — skipped: this process may bind port 1',
    async () => {
      const proc = start({ MCP_MIN_PORT: '1' });
      try {
        const line = await waitFor(proc, p => p.stderr.split('\n').find(l => NOT_STARTED.test(l)), 'the bind failure');

        expect(line).toContain('(EACCES)');
        expect(line).toContain('127.0.0.1:1');
        expect((await initializeOverStdio(proc)).result.protocolVersion).toBeDefined();
        expect(proc.stderr).not.toMatch(/listening/i);
      } finally {
        await stop(proc);
      }
    },
    STARTUP_TIMEOUT + 10000
  );
});

describe('MCP_MIN_HOST=0.0.0.0', () => {
  test('binds all interfaces, warns that it is unauthenticated, and still validates Host/Origin', async () => {
    const proc = start({ MCP_MIN_HOST: '0.0.0.0', MCP_MIN_PORT: '0', MCP_MIN_ALLOWED_HOSTS: 'devbox.internal' });
    try {
      const url = await boundUrl(proc);

      expect(url).toMatch(/^http:\/\/0\.0\.0\.0:\d+$/);
      const port = Number(new URL(url).port);

      const warning = await waitFor(proc, p => p.stderr.split('\n').find(l => l.includes('no authentication')), 'the exposure warning');
      expect(warning).toContain('[WARN');
      expect(warning).toContain(url);
      expect(warning).toContain('MCP_MIN_HOST');
      expect(warning).toContain('localhost, 127.0.0.1, [::1], devbox.internal');

      const local = `http://127.0.0.1:${port}/health`;
      expect(await get(local, { host: `devbox.internal:${port}` })).toEqual({ status: 200, body: '{"status":"ok"}' });
      expect(await get(local, { host: `localhost:${port}` })).toEqual({ status: 200, body: '{"status":"ok"}' });

      const rejected = await get(local, { host: `evil.example:${port}` });
      expect(rejected.status).toBe(403);
      expect(JSON.parse(rejected.body)).toEqual({ jsonrpc: '2.0', error: { code: -32000, message: 'Invalid Host: evil.example' }, id: null });
    } finally {
      await stop(proc);
    }
  }, STARTUP_TIMEOUT + 10000);

  test.skipIf(!lanAddress)(
    lanAddress ? `is reachable on ${lanAddress}, where a Host not on the allowlist is still refused` : `LAN reachability — ${NO_LAN_REASON}`,
    async () => {
      const proc = start({ MCP_MIN_HOST: '0.0.0.0', MCP_MIN_PORT: '0' });
      try {
        const port = Number(new URL(await boundUrl(proc)).port);

        const res = await get(`http://${lanAddress}:${port}/health`);
        expect(res.status).toBe(403);
        expect(JSON.parse(res.body).error.message).toBe(`Invalid Host: ${lanAddress}`);
      } finally {
        await stop(proc);
      }
    },
    STARTUP_TIMEOUT + 10000
  );
});
