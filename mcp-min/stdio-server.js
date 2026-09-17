import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';
import { findTool, selectTools, describeSelection } from './tool-selection.js';
import { rejectionFor } from './validate-params.js';
import { OPEN_OBJECT_SCHEMA } from './schemas/default.js';
import { DEBUG } from './config.js';
import { createShutdown, stdinEndEndsSession } from './lifecycle.js';
import log from './log.js';

// MCP stdio server implementing JSON-RPC 2.0 protocol
// Supports: initialize, notifications/initialized, tools/list, tools/call

const SERVER_INFO = {
  name: 'pos-cli-mcp',
  version: '0.1.0'
};

const SERVER_CAPABILITIES = {
  tools: {}
};

function send(obj) {
  if (!process.stdout.writable) return;
  const line = JSON.stringify(obj);
  try {
    process.stdout.write(line + '\n');
  } catch (err) {
    if (err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED') {
      log.debug('stdout closed, exiting');
      process.exit(0);
    }
    throw err;
  }
}

function sendResult(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  send({ jsonrpc: '2.0', id, error });
}

// Build tools list for MCP tools/list response
function getToolsList(tools) {
  return [...tools].map(([name, tool]) => ({
    name,
    description: tool.description || '',
    inputSchema: tool.inputSchema || OPEN_OBJECT_SCHEMA
  }));
}

// MCP protocol handlers
const mcpHandlersFor = (tools) => ({
  'initialize': async (params, id) => {
    log.debug('MCP initialize', { params });
    sendResult(id, {
      protocolVersion: '2024-11-05',
      serverInfo: SERVER_INFO,
      capabilities: SERVER_CAPABILITIES
    });
  },

  'notifications/initialized': async () => {
    // Notification - no response needed
    log.debug('MCP initialized notification received');
  },

  'tools/list': async (params, id) => {
    log.debug('MCP tools/list');
    sendResult(id, { tools: getToolsList(tools) });
  },

  'tools/call': async (params, id) => {
    const { name, arguments: args, _meta } = params || {};
    const progressToken = _meta?.progressToken;
    log.debug('MCP tools/call', { name, args, progressToken });

    const tool = findTool(tools, name);
    if (!tool) {
      sendError(id, -32601, `Unknown tool: ${name}`);
      return;
    }

    const rejection = rejectionFor(name, tool, args);
    if (rejection) {
      sendError(id, rejection.jsonRpcCode, `Invalid params: ${rejection.message}`, { errors: rejection.errors });
      return;
    }

    // Send progress notification (keeps connection alive, prevents client timeout)
    let progressCounter = 0;
    function sendProgress(current, total, message) {
      if (!progressToken) return;
      const notification = {
        jsonrpc: '2.0',
        method: 'notifications/progress',
        params: { progressToken, progress: current }
      };
      if (total != null) notification.params.total = total;
      if (message) notification.params.message = message;
      send(notification);
    }

    // Heartbeat: send periodic progress while tool runs to prevent timeout
    const heartbeat = progressToken
      ? setInterval(() => { sendProgress(++progressCounter, undefined, 'working'); }, 5000)
      : null;

    try {
      const result = await tool.handler(args || {}, {
        transport: 'stdio',
        debug: DEBUG,
        log: log.info.bind(log),
        sendProgress
      });
      sendResult(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      });
    } catch (err) {
      sendError(id, -32000, String(err));
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
  }
});

/**
 * @param {object} options
 * @param {Map<string, object>} options.tools - the exposed tools (selectTools().tools); no
 *   default, so a caller cannot end up serving every tool by leaving it out
 * @param {ReturnType<typeof createShutdown>} [options.shutdown] - shared with the other
 *   transports so that the client closing stdin stops all of them; a server started on its
 *   own gets one that only has stdio to stop
 */
export default function startStdio({ tools, shutdown = createShutdown() } = {}) {
  if (!(tools instanceof Map)) throw new TypeError('startStdio: tools must be the Map of exposed tools');
  const mcpHandlers = mcpHandlersFor(tools);
  log.info('stdio transport started (MCP protocol)');

  // Created here, not at import: reading stdin before the close listener below is attached
  // could let a client's early EOF go unnoticed.
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  let messagesReceived = 0;
  rl.on('close', () => {
    if (stdinEndEndsSession(process.stdin, messagesReceived)) {
      shutdown.begin('stdin closed by the MCP client');
    } else {
      log.info('mcp-min: stdin closed before any message and is not a client pipe; other transports keep running');
    }
  });

  // Exit cleanly when the MCP client disconnects (closes the pipe)
  process.stdout.on('error', (err) => {
    if (err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED') {
      log.debug('stdout pipe closed, exiting');
      process.exit(0);
    }
    log.error('stdout error', err.message);
  });

  rl.on('line', async (line) => {
    const raw = line;
    line = line.trim();
    if (!line) return;
    messagesReceived++;

    let msg;
    try {
      msg = JSON.parse(line);
    } catch (e) {
      log.debug('STDIO received invalid JSON', { raw });
      sendError(null, -32700, 'Parse error');
      return;
    }

    const { jsonrpc, id, method, params } = msg;
    log.debug('STDIO request', { id, method, params });

    // Handle MCP protocol methods. Own properties only: a method named `toString` or
    // `constructor` would otherwise run the Object.prototype function and answer nothing.
    const mcpHandler = typeof method === 'string' && Object.hasOwn(mcpHandlers, method) ? mcpHandlers[method] : undefined;
    if (mcpHandler) {
      await mcpHandler(params, id);
      return;
    }

    // Fallback: direct tool invocation (legacy/custom protocol)
    const tool = findTool(tools, method);
    if (tool) {
      const rejection = rejectionFor(method, tool, params);
      if (rejection) {
        const message = `Invalid params: ${rejection.message}`;
        if (jsonrpc === '2.0') {
          sendError(id, rejection.jsonRpcCode, message, { errors: rejection.errors });
        } else {
          send({ id, error: message });
        }
        log.debug('STDIO invalid params', { id, method, message });
        return;
      }

      try {
        const result = await tool.handler(params || {}, { transport: 'stdio', debug: DEBUG, log: log.info.bind(log) });
        if (jsonrpc === '2.0') {
          sendResult(id, result);
        } else {
          send({ id, result });
        }
        log.debug('STDIO response', { id, method, result });
      } catch (err) {
        if (jsonrpc === '2.0') {
          sendError(id, -32000, String(err));
        } else {
          send({ id, error: String(err) });
        }
        log.debug('STDIO error', { id, method, err: String(err) });
      }
      return;
    }

    // Unknown method
    if (jsonrpc === '2.0') {
      sendError(id, -32601, `Method not found: ${method}`);
    } else {
      send({ id, error: `unknown_method: ${method}` });
    }
    log.debug('STDIO unknown method', { id, method });
  });
}

// Parse --cwd or -C argument
function parseCwd(argv) {
  for (let i = 2; i < argv.length; i++) {
    if ((argv[i] === '--cwd' || argv[i] === '-C') && argv[i + 1]) {
      return argv[i + 1];
    }
    if (argv[i].startsWith('--cwd=')) {
      return argv[i].slice(6);
    }
  }
  return null;
}

// Auto-start when executed directly (node mcp-min/stdio-server.js)
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const cwd = parseCwd(process.argv);
  if (cwd) {
    process.chdir(path.resolve(cwd));
    log.info(`working directory set to ${process.cwd()}`);
  }
  log.info(`log file: ${log.LOG_FILE}`);
  let selection;
  try {
    selection = selectTools();
  } catch (err) {
    if (err?.name !== 'ToolsConfigError') throw err;
    log.error(err.message);
    process.exit(1);
  }
  log.info(describeSelection(selection));
  startStdio({ tools: selection.tools });
}
