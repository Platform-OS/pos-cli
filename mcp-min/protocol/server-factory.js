/**
 * The MCP protocol layer: one McpServer definition (SDK v2) serving both the stdio transport and
 * the HTTP `/mcp` endpoint, for 2026-07-28 clients and the 2025 revisions.
 *
 * The SDK owns the protocol; the tools stay plain modules with a JSON Schema and a handler
 * returning `{ ok, ... }`. This is the one place that adapts one to the other.
 */
import { McpServer, fromJsonSchema } from '@modelcontextprotocol/server';
import pkg from '../../package.json' with { type: 'json' };
import { rejectionFor, schemaCompileError } from '../validate-params.js';
import { OPEN_OBJECT_SCHEMA } from '../schemas/default.js';
import { DEBUG } from '../config.js';
import log from '../log.js';

export const SERVER_INFO = Object.freeze({ name: 'pos-cli-mcp', version: pkg.version });

// While a call with a progress token runs, a progress notification goes out this often, so a
// client that times out idle calls does not give up on a deploy or a test run.
export const HEARTBEAT_MS = 5000;

// The SDK would check arguments with the validator it is given. Enforcement happens in the
// callback below instead, through `rejectionFor`, so every transport rejects on the same terms and
// against the very schema published. This validator only lets the SDK publish the schema; it must
// never be the thing that checks arguments.
const PUBLISH_ONLY = Object.freeze({
  getValidator: () => input => ({ valid: true, data: input, errorMessage: undefined })
});

const text = value => JSON.stringify(value, null, 2);

/** A tool execution error: the call reached the tool layer and failed there. */
export function toolError(code, message, details) {
  return {
    content: [{ type: 'text', text: text({ ok: false, error: { code, message, ...(details && { details }) } }) }],
    isError: true
  };
}

function toolResult(result) {
  // `{ ok: false }` is how every tool reports a failure; the protocol calls that isError.
  return result?.ok === false
    ? { content: [{ type: 'text', text: text(result) }], isError: true }
    : { content: [{ type: 'text', text: text(result) }] };
}

/**
 * Progress for one call: only when the client asked for it, and always increasing, as the protocol
 * requires — the heartbeat and a tool's own reports share one counter.
 */
function progressReporter(ctx) {
  const progressToken = ctx.mcpReq._meta?.progressToken;
  let last = 0;

  const send = (progress, total, message) => {
    if (progressToken === undefined || ctx.mcpReq.signal.aborted) return;
    last = Math.max(progress, last + 1);
    const params = { progressToken, progress: last };
    if (total != null) params.total = total;
    if (message) params.message = message;
    ctx.mcpReq.notify({ method: 'notifications/progress', params })
      .catch(err => log.debug('progress notification not sent', { error: String(err) }));
  };

  if (progressToken === undefined) return { send, stop: () => {} };

  const heartbeat = setInterval(() => send(last + 1, undefined, 'working'), HEARTBEAT_MS);
  const stop = () => clearInterval(heartbeat);
  // The call finishing stops it (the handler's finally); so does the client going away. unref in
  // case of a tool that watches neither, which would otherwise hold the event loop open.
  heartbeat.unref?.();
  ctx.mcpReq.signal.addEventListener('abort', stop, { once: true });
  return { send, stop };
}

function registerTool(server, name, tool, transport) {
  const config = {
    description: tool.description || '',
    inputSchema: fromJsonSchema(tool.inputSchema || OPEN_OBJECT_SCHEMA, PUBLISH_ONLY)
  };
  if (tool.annotations) config.annotations = tool.annotations;

  server.registerTool(name, config, async (args, ctx) => {
    const rejection = rejectionFor(name, tool, args);
    if (rejection) {
      // Unreachable for a schema error: createServerFactory refuses to start with one.
      return rejection.jsonRpcCode === -32602
        ? toolError('INVALID_PARAMS', `Invalid params: ${rejection.message}`, rejection.errors)
        : toolError('SCHEMA_ERROR', rejection.message, rejection.errors);
    }

    const progress = progressReporter(ctx);
    try {
      const result = await tool.handler(args ?? {}, {
        transport,
        debug: DEBUG,
        log: log.info.bind(log),
        sendProgress: progress.send,
        // Aborted when the client cancels or goes away; the SDK then sends nothing, whatever the
        // tool returns.
        signal: ctx.mcpReq.signal
      });
      return toolResult(result);
    } catch (err) {
      log.debug('tool threw', { tool: name, error: String(err) });
      return toolError('INTERNAL_ERROR', err instanceof Error ? err.message : String(err));
    } finally {
      progress.stop();
    }
  });
}

/**
 * Builds the factory both transports serve from, checking up front that every exposed tool's
 * schema compiles: the SDK builds `tools/list` from them, so one it cannot use fails the list for
 * every tool, and startup is the only honest place to report our own defect.
 *
 * @param {Map<string, object>} tools - the exposed tools, in the order clients see them
 * @param {'stdio'|'http'} options.transport - passed to tool handlers as ctx.transport
 */
export function createServerFactory(tools, { transport }) {
  if (!(tools instanceof Map)) throw new TypeError('createServerFactory: tools must be the Map of exposed tools');

  const uncompilable = [...tools]
    .map(([name, tool]) => [name, schemaCompileError(tool)])
    .filter(([, error]) => error !== null)
    .map(([name, error]) => `${name} (${error})`);
  if (uncompilable.length > 0) {
    throw new Error(`Tool input schemas that do not compile: ${uncompilable.join('; ')}`);
  }

  return () => {
    const server = new McpServer({ ...SERVER_INFO }, { capabilities: { tools: {} } });
    for (const [name, tool] of tools) registerTool(server, name, tool, transport);
    return server;
  };
}
