import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { mkdirSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import tools from './tools.js';
import { DEBUG } from './config.js';

// MCP stdio server implementing JSON-RPC 2.0 protocol
// Supports: initialize, notifications/initialized, tools/list, tools/call

// File logging setup
// Default: ~/.pos-cli/logs/stdio-server.log
// Custom: set MCP_STDIO_LOG env variable
const DEFAULT_LOG_DIR = path.join(homedir(), '.pos-cli', 'logs');
const DEFAULT_LOG_FILE = path.join(DEFAULT_LOG_DIR, 'stdio-server.log');
const LOG_FILE = process.env.MCP_STDIO_LOG || DEFAULT_LOG_FILE;

let logInitialized = false;

function initLog() {
  if (logInitialized) return;
  try {
    const logDir = path.dirname(LOG_FILE);
    mkdirSync(logDir, { recursive: true });
    logInitialized = true;
  } catch (err) {
    // Silently ignore if we can't create log directory
  }
}

function log(message, data) {
  initLog();
  if (!logInitialized) return;
  try {
    const ts = new Date().toISOString();
    const line = data !== undefined
      ? `[${ts}] ${message} ${JSON.stringify(data)}\n`
      : `[${ts}] ${message}\n`;
    appendFileSync(LOG_FILE, line);
  } catch (err) {
    // Silently ignore logging errors
  }
}

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

const SERVER_INFO = {
  name: 'pos-cli-mcp',
  version: '0.1.0'
};

const SERVER_CAPABILITIES = {
  tools: {}
};

function send(obj) {
  const line = JSON.stringify(obj);
  process.stdout.write(line + '\n');
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
    DEBUG && log('MCP initialize', { params });
    sendResult(id, {
      protocolVersion: '2024-11-05',
      serverInfo: SERVER_INFO,
      capabilities: SERVER_CAPABILITIES
    });
  },

  'notifications/initialized': async () => {
    // Notification - no response needed
    DEBUG && log('MCP initialized notification received');
  },

  'tools/list': async (params, id) => {
    DEBUG && log('MCP tools/list');
    sendResult(id, { tools: getToolsList() });
  },

  'tools/call': async (params, id) => {
    const { name, arguments: args } = params || {};
    DEBUG && log('MCP tools/call', { name, args });

    const tool = tools[name];
    if (!tool) {
      sendError(id, -32601, `Unknown tool: ${name}`);
      return;
    }

    try {
      const result = await tool.handler(args || {}, { transport: 'stdio', debug: DEBUG, log });
      sendResult(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      });
    } catch (err) {
      sendError(id, -32000, String(err));
    }
  }
};

export default function startStdio() {
  log('stdio transport started (MCP protocol)');

  rl.on('line', async (line) => {
    const raw = line;
    line = line.trim();
    if (!line) return;

    let msg;
    try {
      msg = JSON.parse(line);
    } catch (e) {
      DEBUG && log('STDIO received invalid JSON', { raw });
      sendError(null, -32700, 'Parse error');
      return;
    }

    const { jsonrpc, id, method, params } = msg;
    DEBUG && log('STDIO request', { id, method, params });

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
        const result = await tool.handler(params || {}, { transport: 'stdio', debug: DEBUG, log });
        if (jsonrpc === '2.0') {
          sendResult(id, result);
        } else {
          send({ id, result });
        }
        DEBUG && log('STDIO response', { id, method, result });
      } catch (err) {
        if (jsonrpc === '2.0') {
          sendError(id, -32000, String(err));
        } else {
          send({ id, error: String(err) });
        }
        DEBUG && log('STDIO error', { id, method, err: String(err) });
      }
      return;
    }

    // Unknown method
    if (jsonrpc === '2.0') {
      sendError(id, -32601, `Method not found: ${method}`);
    } else {
      send({ id, error: `unknown_method: ${method}` });
    }
    DEBUG && log('STDIO unknown method', { id, method });
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
    log(`working directory set to ${process.cwd()}`);
  }
  log(`log file: ${LOG_FILE}`);
  startStdio();
}
