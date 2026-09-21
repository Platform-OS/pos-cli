/**
 * stopHttp(): how the HTTP transport stops when the MCP client leaves. Nothing new is
 * accepted, streams that would never end are ended, and a request already being answered is
 * answered — after which its connection closes instead of idling out the keep-alive timeout
 * and holding the process open.
 */
import http from 'http';
import express from 'express';
import { describe, test, expect } from 'vitest';
import startHttp, { stopHttp } from '../http-server.js';
import { createMcpEndpoint } from '../protocol/http-endpoint.js';
import { connectOutcome } from './helpers/server-process.js';
import { defaultTools, toolsWith } from './helpers/tools.js';

function deferred() {
  let resolve;
  const promise = new Promise(r => (resolve = r));
  return { promise, resolve };
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

  describe('/mcp', () => {
    const envelope = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} };
    const headersFor = (method, name) => ({
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': method,
      ...(name && { 'Mcp-Name': name })
    });

    // Also what stops `close()` being called at the start of a shutdown: it would abort exactly
    // the call this test is about.
    test('a call in flight is answered, then the server stops promptly', async () => {
      const release = deferred();
      const started = deferred();
      const tools = toolsWith({
        'test-slow': {
          description: 'answers when released',
          inputSchema: { type: 'object' },
          handler: async () => { started.resolve(); await release.promise; return { answered: 'after stop began' }; }
        }
      });
      const server = await startHttp({ port: 0, tools });
      const { port } = server.address();

      const response = fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: headersFor('tools/call', 'test-slow'),
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'test-slow', arguments: {}, _meta: envelope } })
      }).then(async r => ({ status: r.status, body: await r.json() }));
      await started.promise;

      const stopped = stopHttp(server);
      expect(await within(stopped, 300)).toBe(false);

      release.resolve();
      const { status, body } = await response;
      expect(status).toBe(200);
      expect(JSON.parse(body.result.content[0].text).data.answered).toBe('after stop began');
      expect(await within(stopped, 1000)).toBe(true);
    });

    // A subscription stream never ends by itself, so it would hold every shutdown open.
    test('ends a subscriptions/listen stream', async () => {
      const server = await startHttp({ port: 0, tools: defaultTools() });
      const { port } = server.address();

      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: headersFor('subscriptions/listen'),
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'subscriptions/listen', params: { notifications: { toolsListChanged: true }, _meta: envelope } })
      });
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      const reader = response.body.getReader();
      expect(new TextDecoder().decode((await reader.read()).value)).toContain('notifications/subscriptions/acknowledged');

      const drained = (async () => {
        try {
          while (!(await reader.read()).done);
        } catch {
          // destroyed by the server: also ended
        }
      })();
      const stopped = stopHttp(server);

      expect(await within(drained, 1000)).toBe(true);
      expect(await within(stopped, 1000)).toBe(true);
    });
  });
});

/**
 * The SDK handler's `close()` cannot simply be called first: it aborts in-flight exchanges, and
 * this shutdown answers them. So the two halves are separate — `/mcp` refuses a *new* request as
 * soon as shutdown begins, and the handler is closed once the drain is done.
 */
describe('the SDK handler is closed, and late requests do not reach a tool', () => {
  const envelope = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} };

  const callHeaders = (name) => ({
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': '2026-07-28',
    'Mcp-Method': 'tools/call',
    'Mcp-Name': name
  });

  const callBody = (name) =>
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: {}, _meta: envelope } });

  /** A tool that records every time it is reached. */
  const counting = (calls) => toolsWith({
    'test-counted': {
      description: 'records that it ran',
      inputSchema: { type: 'object' },
      handler: async () => { calls.push(Date.now()); return { ran: true }; }
    }
  });

  /** The endpoint on a server of its own, so `close()` can be called while it is still listening. */
  async function mounted(tools, isClosing) {
    const { endpoint, close } = createMcpEndpoint({ tools, trackStream: () => {}, isClosing });
    const app = express();
    app.all('/mcp', endpoint);
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return { close, port: server.address().port, stop: () => new Promise(resolve => server.close(resolve)) };
  }

  const post = (port, name) =>
    fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST', headers: callHeaders(name), body: callBody(name) });

  test('close() stops the handler serving, so a call after it never reaches the tool', async () => {
    const calls = [];
    const { close, port, stop } = await mounted(counting(calls));
    try {
      expect((await post(port, 'test-counted')).status).toBe(200);
      expect(calls).toHaveLength(1);

      await close();

      const after = await post(port, 'test-counted');
      expect(after.ok).toBe(false);
      expect(calls).toHaveLength(1);
    } finally {
      await stop();
    }
  });

  // The drain answers what is already running; it does not start anything new.
  test('once shutdown has begun, /mcp refuses a request instead of running a tool', async () => {
    const calls = [];
    const { port, stop } = await mounted(counting(calls), () => true);
    try {
      const response = await post(port, 'test-counted');

      expect(response.status).toBe(503);
      expect((await response.json()).error.message).toMatch(/shutting down/i);
      expect(calls).toEqual([]);
    } finally {
      await stop();
    }
  });

});
