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

describe('mcp-min dependency compatibility', () => {
  test('is-stream should be version 4.x with isReadableStream export', async () => {
    const isStream = await import('is-stream');
    const keys = Object.keys(isStream);
    expect(keys).toContain('isReadableStream');
  });

  test('should start MCP server without dependency errors', () => new Promise((resolve, reject) => {
    const child = runServer();
    let initialized = false;
    let hasError = false;
    let errorOutput = '';

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
      if (data.toString().includes('SyntaxError') || 
          data.toString().includes('does not provide an export')) {
        hasError = true;
      }
    });

    child.stdout.on('data', (c) => {
      const s = c.toString();
      if (!initialized && s.includes('protocolVersion')) {
        initialized = true;
        child.kill();
      }
    });

    child.on('error', reject);
    child.on('exit', () => {
      if (hasError) {
        reject(new Error(`MCP server failed to start due to dependency error: ${errorOutput}`));
      } else {
        resolve();
      }
    });

    const initMsg = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {} }
    }) + '\n';

    child.stdin.write(initMsg);

    setTimeout(() => {
      child.kill();
      if (!initialized) {
        reject(new Error('MCP server failed to initialize within timeout'));
      } else {
        resolve();
      }
    }, 10000);
  }));
});
