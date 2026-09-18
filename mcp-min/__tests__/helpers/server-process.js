/**
 * Starting the MCP server the way clients do — as a separate process on pipes — and observing it
 * from outside: its stderr log lines, its stdout JSON-RPC, its port, its exit.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import net from 'net';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '..', '..', '..');
export const MCP_BIN = path.join(REPO_ROOT, 'bin', 'pos-cli-mcp.js');
export const MCP_CONFIG_BIN = path.join(REPO_ROOT, 'bin', 'pos-cli-mcp-config.js');
export const POS_CLI_BIN = path.join(REPO_ROOT, 'bin', 'pos-cli.js');
export const STDIO_SERVER = path.join(REPO_ROOT, 'mcp-min', 'stdio-server.js');
export const INDEX = path.join(REPO_ROOT, 'mcp-min', 'index.js');
export const TOOL_SELECTION = path.join(REPO_ROOT, 'mcp-min', 'tool-selection.js');

export const STARTUP_TIMEOUT = 20000;
export const LISTENING = /mcp-min: HTTP server listening on (http:\/\/\S+)/;
export const NOT_STARTED = /mcp-min: HTTP transport not started/;

export const lanAddress = Object.values(os.networkInterfaces())
  .flat()
  .find(i => i && !i.internal && i.family === 'IPv4')?.address;
export const NO_LAN_REASON = 'skipped: this machine has no non-loopback IPv4 interface';

const running = new Set();

/** A scratch working directory with no .pos, so nothing a test starts can reach an instance. */
export function makeWorkDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

export function serverEnv(workDir, overrides = {}) {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name.startsWith('MCP_MIN_') || name.startsWith('MPKIT_')) delete env[name];
  }
  delete env.MCP_TOOLS_CONFIG;
  return { ...env, CI: 'true', MCP_MIN_LOG_FILE: path.join(workDir, 'mcp-min.log'), ...overrides };
}

// `stdin` takes what spawn() takes: 'ignore' opens /dev/null, and a connected socket lets the test
// keep the client end open independently of the child, which Node otherwise destroys on exit.
// `input` is where send() writes when stdin is a socket.
export function launch({ workDir, args = [MCP_BIN], env = {}, stdin = 'pipe', input }) {
  const child = spawn(process.execPath, args, {
    cwd: workDir,
    env: serverEnv(workDir, env),
    stdio: [stdin, 'pipe', 'pipe']
  });
  const proc = { child, input: input ?? child.stdin, stdout: '', stderr: '', exit: null, startedAt: Date.now() };
  proc.exited = new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      proc.exit = { code, signal, at: Date.now() };
      running.delete(proc);
      resolve(proc.exit);
    });
  });
  child.stdout.setEncoding('utf8').on('data', chunk => (proc.stdout += chunk));
  child.stderr.setEncoding('utf8').on('data', chunk => (proc.stderr += chunk));
  running.add(proc);
  return proc;
}

export function stop(proc) {
  if (proc.exit) return proc.exited;
  proc.child.kill();
  return proc.exited;
}

/** Safety net for afterAll; tests stop what they start in their own finally blocks. */
export function stopAll() {
  return Promise.all([...running].map(stop));
}

export async function waitFor(proc, predicate, what, timeout = STARTUP_TIMEOUT) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = predicate(proc);
    if (found) return found;
    if (proc.exit) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  const found = predicate(proc);
  if (found) return found;
  throw new Error(`timed out waiting for ${what}\n--- stderr ---\n${proc.stderr}\n--- stdout ---\n${proc.stdout}`);
}

/** Resolves with the exit, or null if the process is still running after `ms`. */
export function exitWithin(proc, ms) {
  return Promise.race([proc.exited, new Promise(resolve => setTimeout(() => resolve(null), ms))]);
}

export const boundUrl = proc => waitFor(proc, p => LISTENING.exec(p.stderr)?.[1], 'the listening log line');

// Only lines already terminated by a newline: a chunk can end mid-message.
export function stdoutLines(proc) {
  return proc.stdout.slice(0, proc.stdout.lastIndexOf('\n') + 1).split('\n').filter(line => line.trim());
}

export function stdoutMessages(proc) {
  return stdoutLines(proc).map(line => JSON.parse(line));
}

export function send(proc, message) {
  proc.input.write(`${JSON.stringify(message)}\n`);
}

/** Ends the client's side of stdin: what an MCP client does when it disconnects. */
export function closeStdin(proc) {
  proc.input.end();
}

/** Sends a request and resolves with the response carrying its id. */
export async function request(proc, message, timeout = STARTUP_TIMEOUT) {
  send(proc, message);
  return waitFor(
    proc,
    p => stdoutMessages(p).find(m => m.id === message.id),
    `the response to ${JSON.stringify(message.id)}`,
    timeout
  );
}

// Answers over stdio prove the MCP transport clients actually use is serving.
export function initializeOverStdio(proc) {
  return request(proc, {
    jsonrpc: '2.0',
    id: 'init',
    method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'pos-cli-tests', version: '1.0.0' } }
  });
}

export function get(url, { host } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = http.get({
      host: target.hostname.replace(/^\[|\]$/g, ''),
      port: target.port,
      path: target.pathname,
      headers: host ? { Host: host } : {}
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

export const connectOutcome = (host, port) => new Promise((resolve) => {
  const socket = net.connect({ host, port });
  socket.setTimeout(5000);
  socket.once('connect', () => { socket.destroy(); resolve('connected'); });
  socket.once('timeout', () => { socket.destroy(); resolve('timeout'); });
  socket.once('error', (err) => resolve(err.code));
});

export const listen = (server, ...args) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(...args, () => resolve(server.address().port));
});

export const close = server => new Promise(resolve => server.close(resolve));
