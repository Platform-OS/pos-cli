import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 5920;
// In a directory of its own: the repository root is every test process's working directory
// (see test/unit/test-isolation.test.js).
const CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), `pos-cli-list-envs-${PORT}-`));
const CONFIG_FILE = path.join(CONFIG_DIR, '.pos');

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
    const { defaultTools } = await import('./helpers/tools.js');
    server = await startHttp({ port: PORT, tools: defaultTools() });
  });

  afterAll(() => {
    if (server) server.close();
    if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
    delete process.env.CONFIG_FILE_PATH;
  });

  // Over /mcp, the one HTTP surface there is. The point of this file is that envs-list reads the
  // .pos the process was pointed at, so it drives a real server with a real config file.
  test('envs-list reports the environments in the .pos it was pointed at', async () => {
    const res = await httpRequest({
      method: 'POST',
      path: '/mcp',
      headers: { 'MCP-Protocol-Version': '2025-06-18', Accept: 'application/json, text/event-stream' },
      body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'envs-list', arguments: {} } }
    });

    expect(res.status).toBe(200);
    // A 2025-era call is answered as one SSE message, which is how the SDK serves that revision.
    const message = JSON.parse(res.body.split('data: ').at(-1));
    const result = message.result;
    expect(result.isError).toBeUndefined();
    const decoded = JSON.parse(result.content[0].text);
    expect(decoded.ok).toBe(true);
    expect(decoded.data.environments.map(e => e.name)).toEqual(expect.arrayContaining(['staging', 'prod']));
  });
});
