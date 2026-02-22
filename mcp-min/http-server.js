import express from 'express';
import bodyParser from 'body-parser';
import tools from './tools.js';
import { sseHandler, writeSSE } from './sse.js';
import { DEBUG } from './config.js';
import log from './log.js';

// SSE sessions keyed by Mcp-Session-Id. Supports multiple concurrent clients.
const sseSessions = new Map();

function generateSessionId() {
  return `mcpmin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default async function startHttp({ port = 5910 } = {}) {
  const app = express();

  const router = express.Router();

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
    const list = Object.keys(tools).map((k) => ({ id: k, description: tools[k].description || '' }));
    res.json({ tools: list });
  });

  router.post('/call', async (req, res) => {
    const body = req.body || {};
    const tool = body.tool || body.name || body.id;
    const params = body.params ?? body.input ?? body.data ?? {};
    if (!tool) return res.status(400).json({ error: 'tool required (expected body.tool/name/id)' });
    const entry = tools[tool];
    if (!entry) return res.status(404).json({ error: `tool not found: ${tool}` });

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
        const list = Object.keys(tools).map((name) => ({
          name,
          description: tools[name].description || '',
          inputSchema: tools[name].inputSchema || { type: 'object', additionalProperties: true }
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
          const entry = tools[name];
          if (!entry || typeof entry.handler !== 'function') {
            respond({ error: { code: -32601, message: `Tool not found: ${name}` } });
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
    const entry = tools[tool];
    if (!entry) return res.status(404).json({ error: `tool not found: ${tool}` });

    // Prepare SSE response
    sseHandler(req, res);

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

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      log.info('HTTP server listening', { port });
      resolve(server);
    });
  });
}
