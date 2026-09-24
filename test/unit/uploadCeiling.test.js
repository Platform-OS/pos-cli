/**
 * The ceiling an upload actually runs under, driven through `apiRequest` against a real server.
 *
 * Node's fetch applies undici's `headersTimeout` — 300s — to the whole request *send*, and it does
 * not reset as bytes move, so an upload needing longer than that cannot succeed however patient
 * the caller is. `lib/requestCeiling.js` raises it for uploads through a per-request dispatcher.
 *
 * These drive a socket rather than a mock, because the defect is in the HTTP client: a mocked
 * `fetch` would happily "honour" a dispatcher that Node ignores. The ceilings are in seconds so the
 * suite stays fast — the same pair measured at production scale was a 96MB body at 256KB/s, killed
 * at 300.9s under the default and answering 200 at 384.8s with the ceiling raised.
 *
 * **This is also the version guard.** `dispatcher` on `RequestInit` is an undici extension rather
 * than a documented Node API, and the `Agent` comes from the userland copy while `fetch` uses
 * Node's built-in one. If a Node release stops honouring it, the cut-off request below finishes
 * instead of timing out and this fails — loudly, rather than uploads quietly returning to a
 * five-minute cap that nobody would notice until a deploy died on a slow link.
 */
import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'http';
import net from 'net';
import { Agent } from 'undici';

/**
 * Why these are whole seconds: undici runs its timeouts on a coarse wheel, so a ceiling under a
 * second lands late and unpredictably. Measured 2026-09-24 — a 300ms ceiling fired at ~800ms, and
 * a send that finished at 722ms beat it altogether. A ceiling of 1s against a send of ~3s leaves
 * that imprecision well inside the gap.
 */
const CUT_OFF_MS = 1000;
const GENEROUS_MS = 30000;

// 2MB drained 64KB at a time, 96ms apart: about 3s to the response headers whatever the kernel
// buffers, because the server does not answer until it has read the whole body.
const BODY_BYTES = 2 * 1024 * 1024;
const SERVING = { chunkBytes: 64 * 1024, everyMs: 96 };

/** A server that reads the request body at a fixed rate and answers only once it has all of it. */
const readsSlowly = ({ chunkBytes, everyMs }) => http.createServer((req, res) => {
  req.pause();
  const pump = setInterval(() => { req.read(chunkBytes); }, everyMs);
  const stop = () => clearInterval(pump);

  req.on('end', () => {
    stop();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
  });
  req.on('aborted', stop);
  res.on('close', stop);
});

const listen = (server) => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
});

/**
 * Closing waits for open connections, and these tests deliberately leave stalled ones behind, so
 * the sockets are destroyed first. `closeAllConnections` exists on an http.Server only.
 */
const close = (server, sockets = []) => {
  server.closeAllConnections?.();
  for (const socket of sockets) socket.destroy();

  return new Promise((resolve) => server.close(resolve));
};

/**
 * `apiRequest` with the upload ceiling set to `headersTimeout`, everything else its own.
 *
 * Only the dispatcher is replaced: the predicate deciding which requests are uploads stays real,
 * so a request that stops being recognised as one stops getting the ceiling here too.
 */
const apiRequestWithCeiling = async (headersTimeout) => {
  vi.resetModules();
  const agent = new Agent({ headersTimeout });
  vi.doMock('#lib/requestCeiling.js', async (importOriginal) => ({
    ...(await importOriginal()),
    uploadDispatcher: () => agent
  }));

  const { apiRequest } = await import('#lib/apiRequest.js');
  return apiRequest;
};

const upload = (apiRequest, uri) => apiRequest({
  method: 'PUT',
  uri,
  body: Buffer.alloc(BODY_BYTES, 0x61),
  json: false
});

describe('the ceiling an upload runs under', () => {
  let server;
  let origin;

  beforeAll(async () => {
    server = readsSlowly(SERVING);
    origin = await listen(server);
  });

  afterAll(async () => { await close(server); });
  afterEach(() => { vi.doUnmock('#lib/requestCeiling.js'); vi.resetModules(); });

  /**
   * The defect at small scale: an upload still going when the ceiling arrives is cut off, though
   * it is making steady progress and the far end is healthy. If `dispatcher` were ignored this
   * would finish in about three seconds under Node's own 300s default, so the failure is what
   * proves the option took effect.
   */
  test('a ceiling below the time the send needs cuts the upload off', async () => {
    const apiRequest = await apiRequestWithCeiling(CUT_OFF_MS);
    const startedAt = Date.now();

    const error = await upload(apiRequest, `${origin}/upload`).catch((e) => e);

    expect(error, 'the ceiling was not applied — the upload finished instead').toBeInstanceOf(Error);
    expect(error.code).toBe('ETIMEDOUT');
    // Ours, not Node's 300s. Loose on purpose: the assertion above is the real guard, and a loaded
    // runner lands a coarse timer late.
    expect(Date.now() - startedAt).toBeLessThan(30000);
  }, 60000);

  /**
   * The other half of the pair, and the fix: the same upload against the same server completes
   * once the ceiling is above what the send needs.
   */
  test('a ceiling above it lets the same upload finish', async () => {
    const apiRequest = await apiRequestWithCeiling(GENEROUS_MS);

    await expect(apiRequest({
      method: 'PUT',
      uri: `${origin}/upload`,
      body: Buffer.alloc(BODY_BYTES, 0x61),
      json: true
    })).resolves.toEqual({ ok: true });
  }, 60000);

  /**
   * The raised ceiling reaches a request because it sends a file, and an ordinary call is left on
   * Node's default. Observable from outside only as the request that is *not* cut off: this body
   * takes just as long to send, and survives a ceiling that killed the upload above.
   */
  test('an ordinary request is not given the upload ceiling', async () => {
    const apiRequest = await apiRequestWithCeiling(CUT_OFF_MS);

    await expect(apiRequest({
      method: 'POST',
      uri: `${origin}/api`,
      body: { padding: 'x'.repeat(BODY_BYTES) }
    })).resolves.toEqual({ ok: true });
  }, 60000);
});

describe('an upload whose peer stops reading', () => {
  let server;
  let origin;
  const stalled = new Set();

  // Accepts the connection and never reads a byte: the send fills the socket buffers and stops.
  beforeAll(async () => {
    server = net.createServer((socket) => {
      stalled.add(socket);
      socket.on('close', () => stalled.delete(socket));
      socket.on('error', () => {});
    });
    origin = await listen(server);
  });

  afterAll(async () => { await close(server, stalled); });
  afterEach(() => { vi.doUnmock('#lib/requestCeiling.js'); vi.resetModules(); });

  /**
   * A stalled upload has to end, and has to say what happened.
   *
   * Ending is what `UPLOAD_HEADERS_TIMEOUT_MS` being finite buys: with the timeout disabled (`0`) a
   * dead socket would hold a deploy — and in the MCP server a background upload nobody is waiting
   * on — for ever. Saying so is the other half: reaching the client's own ceiling arrives as
   * `fetch failed`, three words naming neither the host nor the cause, while `ServerError` reads
   * `name` and walks to `code`, and mcp-min's `classify` reads `ETIMEDOUT` as a host that did not
   * answer.
   */
  test('ends at the ceiling, reported as a timeout against a named host', async () => {
    const apiRequest = await apiRequestWithCeiling(CUT_OFF_MS);
    const startedAt = Date.now();

    const error = await upload(apiRequest, `${origin}/upload`).catch((e) => e);

    expect(error.name).toBe('RequestError');
    expect(error.code).toBe('ETIMEDOUT');
    expect(error.options.uri).toBe(`${origin}/upload`);
    expect(error.message).not.toMatch(/fetch failed/);
    expect(error.message).toContain('timed out');
    // The bound pos-cli chose is named; the client's own is never invented.
    expect(error.message).toContain(`${20 * 60 * 1000}ms`);
    expect(Date.now() - startedAt).toBeLessThan(30000);
  }, 60000);

  /**
   * A caller that sets its own deadline still wins. The two bounds are different things — the
   * ceiling is the client's, the deadline is ours — and the ceiling is deliberately above every
   * deadline pos-cli sets so the number reported is the one somebody chose on purpose.
   */
  test("a caller's own deadline is what reports, not the ceiling above it", async () => {
    const apiRequest = await apiRequestWithCeiling(GENEROUS_MS);

    const error = await apiRequest({
      method: 'PUT',
      uri: `${origin}/upload`,
      body: Buffer.alloc(BODY_BYTES, 0x61),
      json: false,
      timeout: 500
    }).catch((e) => e);

    expect(error.code).toBe('ETIMEDOUT');
    expect(error.message).toContain('500ms');
  }, 60000);
});
