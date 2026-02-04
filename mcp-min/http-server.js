import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import tools from './tools.js';
import { sseHandler, writeSSE } from './sse.js';
import { DEBUG, debugLog } from './config.js';

let currentSSE = null; // minimal session: last SSE connection

export default async function startHttp({ port = 5910 } = {}) {
  const app = express();

  const router = express.Router();

  // Enhanced logging in debug mode
  if (DEBUG) {
    app.use(morgan('combined'));
    // Detailed request logger
    app.use((req, res, next) => {
      const start = process.hrtime.bigint();
      debugLog('HTTP request', {
        method: req.method,
        url: req.originalUrl || req.url,
        httpVersion: req.httpVersion,
        remoteAddress: req.ip || req.connection?.remoteAddress,
        headers: req.headers
      });
      res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        debugLog('HTTP response', {
          method: req.method,
          url: req.originalUrl || req.url,
          status: res.statusCode,
          headers: res.getHeaders ? res.getHeaders() : {},
          duration_ms: durationMs.toFixed(2)
        });
      });
      next();
    });
  } else {
    app.use(morgan('tiny'));
  }

  app.use(bodyParser.json({ limit: '1mb' }));

  // Log request bodies for mutating methods in debug mode
  if (DEBUG) {
    app.use((req, res, next) => {
      const method = (req.method || '').toUpperCase();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        try {
          let bodyStr = '';
          try {
            bodyStr = JSON.stringify(req.body);
          } catch (e) {
            bodyStr = '[unserializable-body]';
          }
          debugLog('HTTP request body', {
            method: req.method,
            url: req.originalUrl || req.url,
            body: bodyStr
          });
        } catch (e) {
          debugLog('HTTP request body logging error', String(e));
        }
      }
      next();
    });

    // Log response bodies (JSON/text) for easier debugging
    app.use((req, res, next) => {
      const origJson = res.json.bind(res);
      const origSend = res.send.bind(res);

      res.json = (payload) => {
        try {
          const bodyStr = (() => { try { return JSON.stringify(payload); } catch { return '[unserializable-json]'; } })();
          debugLog('HTTP response body (json)', {
            method: req.method,
            url: req.originalUrl || req.url,
            body: bodyStr
          });
        } catch (e) {
          debugLog('HTTP response body logging error (json)', String(e));
        }
        return origJson(payload);
      };

      res.send = (payload) => {
        try {
          let bodyStr = '';
          if (typeof payload === 'string') bodyStr = payload;
          else if (Buffer.isBuffer(payload)) bodyStr = `[buffer ${payload.length}b]`;
          else bodyStr = JSON.stringify(payload);
          debugLog('HTTP response body (send)', {
            method: req.method,
            url: req.originalUrl || req.url,
            body: bodyStr
          });
        } catch (e) {
          debugLog('HTTP response body logging error (send)', String(e));
        }
        return origSend(payload);
      };

      next();
    });
  }

  // Root route for basic info and discovery
  const handleBaseRoot = (req, res) => {
    const acceptHeader = req.get('accept') || '';
    const wantsSSE = /text\/event-stream/i.test(acceptHeader) || (typeof req.accepts === 'function' && !!req.accepts(['text/event-stream']));
    if (wantsSSE) {
      // SSE handshake on base URL for clients that only know base url + transport=sse
      sseHandler(req, res);
      currentSSE = res;
      req.on('close', () => {
        if (currentSSE === res) currentSSE = null;
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
      DEBUG && debugLog('HTTP /call', { tool, params, rawBodyKeys: Object.keys(body) });
      const result = await entry.handler(params || {}, { transport: 'http', debug: DEBUG });
      DEBUG && debugLog('HTTP /call result', { tool, result });
      res.json({ result });
    } catch (err) {
      DEBUG && debugLog('HTTP /call error', { tool, err: String(err), details: err && err._pos });
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

      const respond = (payload) => {
        const responsePayload = { jsonrpc: '2.0', id, ...payload };
        // If this is a notification (no id), acknowledge with 202
        if (id == null) {
          try { res.set('Mcp-Protocol-Version', responsePayload.result?.protocolVersion || '2025-06-18'); } catch {}
          try { res.set('Mcp-Session-Id', 'mcpmin-1'); } catch {}
          DEBUG && debugLog('JSON-RPC notify -> 202 Accepted');
          res.status(202).end();
          return true;
        }
        // For requests with id: emit on SSE (if present) and also return JSON
        if (currentSSE) {
          DEBUG && debugLog('JSON-RPC respond on SSE channel', { method, id });
          writeSSE(currentSSE, { event: 'message', data: JSON.stringify(responsePayload) });
        }
        try { res.set('Mcp-Protocol-Version', responsePayload.result?.protocolVersion || '2025-06-18'); } catch {}
        try { res.set('Mcp-Session-Id', 'mcpmin-1'); } catch {}
        // Always return 200 for JSON-RPC responses; include errors in payload per protocol expectations
        const status = 200;
        DEBUG && debugLog(`JSON-RPC respond ${status} JSON`, { method, id, response: responsePayload });
        res.status(status).json(responsePayload);
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
        try { res.set('Mcp-Protocol-Version', result.protocolVersion); } catch {}
        try { res.set('Mcp-Session-Id', 'mcpmin-1'); } catch {}
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
      DEBUG && debugLog('SSE initial endpoint event(s) sent', { endpoint: 'call-stream' });
    } catch (e) {
      DEBUG && debugLog('Failed to send initial endpoint event', String(e));
    }

    let closed = false;
    req.on('close', () => { closed = true; DEBUG && debugLog('SSE connection closed', { tool }); });

    // Provide a simple writer function to the tool
    const writer = (event) => {
      if (closed) return;
      DEBUG && debugLog('SSE write', { tool, event });
      writeSSE(res, event);
    };

    // Call the tool's stream handler if present
    if (typeof entry.streamHandler === 'function') {
      try {
        DEBUG && debugLog('HTTP /call-stream start', { tool, params });
        entry.streamHandler(params || {}, { transport: 'http', writer, debug: DEBUG })
          .then(() => {
            writeSSE(res, { event: 'done', data: '' });
            res.end();
            DEBUG && debugLog('HTTP /call-stream done', { tool });
          })
          .catch((err) => {
            writeSSE(res, { event: 'error', data: String(err) });
            res.end();
            DEBUG && debugLog('HTTP /call-stream error', { tool, err: String(err) });
          });
      } catch (err) {
        writeSSE(res, { event: 'error', data: String(err) });
        res.end();
        DEBUG && debugLog('HTTP /call-stream exception', { tool, err: String(err) });
      }
    } else {
      writeSSE(res, { event: 'error', data: 'tool has no streamHandler' });
      res.end();
      DEBUG && debugLog('HTTP /call-stream missing streamHandler', { tool });
    }
  };

  router.post('/call-stream', callStreamHandler);

  // Mount only at root
  app.use('/', router);

  // Ensure POST /call-stream is available at root
  app.post('/call-stream', callStreamHandler);

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      DEBUG && debugLog('HTTP server listening', { port });
      resolve(server);
    });
  });
}
