#!/usr/bin/env node

import logger from '../lib/logger.js';
import { parseServerArgs } from '../mcp-min/cli-args.js';
import pkg from '../package.json' with { type: 'json' };

// Arguments first, then the tool selection, then the transports: --help, --version, a rejected
// argument and a selection that does not resolve must all be settled before anything listens.
// Setting exitCode instead of calling process.exit() lets help text written to a pipe flush
// before the process ends.
const parsed = parseServerArgs(process.argv.slice(2), { version: pkg.version });
if (!parsed.start) {
  process.exitCode = parsed.exitCode;
} else {
  await startServer(parsed.selection);
}

async function startServer(options) {
  // Configuration problems the user can fix: the tool selection and tools.config.json
  // (ToolsConfigError) and the HTTP transport's MCP_MIN_* environment variables
  // (HttpConfigError). Anything else is a defect and keeps its stack trace.
  const CONFIG_ERRORS = new Set(['ToolsConfigError', 'HttpConfigError']);

  // Loaded dynamically so that a configuration problem raised while the tool modules load or
  // the selection resolves is reported as a message rather than escaping as a raw Node stack
  // trace, per the error-handling guidance in CLAUDE.md.
  try {
    const { selectTools } = await import('../mcp-min/tool-selection.js');
    const selection = selectTools(options);
    const { start } = await import('../mcp-min/index.js');
    await start({ selection });
  } catch (error) {
    if (CONFIG_ERRORS.has(error?.name)) {
      await logger.Error(error.message, { exit: false, notify: false, hideTimestamp: true });
      process.exit(1);
    }
    throw error;
  }
}
