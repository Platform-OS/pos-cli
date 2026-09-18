/**
 * `/mcp`: MCP Streamable HTTP, served by the SDK's web-standard handler (`fetch(Request)` →
 * `Response`) for 2026-07-28 clients and, statelessly, for 2025-era clients.
 *
 * The SDK leaves mounting on Node to a Hono adapter; the bridge needs only what is below, so this
 * server keeps one web framework. A client that goes away before the response is complete aborts
 * the request, which is how a tool learns the call was cancelled.
 *
 * Host/Origin validation runs in http-server.js, before any handler here.
 */
import { Readable, pipeline } from 'stream';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createServerFactory } from './server-factory.js';
import log from '../log.js';

// The same limit the legacy JSON routes put on their bodies.
export const MCP_BODY_LIMIT_BYTES = 1024 * 1024;

const jsonRpcError = (res, status, message) =>
  res.status(status).json({ jsonrpc: '2.0', error: { code: -32000, message }, id: null });

/**
 * Reads the whole body, or resolves null as soon as it grows past the limit.
 *
 * Events rather than `for await`, whose early return destroys the request — and with it the socket
 * the 413 still has to be written to.
 */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        // Stop reading, but leave the request intact: the caller answers on it.
        req.pause();
        finish(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => finish(Buffer.concat(chunks)));
    req.on('error', (err) => {
      if (!settled) { settled = true; reject(err); }
    });
  });
}

// A `subscriptions/listen` stream stays open until the client leaves, so shutdown has to end it.
function opensSubscription(body) {
  try {
    const parsed = JSON.parse(body.toString('utf8'));
    return (Array.isArray(parsed) ? parsed : [parsed]).some(message => message?.method === 'subscriptions/listen');
  } catch {
    return false;
  }
}

function toWebHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeHeaders)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  return headers;
}

/**
 * @param {(res: import('express').Response) => void} options.trackStream - registers a response
 *   that only shutdown can end
 */
export function createMcpEndpoint({ tools, trackStream }) {
  const handler = createMcpHandler(createServerFactory(tools, { transport: 'http' }), {
    legacy: 'stateless',
    onerror: err => log.debug('/mcp', { error: err.message })
  });

  return async (req, res) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > MCP_BODY_LIMIT_BYTES) {
      res.setHeader('Connection', 'close');
      return jsonRpcError(res, 413, 'Request body too large');
    }

    let body;
    try {
      body = await readBody(req, MCP_BODY_LIMIT_BYTES);
    } catch (err) {
      log.debug('/mcp request body not read', { error: String(err) });
      return res.destroy();
    }
    if (body === null) {
      res.setHeader('Connection', 'close');
      return jsonRpcError(res, 413, 'Request body too large');
    }

    const cancel = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) cancel.abort();
    });
    if (opensSubscription(body)) trackStream(res);

    let response;
    try {
      response = await handler.fetch(new Request(`http://${req.headers.host}${req.originalUrl}`, {
        method: req.method,
        headers: toWebHeaders(req.headers),
        body: body.length > 0 ? body : undefined,
        signal: cancel.signal
      }));
    } catch (err) {
      log.error('/mcp handler failed', { error: String(err) });
      return res.headersSent ? res.destroy() : jsonRpcError(res, 500, 'Internal server error');
    }

    res.status(response.status);
    response.headers.forEach((value, name) => res.setHeader(name, value));
    if (!response.body) return res.end();

    res.flushHeaders();
    pipeline(Readable.fromWeb(response.body), res, (err) => {
      if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') log.debug('/mcp response stream', { error: String(err) });
    });
  };
}
