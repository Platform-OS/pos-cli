/**
 * The order `stopHttp` tears the transport down in. `close()` aborts in-flight exchanges and this
 * shutdown is a drain that answers them, so the two halves happen at opposite ends: `/mcp` stops
 * accepting a new request as shutdown begins, and the handler is closed after the last response.
 *
 * The endpoint is stubbed: what is under test is the wiring and the order, not the protocol.
 * `http-shutdown.test.js` covers both against the real handler.
 */
import http from 'http';
import { describe, test, expect, vi, beforeEach } from 'vitest';

const captured = { options: null, closed: 0, release: null, closeError: null };

vi.mock('../protocol/http-endpoint.js', () => ({
  MCP_BODY_LIMIT_BYTES: 1024 * 1024,
  createMcpEndpoint: (options) => {
    captured.options = options;
    return {
      // Answers only once the test lets it, so the drain is still open when stopHttp is called.
      endpoint: async (req, res) => {
        await captured.release;
        res.status(200).json({ ok: true });
      },
      close: async () => {
        captured.closed += 1;
        if (captured.closeError) throw captured.closeError;
      }
    };
  }
}));

const { default: startHttp, stopHttp } = await import('../http-server.js');
const { defaultTools } = await import('./helpers/tools.js');

const within = (promise, ms) => Promise.race([promise.then(() => true), new Promise(r => setTimeout(() => r(false), ms))]);

beforeEach(() => {
  captured.options = null;
  captured.closed = 0;
  captured.release = null;
  captured.closeError = null;
});

describe('stopHttp and the SDK handler', () => {
  test('the endpoint is told when shutdown has begun, and not before', async () => {
    const server = await startHttp({ port: 0, tools: defaultTools() });

    expect(captured.options.isClosing()).toBe(false);
    const stopped = stopHttp(server);
    expect(captured.options.isClosing()).toBe(true);

    await stopped;
  });

  test('close() is called after the last response, not at the start of the drain', async () => {
    let release;
    captured.release = new Promise(r => (release = r));
    const server = await startHttp({ port: 0, tools: defaultTools() });
    const { port } = server.address();

    const response = fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST', body: '{}' });
    // The request is being handled, so the drain has something to wait for.
    await vi.waitFor(() => expect(captured.options.isClosing).toBeTypeOf('function'));
    await new Promise(r => setTimeout(r, 50));

    const stopped = stopHttp(server);
    expect(await within(stopped, 200)).toBe(false);
    // The call this drain exists to answer is still running: closing the handler now would abort it.
    expect(captured.closed).toBe(0);

    release();
    expect((await response).status).toBe(200);
    expect(await within(stopped, 2000)).toBe(true);
    expect(captured.closed).toBe(1);
  }, 20000);

  test('a second stopHttp does not close the handler twice', async () => {
    captured.release = Promise.resolve();
    const server = await startHttp({ port: 0, tools: defaultTools() });

    await stopHttp(server);
    await stopHttp(server);

    expect(captured.closed).toBe(1);
  });

  // `index.js` awaits this promise, so a rejection would be reported as a failed shutdown.
  test('a close() that rejects is logged, and the shutdown still completes', async () => {
    captured.release = Promise.resolve();
    captured.closeError = new Error('the handler would not close');
    const server = await startHttp({ port: 0, tools: defaultTools() });

    await expect(stopHttp(server)).resolves.toBeUndefined();

    expect(captured.closed).toBe(1);
  });
});

describe('an http.Server startHttp did not start', () => {
  test('is refused rather than silently ignored', () => {
    expect(() => stopHttp(http.createServer())).toThrow(TypeError);
  });
});
