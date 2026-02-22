import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 5920;
const CONFIG_FILE = path.resolve(`.pos.test-${PORT}`);

function httpRequest({ method = 'GET', path: reqPath = '/', body = null, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port: PORT, path: reqPath, method, headers: { 'Content-Type': 'application/json', ...headers } },
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

let server;

describe('mcp-min list-envs tool', () => {
  beforeAll(async () => {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({
      staging: { url: 'https://staging.example.com' },
      prod: { url: 'https://prod.example.com' }
    }, null, 2));
    process.env.CONFIG_FILE_PATH = CONFIG_FILE;

    const { default: startHttp } = await import('../http-server.js');
    server = await startHttp({ port: PORT });
  });

  afterAll(() => {
    if (server) server.close();
    if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
    delete process.env.CONFIG_FILE_PATH;
  });

  test('HTTP /call envs-list returns ok with data.environments array', async () => {
    const res = await httpRequest({ method: 'POST', path: '/call', body: { tool: 'envs-list', params: {} } });
    expect(res.status).toBe(200);
    const parsed = JSON.parse(res.body);
    expect(parsed.result.ok).toBe(true);
    expect(Array.isArray(parsed.result.data.environments)).toBe(true);
    const names = parsed.result.data.environments.map(e => e.name);
    expect(names).toEqual(expect.arrayContaining(['staging', 'prod']));
  });

  test('JSON-RPC tools/call returns text content with environments', async () => {
    const res = await httpRequest({
      method: 'POST',
      path: '/call-stream',
      body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'envs-list', arguments: {} } }
    });
    expect(res.status).toBe(200);
    const parsed = JSON.parse(res.body);
    expect(parsed.result).toBeDefined();
    const content = parsed.result.content;
    expect(Array.isArray(content)).toBe(true);
    const decoded = JSON.parse(content[0].text);
    expect(decoded.ok).toBe(true);
    expect(Array.isArray(decoded.data.environments)).toBe(true);
    const names = decoded.data.environments.map(e => e.name);
    expect(names).toEqual(expect.arrayContaining(['staging', 'prod']));
  });
});
