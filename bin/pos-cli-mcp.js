#!/usr/bin/env node

import logger from '../lib/logger.js';
import { parseServerArgs } from '../mcp-min/cli-args.js';
import pkg from '../package.json' with { type: 'json' };

// Arguments first: importing the server starts both transports, so --help, --version and a
// rejected argument must be settled before that import. Setting exitCode instead of calling
// process.exit() lets help text written to a pipe flush before the process ends.
const parsed = parseServerArgs(process.argv.slice(2), { version: pkg.version });
if (!parsed.start) {
  process.exitCode = parsed.exitCode;
} else {
  await startServer();
}

async function startServer() {
  // Configuration problems the user can fix: tools.config.json (ToolsConfigError) and the
  // HTTP transport's MCP_MIN_* environment variables (HttpConfigError). Anything else is a
  // defect and keeps its stack trace.
  const CONFIG_ERRORS = new Set(['ToolsConfigError', 'HttpConfigError']);

  // The server is loaded dynamically so a configuration problem raised while its module
  // graph evaluates can be reported as a message rather than escaping as a raw Node stack
  // trace, per the error-handling guidance in CLAUDE.md. A static import would evaluate
  // before any statement here could guard it.
  try {
    await import('../mcp-min/index.js');
  } catch (error) {
    if (CONFIG_ERRORS.has(error?.name)) {
      await logger.Error(error.message, { exit: false, notify: false, hideTimestamp: true });
      process.exit(1);
    }
    throw error;
  }
}
