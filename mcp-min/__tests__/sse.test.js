/* eslint-env jest */
import http from 'http';
import startHttp from '../http-server.js';
import fixtures from '../../test/utils/fixtures';

const PORT = 5940;
let server;

beforeAll(async () => {
  fixtures.writeDotPos({ staging: { url: 'https://staging.example.com' } });
  server = await startHttp({ port: PORT });
});

afterAll(() => {
  if (server) server.close();
  fixtures.removeDotPos();
});

function sseRequest(path = '/') {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port: PORT, path, method: 'GET', headers: { Accept: 'text/event-stream' } };
    let captured = '';
    const req = http.request(opts, (res) => {
      res.on('data', (chunk) => {
        captured += chunk.toString();
        if (captured.includes('event: endpoint')) {
          // Close as soon as we see the initial event
          req.destroy();
        }
      });
      res.on('end', () => resolve({ status: res.statusCode, body: captured }));
    });
    req.on('error', (err) => {
      // Treat expected abort-related errors as a successful early return with captured data
      const msg = String(err).toLowerCase();
      if (msg.includes('econnreset') || msg.includes('socket hang up')) {
        return resolve({ status: 200, body: captured });
      }
      reject(err);
    });
    req.end();
  });
}

test('GET / with Accept: text/event-stream returns SSE framing', async () => {
  const res = await sseRequest('/');
  expect(res.status).toBe(200);
  expect(res.body.includes(': connected')).toBe(true);
  expect(res.body.includes('event: endpoint')).toBe(true);
}, 15000);

// Test POST /call-stream legacy streaming initial events
function postCallStream(body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: PORT, path: '/call-stream', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk.toString(); if (data.length > 64 * 1024) req.abort(); });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

test('POST /call-stream legacy returns SSE initial events and error for no streamHandler', async () => {
  const res = await postCallStream({ tool: 'echo', params: { msg: 'hi' } });
  // server responds with text/event-stream framing but via express it will return 200 and then close; we check body
  expect(res.status).toBe(200);
  expect(res.body.includes('event: endpoint')).toBe(true);
});
