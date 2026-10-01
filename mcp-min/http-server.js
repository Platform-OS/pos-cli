import http from 'http';
import express from 'express';
import { DEFAULT_HOST, DEFAULT_PORT, LOOPBACK_HOSTNAMES } from './http-config.js';
import hostValidation from './host-validation.js';
import { createMcpEndpoint } from './protocol/http-endpoint.js';
import log from './log.js';

// Per-server shutdown state, reached by stopHttp(). A WeakMap so a closed server is not kept alive.
const shutdownState = new WeakMap();

/**
 * Stops the HTTP transport without cutting off requests already being answered. New connections
 * are refused and idle ones closed; SSE streams, which never finish on their own, are ended; a
 * request in flight gets its response, and its connection closes as soon as that response is sent
 * rather than lingering for the keep-alive timeout and holding the process open.
 *
 * `state.closing` is set first, so `/mcp` refuses a request arriving after this point.
 *
 * Resolves once every connection has closed **and** the SDK handler with it. That order matters:
 * `close()` aborts in-flight exchanges, which is what this drain exists to let finish.
 */
export function stopHttp(server) {
  const state = shutdownState.get(server);
  if (!state) throw new TypeError('stopHttp: not a server started by startHttp');
  if (state.stopped) return state.stopped;

  state.closing = true;
  state.stopped = new Promise(resolve => server.close(() => resolve()))
    .then(() => state.closeHandler())
    // The listener is already down; a handler that will not close must not fail the shutdown.
    .catch(err => log.error('mcp-min: MCP handler did not close cleanly', { error: String(err) }));
  for (const res of state.streams) res.destroy();
  server.closeIdleConnections();
  return state.stopped;
}

/**
 * Starts the HTTP transport. Resolves with the listening http.Server once the bind has succeeded,
 * and rejects with the listen error when it has not; nothing here reports success before the
 * socket is bound.
 *
 * The defaults are the safe ones: a caller passing only a port gets a loopback-only listener that
 * answers loopback Host/Origin names. The tools have no default at all, so a caller that leaves
 * them out fails rather than serving every registered tool over an unauthenticated port.
 *
 * @param {Map<string, object>} options.tools - the exposed tools (selectTools().tools)
 * @param {readonly string[]} [options.allowedHostnames] - Host/Origin hostnames to accept
 * @returns {Promise<http.Server>}
 */
export default async function startHttp({
  tools,
  port = DEFAULT_PORT,
  host = DEFAULT_HOST,
  allowedHostnames = LOOPBACK_HOSTNAMES
} = {}) {
  if (!(tools instanceof Map)) throw new TypeError('startHttp: tools must be the Map of exposed tools');
  const app = express();
  const server = http.createServer(app);
  const state = { closing: false, stopped: null, streams: new Set(), closeHandler: () => {} };
  shutdownState.set(server, state);

  // First, so it covers every response, including rejected and unknown-route ones.
  app.use((req, res, next) => {
    if (state.closing) res.setHeader('Connection', 'close');
    res.on('finish', () => {
      // After the response is flushed the connection is idle; close it rather than wait out
      // the keep-alive timeout.
      if (state.closing) setImmediate(() => server.closeIdleConnections());
    });
    next();
  });

  const trackStream = (res) => {
    state.streams.add(res);
    res.on('close', () => state.streams.delete(res));
  };

  // Request logging middleware (replaces morgan)
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      log.info(`${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${durationMs.toFixed(1)}ms`);
    });
    log.debug('HTTP request', {
      method: req.method,
      url: req.originalUrl || req.url,
      remoteAddress: req.ip || req.connection?.remoteAddress,
      headers: req.headers
    });
    next();
  });

  // After logging, so a rejected request is still logged; before every route, so a request is
  // never dispatched or its body read — including by routes added later.
  app.use(hostValidation(allowedHostnames));

  const mcp = createMcpEndpoint({ tools, trackStream, isClosing: () => state.closing });
  state.closeHandler = mcp.close;
  app.all('/mcp', mcp.endpoint);

  // Not MCP, and not deprecated with the pre-SDK routes that were: it is how a person, a test or a
  // supervisor asks whether the listener is up without speaking the protocol at all.
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Not app.listen(port, cb): Express 5 hands a listen error to that same callback, which is
  // how a failed bind used to be logged as "listening".
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.off('error', onError);
      // Errors after a successful bind are rare (e.g. accept failures) and must not become
      // an uncaught 'error' event.
      server.on('error', (err) => log.error('HTTP server error', { code: err.code, message: err.message }));
      resolve(server);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}
