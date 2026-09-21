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
import { runTool } from '../run-tool.js';
import { ToolError } from '../tool-error.js';
import { buildInstructions } from '../instructions.js';
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

/**
 * A failure decided before the handler ran. Built through `ToolError` so that it carries a `kind`
 * like every other failure does: the server instructions promise one on every error, and a
 * rejection that arrived without it was the one result a client could not read the same way.
 */
export function toolError(kind, code, message, details) {
  return {
    content: [{ type: 'text', text: text({ ok: false, error: new ToolError(kind, code, message, details).toResult() }) }],
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
 *
 * A tool reports with one named object, the shape the notification itself has. Three positional
 * arguments, two of them optional, was read as an object at one call site: `Math.max` turned it
 * into NaN, JSON wrote that as `null`, and the counter kept it, so every later report for that
 * call was `null` too. A bad value now throws where the tool wrote it, as `ToolError` does for a
 * bad kind — only this repo's own modules call this.
 */
function progressReporter(ctx) {
  const progressToken = ctx.mcpReq._meta?.progressToken;
  let last = 0;

  // Takes a checked progress, so the heartbeat cannot throw from inside its interval.
  const emit = (progress, total, message) => {
    if (ctx.mcpReq.signal.aborted) return;
    last = Math.max(progress, last + 1);
    const params = { progressToken, progress: last };
    if (total !== undefined) params.total = total;
    if (message) params.message = message;
    ctx.mcpReq.notify({ method: 'notifications/progress', params })
      .catch(err => log.debug('progress notification not sent', { error: String(err) }));
  };

  // Checked even with no token, so misuse surfaces on the first client rather than on the first
  // one that happens to ask for progress.
  const send = (report) => {
    const { progress, total, message } = Object(report);
    if (!Number.isFinite(progress)) throw new TypeError(`sendProgress: progress must be a finite number, not ${typeof progress}`);
    if (total !== undefined && !Number.isFinite(total)) throw new TypeError(`sendProgress: total must be a finite number, not ${typeof total}`);
    if (progressToken !== undefined) emit(progress, total, message);
  };

  if (progressToken === undefined) return { send, stop: () => {} };

  const heartbeat = setInterval(() => emit(last + 1, undefined, 'working'), HEARTBEAT_MS);
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
        ? toolError('input', 'INVALID_PARAMS', `Invalid params: ${rejection.message}`, rejection.errors)
        : toolError('internal', 'SCHEMA_ERROR', rejection.message, rejection.errors);
    }

    const progress = progressReporter(ctx);
    try {
      // runTool owns the envelope and turns anything thrown into a classified error, so there is
      // nothing left to catch here: a handler cannot reach this frame with an exception.
      const result = await runTool(tool, args, {
        toolName: name,
        transport,
        debug: DEBUG,
        log: log.info.bind(log),
        sendProgress: progress.send,
        // Aborted when the client cancels or goes away; the SDK then sends nothing, whatever the
        // tool returns.
        signal: ctx.mcpReq.signal
      });
      if (result.ok === false) log.debug('tool failed', { tool: name, kind: result.error.kind, code: result.error.code });
      return toolResult(result);
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

  // Built once: the selection is fixed for the process, so every connection is told the same
  // thing. The SDK returns it on `initialize` and on `server/discover`, and omits the field for an
  // empty string — which is the right answer for a selection no section applies to.
  const instructions = buildInstructions(tools);

  return () => {
    const server = new McpServer({ ...SERVER_INFO }, { capabilities: { tools: {} }, instructions });
    for (const [name, tool] of tools) registerTool(server, name, tool, transport);
    return server;
  };
}
