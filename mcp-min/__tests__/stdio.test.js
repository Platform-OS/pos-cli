
const { spawn } = require('child_process');
const path = require('path');

// Use absolute path resolved from cwd to support ESM/CommonJS under Jest
const script = path.resolve(process.cwd(), 'mcp-min', 'stdio-server.js');

function runServer() {
  const child = spawn(process.execPath, ['--experimental-vm-modules', script], { stdio: ['pipe', 'pipe', 'pipe'] });
  // Ensure child is killed after tests finish to avoid open handles
  child.unref && child.unref();
  return child;
}

describe('mcp-min stdio server', () => {
  test('responds to MCP initialize and tools/call', (done) => {
    const child = runServer();
    let initialized = false;

    child.stdout.on('data', (c) => {
      const s = c.toString();
      // Wait for initialize response, then call a tool
      if (!initialized && s.includes('protocolVersion')) {
        initialized = true;
        child.stdin.write(JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'envs-list', arguments: {} }
        }) + '\n');
      }
      // Check tool response
      if (s.includes('"content"') && s.includes('environments')) {
        expect(s.includes('environments')).toBe(true);
        child.kill();
        done();
      }
    });

    // Send MCP initialize request
    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {} }
    }) + '\n');
  }, 15000);

  test('exits cleanly with code 0 on EPIPE (client disconnects)', (done) => {
    const child = runServer();

    child.stdout.on('data', (c) => {
      const s = c.toString();
      if (s.includes('protocolVersion')) {
        // Close the parent's read end of stdout pipe to simulate client disconnect
        child.stdout.destroy();

        // Send another request — the response write will hit a broken pipe
        child.stdin.write(JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {}
        }) + '\n');
      }
    });

    child.on('exit', (code, signal) => {
      // Should exit cleanly, not crash
      expect(code === 0 || signal === 'SIGPIPE').toBe(true);
      done();
    });

    // Bootstrap with MCP initialize
    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {} }
    }) + '\n');
  }, 15000);

  test('handles invalid JSON input gracefully', (done) => {
    const child = runServer();
    let initialized = false;

    child.stdout.on('data', (c) => {
      const s = c.toString();
      // Wait for initialize response, then send invalid JSON
      if (!initialized && s.includes('protocolVersion')) {
        initialized = true;
        child.stdin.write('not a json\n');
      }
      // Check error response (MCP protocol: JSON-RPC error with code -32700)
      if (s.includes('"error"') && !s.includes('protocolVersion')) {
        expect(s.includes('Parse error') || s.includes('-32700')).toBe(true);
        child.kill();
        done();
      }
    });

    // Send MCP initialize request first
    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {} }
    }) + '\n');
  }, 15000);
});
