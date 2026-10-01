import { spawn } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { describe, test, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = resolve(__dirname, '..', 'stdio-server.js');

function runServer() {
  const child = spawn(process.execPath, [script], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.unref();
  return child;
}

const INITIALIZE_MSG = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'pos-cli-tests', version: '1.0.0' } }
}) + '\n';

describe('mcp-min stdio server', () => {
  test('responds to MCP initialize and tools/call', () => new Promise((resolve, reject) => {
    const child = runServer();
    let initialized = false;

    child.stdout.on('data', (c) => {
      const s = c.toString();
      if (!initialized && s.includes('protocolVersion')) {
        initialized = true;
        child.stdin.write(JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'envs-list', arguments: {} }
        }) + '\n');
      }
      if (s.includes('"content"') && s.includes('environments')) {
        child.kill();
        resolve();
      }
    });

    child.on('error', reject);
    child.stdin.write(INITIALIZE_MSG);
  }), 15000);

  test('exits cleanly with code 0 on EPIPE (client disconnects)', () => new Promise((resolve, reject) => {
    const child = runServer();

    child.stdout.on('data', (c) => {
      const s = c.toString();
      if (s.includes('protocolVersion')) {
        child.stdout.destroy();
        child.stdin.write(JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {}
        }) + '\n');
      }
    });

    child.on('exit', (code, signal) => {
      try {
        expect(code === 0 || signal === 'SIGPIPE').toBe(true);
        resolve();
      } catch (e) {
        reject(e);
      }
    });

    child.on('error', reject);
    child.stdin.write(INITIALIZE_MSG);
  }), 15000);

  // The SDK's stdio transport ignores a line that is not JSON (MCP clients never send one): no
  // reply, and the connection keeps serving. The old hand-written server answered -32700.
  test('ignores a line that is not JSON and keeps serving', () => new Promise((resolve, reject) => {
    const child = runServer();
    let buffered = '';
    let sentGarbage = false;

    child.stdout.on('data', (c) => {
      buffered += c.toString();
      const messages = buffered.split('\n').filter(Boolean).map(line => JSON.parse(line));
      if (!sentGarbage && messages.some(m => m.id === 1)) {
        sentGarbage = true;
        child.stdin.write('not a json\n');
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
      }
      const list = messages.find(m => m.id === 2);
      if (list) {
        try {
          expect(messages.map(m => m.id)).toEqual([1, 2]);
          expect(list.result.tools.length).toBeGreaterThan(0);
          child.kill();
          resolve();
        } catch (e) {
          child.kill();
          reject(e);
        }
      }
    });

    child.on('error', reject);
    child.stdin.write(INITIALIZE_MSG);
  }), 15000);
});
