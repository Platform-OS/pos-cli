import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';
import tools from './tools.js';
import { DEBUG } from './config.js';
import log from './log.js';

// MCP stdio server implementing JSON-RPC 2.0 protocol
// Supports: initialize, notifications/initialized, tools/list, tools/call

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

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
function getToolsList() {
  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description || '',
    inputSchema: tool.inputSchema || { type: 'object', properties: {} }
  }));
}

// MCP protocol handlers
const mcpHandlers = {
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
    sendResult(id, { tools: getToolsList() });
  },

  'tools/call': async (params, id) => {
    const { name, arguments: args, _meta } = params || {};
    const progressToken = _meta?.progressToken;
    log.debug('MCP tools/call', { name, args, progressToken });

    const tool = tools[name];
    if (!tool) {
      sendError(id, -32601, `Unknown tool: ${name}`);
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
};

export default function startStdio() {
  log.info('stdio transport started (MCP protocol)');

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

    // Handle MCP protocol methods
    const mcpHandler = mcpHandlers[method];
    if (mcpHandler) {
      await mcpHandler(params, id);
      return;
    }

    // Fallback: direct tool invocation (legacy/custom protocol)
    const tool = tools[method];
    if (tool) {
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
  startStdio();
}
