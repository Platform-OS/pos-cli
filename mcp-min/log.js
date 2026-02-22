// Unified logging for mcp-min
// - Never writes to stdout (safe for stdio JSON-RPC transport)
// - Writes to file + stderr
// - debug() gated on DEBUG/MCP_MIN_DEBUG flags
import { mkdirSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { DEBUG } from './config.js';

const LOG_DIR = path.join(homedir(), '.pos-cli', 'logs');
const LOG_FILE = process.env.MCP_MIN_LOG_FILE || path.join(LOG_DIR, 'mcp-min.log');

let logReady = false;

function init() {
  if (logReady) return;
  try {
    mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    logReady = true;
  } catch {
    // ignore - logging is best-effort
  }
}

function write(level, message, data) {
  const ts = new Date().toISOString();
  const suffix = data !== undefined ? ` ${JSON.stringify(data)}` : '';
  const line = `[${level} ${ts}] ${message}${suffix}\n`;

  // Always write to stderr (never stdout)
  try {
    process.stderr.write(line);
  } catch {
    // best-effort
  }

  // Write to log file
  init();
  if (logReady) {
    try {
      appendFileSync(LOG_FILE, line);
    } catch {
      // best-effort
    }
  }
}

const log = {
  debug(message, data) {
    if (DEBUG) write('DEBUG', message, data);
  },
  info(message, data) {
    write('INFO', message, data);
  },
  warn(message, data) {
    write('WARN', message, data);
  },
  error(message, data) {
    write('ERROR', message, data);
  },
  LOG_FILE
};

export default log;
