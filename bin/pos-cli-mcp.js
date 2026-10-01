#!/usr/bin/env node

import logger from '../lib/logger.js';
import { parseServerArgs } from '../mcp-min/cli-args.js';
import pkg from '../package.json' with { type: 'json' };

// Arguments first, then the tool selection, then the transports: --help, --version and a rejected
// argument must all be settled before anything listens. exitCode rather than process.exit(), so
// help text written to a pipe flushes before the process ends.
const parsed = parseServerArgs(process.argv.slice(2), { version: pkg.version });
if (!parsed.start) {
  process.exitCode = parsed.exitCode;
} else {
  await startServer(parsed);
}

async function startServer({ selection: requested, http }) {
  // Configuration problems the user can fix; anything else is a defect and keeps its stack trace.
  const CONFIG_ERRORS = new Set(['ToolsConfigError', 'HttpConfigError']);

  // Loaded dynamically so a configuration problem raised while the tool modules load reaches the
  // catch below, rather than escaping as a raw Node stack trace.
  try {
    const { selectTools } = await import('../mcp-min/tool-selection.js');
    const selection = selectTools(requested);
    const { start } = await import('../mcp-min/index.js');
    await start({ selection, http });
  } catch (error) {
    if (CONFIG_ERRORS.has(error?.name)) {
      await logger.Error(error.message, { exit: false, notify: false, hideTimestamp: true });
      process.exit(1);
    }
    throw error;
  }
}
