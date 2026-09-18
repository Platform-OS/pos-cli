// Unified logging for mcp-min
// - Never writes to stdout (safe for stdio JSON-RPC transport)
// - Writes to file + stderr
// - debug() gated on DEBUG/MCP_MIN_DEBUG flags
// - Every line goes through redact.js first: the file outlives the session, and DEBUG=1 is what
//   people turn on precisely when credentials are moving through the server
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

// Owner-only, because the file records which instances this machine talks to and, historically,
// the credentials it used. `appendFileSync`'s mode applies only when it creates the file, so a
// file that is already there is tightened once, at startup — one recreated later (logrotate, an
// older pos-cli) is not. `restrictToOwner` is best effort by design and says so; there is nothing
// better to do about a filesystem that ignores modes than to keep logging.
function init() {
  if (initAttempted) return;
  initAttempted = true;
  try {
    mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    logReady = true;
    // Only an existing file: a new one is created owner-only below, and chmod on a path that is
    // not there yet would warn on every fresh install.
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
  // Including the message: `String(x)` throws for an object with a null prototype, and tool
  // handlers are handed this as `ctx.log`.
  let line;
  try {
    const suffix = data !== undefined ? ` ${serialise(data)}` : '';
    line = `[${level} ${ts}] ${scrubString(String(message))}${suffix}\n`;
  } catch {
    line = `[${level} ${ts}] [unloggable message]\n`;
  }

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
