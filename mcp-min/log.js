// Logging for mcp-min: stderr and a file, never stdout (the stdio JSON-RPC channel). Every line
// goes through redact.js first — the file outlives the session, and DEBUG=1 is what people turn on
// precisely when credentials are moving through the server.
import { mkdirSync, appendFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { DEBUG } from './config.js';
import { redact, scrubString } from './redact.js';
import { OWNER_ONLY, restrictToOwner } from '../lib/filePermissions.js';

const LOG_DIR = path.join(homedir(), '.pos-cli', 'logs');
const LOG_FILE = process.env.MCP_MIN_LOG_FILE || path.join(LOG_DIR, 'mcp-min.log');

let logReady = false;
let initAttempted = false;

// Owner-only: the file records which instances this machine talks to and, historically, the
// credentials it used. `appendFileSync`'s mode applies only on creation, so a file already there
// is tightened once, at startup; one recreated later (logrotate) is not.
function init() {
  if (initAttempted) return;
  initAttempted = true;
  try {
    mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    logReady = true;
    // Only an existing file: chmod on a path that is not there yet would warn on every fresh
    // install, and a new file is created owner-only below.
    if (existsSync(LOG_FILE)) restrictToOwner(LOG_FILE);
  } catch {
    // ignore - logging is best-effort
  }
}

/** Never let a log line become the thing that fails a request. */
function serialise(data) {
  try {
    return JSON.stringify(redact(data));
  } catch {
    return '"[unserialisable]"';
  }
}

function write(level, message, data) {
  const ts = new Date().toISOString();
  // The message too: `String(x)` throws for an object with a null prototype, and tool handlers are
  // handed this as `ctx.log`.
  let line;
  try {
    const suffix = data !== undefined ? ` ${serialise(data)}` : '';
    line = `[${level} ${ts}] ${scrubString(String(message))}${suffix}\n`;
  } catch {
    line = `[${level} ${ts}] [unloggable message]\n`;
  }

  try {
    process.stderr.write(line);
  } catch {
    // best-effort
  }

  init();
  if (logReady) {
    try {
      appendFileSync(LOG_FILE, line, { mode: OWNER_ONLY });
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
