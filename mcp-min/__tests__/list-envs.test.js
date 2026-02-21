
const http = require('http');
const path = require('path');
const fs = require('fs');

let server;

const PORT = 5920;
const CONFIG_FILE = path.resolve(`.pos.test-${PORT}`);

function httpRequest({ method = 'GET', path = '/', body = null, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port: PORT, path, method, headers: Object.assign({ 'Content-Type': 'application/json' }, headers) },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

describe('mcp-min list-envs tool', () => {
  beforeAll(async () => {
    // Write a unique config file for this test
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ staging: { url: 'https://staging.example.com' }, prod: { url: 'https://prod.example.com' } }, null, 2));
    // Set env var so files.getConfig() uses our test config
    process.env.CONFIG_FILE_PATH = CONFIG_FILE;

    // Start the server on a custom port
    const startHttp = (await import('../http-server.js')).default;
    server = await startHttp({ port: PORT });
  });

  afterAll(() => {
    if (server) server.close();
    // Clean up test config file
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
    delete process.env.CONFIG_FILE_PATH;
  });

  test('HTTP /call envs-list returns environments array', async () => {
    const res = await httpRequest({ method: 'POST', path: '/call', body: { tool: 'envs-list', params: {} } });
    expect(res.status).toBe(200);
    const parsed = JSON.parse(res.body);
    expect(Array.isArray(parsed.result.environments)).toBe(true);
    const names = parsed.result.environments.map(e => e.name);
    expect(names).toEqual(expect.arrayContaining(['staging', 'prod']));
  });

  test('JSON-RPC tools/call returns text content with environments', async () => {
    const res = await httpRequest({ method: 'POST', path: '/call-stream', body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'envs-list', arguments: {} } } });
    expect(res.status).toBe(200);
    const parsed = JSON.parse(res.body);
    expect(parsed.result).toBeDefined();
    const content = parsed.result.content;
    expect(Array.isArray(content)).toBe(true);
    const text = content[0].text;
    const decoded = JSON.parse(text);
    expect(Array.isArray(decoded.environments)).toBe(true);
    const names = decoded.environments.map(e => e.name);
    expect(names).toEqual(expect.arrayContaining(['staging', 'prod']));
  });
});
