import http from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import { randomUUID } from 'crypto';
import { findTool } from './tool-selection.js';
import { rejectionFor } from './validate-params.js';
import { OPEN_OBJECT_SCHEMA } from './schemas/default.js';
import { sseHandler, writeSSE } from './sse.js';
import { DEBUG } from './config.js';
import { DEFAULT_HOST, DEFAULT_PORT, LOOPBACK_HOSTNAMES } from './http-config.js';
import hostValidation from './host-validation.js';
import { createMcpEndpoint } from './protocol/http-endpoint.js';
import log from './log.js';

// SSE sessions keyed by Mcp-Session-Id. Supports multiple concurrent clients.
const sseSessions = new Map();

// A session id is the only thing separating one SSE client's stream from another's, so it
// has to be unguessable: Math.random() is seeded per process and its output is predictable
// from a couple of prior samples, which would let a local caller attach to someone else's
// session by supplying the Mcp-Session-Id it derived.
function generateSessionId() {
  return `mcpmin-${randomUUID()}`;
}

// Per-server shutdown state, reached by stopHttp(). A WeakMap so a closed server is not kept alive.
const shutdownState = new WeakMap();

/**
 * Stops the HTTP transport without cutting off requests already being answered.
 *
 * - No new connections are accepted, and idle keep-alive connections close now.
 * - SSE streams never finish on their own, so they are ended now.
 * - A request in flight gets its response, and its connection closes as soon as that response
 *   is sent: left to itself, a keep-alive connection lingers for the 5 s keep-alive timeout
 *   and holds the process open with it.
 *
 * Resolves once every connection has closed.
 */
export function stopHttp(server) {
  const state = shutdownState.get(server);
  if (!state) throw new TypeError('stopHttp: not a server started by startHttp');
  if (state.stopped) return state.stopped;

  state.closing = true;
  state.stopped = new Promise(resolve => server.close(() => resolve()));
  for (const res of state.streams) res.destroy();
  server.closeIdleConnections();
  return state.stopped;
}

/**
 * Starts the HTTP transport.
 *
 * Resolves with the listening http.Server once the bind has succeeded, and rejects with the
 * listen error (EADDRINUSE, EACCES, EADDRNOTAVAIL…) when it has not — the caller decides
 * what a failed bind means; nothing here reports success before the socket is bound.
 *
 * The defaults are the safe ones on purpose: any caller that passes only a port gets a
 * loopback-only listener that answers loopback Host/Origin names only.
 *
 * The tools have no default for the same reason: a caller that leaves them out must fail, not
 * serve every registered tool over an unauthenticated port.
 *
 * @param {object} options
 * @param {Map<string, object>} options.tools - the exposed tools (selectTools().tools)
 * @param {number} [options.port]
 * @param {string} [options.host] - bind address
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
  const state = { closing: false, stopped: null, streams: new Set() };
  shutdownState.set(server, state);

  const router = express.Router();

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

  // After logging, so a rejected request is still logged; before body parsing and every
  // route, so a rejected request is never parsed or dispatched — including routes added later.
  app.use(hostValidation(allowedHostnames));

  // MCP Streamable HTTP (2026-07-28, and 2025-era clients statelessly). After Host/Origin
  // validation like every route; before the JSON body parser, because the SDK reads the body.
  app.all('/mcp', createMcpEndpoint({ tools, trackStream }));

  // Everything below is the deprecated pre-SDK HTTP API (/, /tools, /call, /call-stream),
  // kept working through 6.x and removed at the next major.
  app.use(bodyParser.json({ limit: '1mb' }));

  // Root route for basic info and discovery
  const handleBaseRoot = (req, res) => {
    const acceptHeader = req.get('accept') || '';
    const wantsSSE = /text\/event-stream/i.test(acceptHeader) || (typeof req.accepts === 'function' && !!req.accepts(['text/event-stream']));
    if (wantsSSE) {
      // SSE handshake on base URL for clients that only know base url + transport=sse
      const sessionId = req.headers['mcp-session-id'] || generateSessionId();
      res.set('Mcp-Session-Id', sessionId); // must be set before writeHead in sseHandler
      sseHandler(req, res);
      trackStream(res);
      sseSessions.set(sessionId, res);
      req.on('close', () => {
        sseSessions.delete(sessionId);
        log.debug('SSE session closed', { sessionId });
      });
      // minimal required event (plain text)
      const endpointPath = '/call-stream';
      writeSSE(res, { event: 'endpoint', data: endpointPath });
      // extended info (optional)
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      writeSSE(res, { event: 'endpoint_info', data: JSON.stringify({ base_url: baseUrl, transport: 'sse', path: '/call-stream' }) });
      return; // keep connection open for client to proceed as designed
    }

    res.json({
      name: 'mcp-min',
      status: 'ok',
      endpoints: {
        health: { method: 'GET', path: `/health` },
        tools: { method: 'GET', path: `/tools` },
        call: { method: 'POST', path: `/call` },
        call_stream: { method: 'POST', path: `/call-stream`, transport: 'sse' }
      }
    });
  };

  router.get('/', handleBaseRoot);

  router.get('/health', (req, res) => res.json({ status: 'ok' }));

  router.get('/tools', (req, res) => {
    const list = [...tools].map(([id, tool]) => ({ id, description: tool.description || '' }));
    res.json({ tools: list });
  });

  router.post('/call', async (req, res) => {
    const body = req.body || {};
    const tool = body.tool || body.name || body.id;
    const params = body.params ?? body.input ?? body.data ?? {};
    if (!tool) return res.status(400).json({ error: 'tool required (expected body.tool/name/id)' });
    const entry = findTool(tools, tool);
    if (!entry) return res.status(404).json({ error: `tool not found: ${tool}` });

    const rejection = rejectionFor(tool, entry, params);
    if (rejection) {
      return res
        .status(rejection.httpStatus)
        .json({ error: `invalid params: ${rejection.message}`, details: rejection.errors });
    }

    try {
      log.debug('HTTP /call', { tool, params, rawBodyKeys: Object.keys(body) });
      const result = await entry.handler(params || {}, { transport: 'http', debug: DEBUG });
      log.debug('HTTP /call result', { tool, result });
      res.json({ result });
    } catch (err) {
      log.debug('HTTP /call error', { tool, err: String(err), details: err && err._pos });
      const payload = { error: String(err) };
      if (err && err._pos) payload.details = err._pos;
      res.status(500).json(payload);
    }
  });

  // Streaming call with SSE
  const callStreamHandler = async (req, res) => {
    const body = req.body || {};

    // JSON-RPC compatibility path (e.g., cagent initialize, tools/list)
    if (body && body.jsonrpc === '2.0') {
      const id = body.id ?? null;
      const method = body.method;
      const params = body.params || {};

      // Resolve SSE session for this request (if a prior SSE channel was registered)
      const reqSessionId = req.headers['mcp-session-id'];
      const sseRes = reqSessionId ? sseSessions.get(reqSessionId) : null;

      const respond = (payload) => {
        const responsePayload = { jsonrpc: '2.0', id, ...payload };
        const protocolVersion = responsePayload.result?.protocolVersion || '2025-06-18';
        const sessionId = reqSessionId || 'mcpmin-1';

        // If this is a notification (no id), acknowledge with 202
        if (id == null) {
          try { res.set('Mcp-Protocol-Version', protocolVersion); } catch {}
          try { res.set('Mcp-Session-Id', sessionId); } catch {}
          log.debug('JSON-RPC notify -> 202 Accepted');
          res.status(202).end();
          return true;
        }
        // For requests with id: emit on associated SSE channel (if present) and return JSON
        if (sseRes) {
          log.debug('JSON-RPC respond on SSE channel', { method, id, sessionId });
          writeSSE(sseRes, { event: 'message', data: JSON.stringify(responsePayload) });
        }
        try { res.set('Mcp-Protocol-Version', protocolVersion); } catch {}
        try { res.set('Mcp-Session-Id', sessionId); } catch {}
        log.debug(`JSON-RPC respond 200 JSON`, { method, id, response: responsePayload });
        res.status(200).json(responsePayload);
        return true;
      };

      // Methods
      if (method === 'initialize') {
        const result = {
          protocolVersion: params.protocolVersion || '2025-06-18',
          capabilities: {
            roots: { listChanged: true },
            prompts: {},
            tools: {}
          },
          serverInfo: { name: 'mcp-min', version: '0.1.0' }
        };
        respond({ result });
        return;
      }

      if (method === 'tools/list') {
        const list = [...tools].map(([name, tool]) => ({
          name,
          description: tool.description || '',
          inputSchema: tool.inputSchema || OPEN_OBJECT_SCHEMA,
          ...(tool.annotations && { annotations: tool.annotations })
        }));
        respond({ result: { tools: list } });
        return;
      }

      if (method === 'tools/call') {
        try {
          const name = params?.name || params?.tool || params?.id;
          const args = params?.arguments || params?.params || params?.input || {};
          if (!name) {
            respond({ error: { code: -32602, message: 'Invalid params: name required' } });
            return;
          }
          const entry = findTool(tools, name);
          if (!entry || typeof entry.handler !== 'function') {
            respond({ error: { code: -32601, message: `Tool not found: ${name}` } });
            return;
          }
          const rejection = rejectionFor(name, entry, args);
          if (rejection) {
            respond({
              error: {
                code: rejection.jsonRpcCode,
                message: `Invalid params: ${rejection.message}`,
                data: { errors: rejection.errors }
              }
            });
            return;
          }
          const result = await entry.handler(args, { transport: 'jsonrpc', debug: DEBUG });
          // Wrap result as text content for broad client compatibility
          const text = (() => { try { return JSON.stringify(result); } catch { return String(result); } })();
          respond({ result: { content: [{ type: 'text', text }] } });
          return;
        } catch (e) {
          respond({ error: { code: -32603, message: `Internal error: ${String(e)}` } });
          return;
        }
      }

      if (method === 'roots/list') {
        respond({ result: { roots: [] } });
        return;
      }

      // Unknown method -> JSON-RPC error
      const error = { code: -32601, message: `Method not found: ${method}` };
      respond({ error });
      return;
    }

    // Legacy tool streaming path
    const tool = body.tool || body.name || body.id;
    const params = body.params ?? body.input ?? body.data ?? {};
    if (!tool) return res.status(400).json({ error: 'tool required (expected body.tool/name/id)' });
    const entry = findTool(tools, tool);
    if (!entry) return res.status(404).json({ error: `tool not found: ${tool}` });

    // Validate before the SSE handshake: once the stream is open the status code is
    // already sent, so a rejection could only be reported as an in-band error event.
    const streamRejection = rejectionFor(tool, entry, params);
    if (streamRejection) {
      return res
        .status(streamRejection.httpStatus)
        .json({ error: `invalid params: ${streamRejection.message}`, details: streamRejection.errors });
    }

    // Prepare SSE response
    sseHandler(req, res);
    trackStream(res);

    // Emit initial endpoint event required by some clients (legacy pattern)
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      // Plain string first event
      writeSSE(res, { event: 'endpoint', data: 'call-stream' });
      // Extended info (optional secondary event)
      writeSSE(res, { event: 'endpoint_info', data: JSON.stringify({ base_url: baseUrl, transport: 'sse', path: '/call-stream' }) });
      log.debug('SSE initial endpoint event(s) sent', { endpoint: 'call-stream' });
    } catch (e) {
      log.debug('Failed to send initial endpoint event', String(e));
    }

    let closed = false;
    req.on('close', () => { closed = true; log.debug('SSE connection closed', { tool }); });

    // Provide a simple writer function to the tool
    const writer = (event) => {
      if (closed) return;
      log.debug('SSE write', { tool, event });
      writeSSE(res, event);
    };

    // Call the tool's stream handler if present
    if (typeof entry.streamHandler === 'function') {
      try {
        log.debug('HTTP /call-stream start', { tool, params });
        entry.streamHandler(params || {}, { transport: 'http', writer, debug: DEBUG })
          .then(() => {
            writeSSE(res, { event: 'done', data: '' });
            res.end();
            log.debug('HTTP /call-stream done', { tool });
          })
          .catch((err) => {
            writeSSE(res, { event: 'error', data: String(err) });
            res.end();
            log.debug('HTTP /call-stream error', { tool, err: String(err) });
          });
      } catch (err) {
        writeSSE(res, { event: 'error', data: String(err) });
        res.end();
        log.debug('HTTP /call-stream exception', { tool, err: String(err) });
      }
    } else {
      writeSSE(res, { event: 'error', data: 'tool has no streamHandler' });
      res.end();
      log.debug('HTTP /call-stream missing streamHandler', { tool });
    }
  };

  router.post('/call-stream', callStreamHandler);

  app.use('/', router);

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
