/**
 * stopHttp(): how the HTTP transport stops when the MCP client leaves. Nothing new is
 * accepted, streams that would never end are ended, and a request already being answered is
 * answered — after which its connection closes instead of idling out the keep-alive timeout
 * and holding the process open.
 */
import http from 'http';
import { describe, test, expect } from 'vitest';
import startHttp, { stopHttp } from '../http-server.js';
import { connectOutcome } from './helpers/server-process.js';
import { defaultTools, toolsWith } from './helpers/tools.js';

function deferred() {
  let resolve;
  const promise = new Promise(r => (resolve = r));
  return { promise, resolve };
}

function openStream({ port, method = 'GET', path = '/', body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port, path, method,
      headers: { Accept: 'text/event-stream', ...(body ? { 'Content-Type': 'application/json' } : {}) }
    }, (res) => {
      const closed = new Promise(r => res.on('close', r));
      res.once('data', () => resolve({ res, closed }));
    });
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

const within = (promise, ms) => Promise.race([promise.then(() => true), new Promise(r => setTimeout(() => r(false), ms))]);

describe('stopHttp', () => {
  test('refuses a server it did not start', () => {
    expect(() => stopHttp(http.createServer())).toThrow(new TypeError('stopHttp: not a server started by startHttp'));
  });

  test('stops accepting connections at once and resolves; a second call returns the same promise', async () => {
    const server = await startHttp({ port: 0, tools: defaultTools() });
    const { port } = server.address();

    const stopped = stopHttp(server);
    expect(stopHttp(server)).toBe(stopped);
    expect(await within(stopped, 1000)).toBe(true);
    expect(await connectOutcome('127.0.0.1', port)).toBe('ECONNREFUSED');
  });

  test('an idle keep-alive connection does not delay it', async () => {
    const server = await startHttp({ port: 0, tools: defaultTools() });
    const { port } = server.address();
    const agent = new http.Agent({ keepAlive: true });
    try {
      await new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path: '/health', agent }, res => { res.resume(); res.on('end', resolve); }).on('error', reject);
      });

      expect(await within(stopHttp(server), 1000)).toBe(true);
    } finally {
      agent.destroy();
    }
  });

  test('ends the GET / SSE stream, which would otherwise never finish', async () => {
    const server = await startHttp({ port: 0, tools: defaultTools() });
    const { closed } = await openStream({ port: server.address().port });

    const stopped = stopHttp(server);

    expect(await within(closed, 1000)).toBe(true);
    expect(await within(stopped, 1000)).toBe(true);
  });

  test('ends a POST /call-stream tool stream, which would otherwise never finish', async () => {
    const tools = toolsWith({
      'test-endless-stream': {
        description: 'streams forever',
        inputSchema: { type: 'object' },
        streamHandler: () => new Promise(() => {})
      }
    });
    const server = await startHttp({ port: 0, tools });
    const { closed } = await openStream({
      port: server.address().port,
      method: 'POST',
      path: '/call-stream',
      body: { tool: 'test-endless-stream', params: {} }
    });

    const stopped = stopHttp(server);

    expect(await within(closed, 1000)).toBe(true);
    expect(await within(stopped, 1000)).toBe(true);
  });

  // Without the drain, the response arrives but the connection then idles for the 5 s
  // keep-alive timeout, and the process with it.
  test('a call in flight on a keep-alive connection is answered, then its connection closes promptly', async () => {
    const release = deferred();
    const started = deferred();
    const tools = toolsWith({
      'test-slow': {
        description: 'answers when released',
        inputSchema: { type: 'object' },
        handler: async () => { started.resolve(); await release.promise; return { ok: true, answered: 'after stop began' }; }
      }
    });
    const server = await startHttp({ port: 0, tools });
    const { port } = server.address();
    const agent = new http.Agent({ keepAlive: true });
    try {
      const response = new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port, path: '/call', method: 'POST', agent, headers: { 'Content-Type': 'application/json' } }, (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', c => (body += c));
          res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        req.end(JSON.stringify({ tool: 'test-slow', params: {} }));
      });
      await started.promise;

      const stopped = stopHttp(server);
      expect(await within(stopped, 300)).toBe(false);

      release.resolve();
      const { status, body } = await response;
      expect(status).toBe(200);
      expect(JSON.parse(body).result.answered).toBe('after stop began');
      expect(await within(stopped, 1000)).toBe(true);
    } finally {
      agent.destroy();
    }
  });
});
