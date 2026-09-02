#!/usr/bin/env node

import logger from '../lib/logger.js';

// The server is loaded dynamically so a configuration problem raised while its module
// graph evaluates can be reported as a message rather than escaping as a raw Node stack
// trace, per the error-handling guidance in CLAUDE.md. A static import would evaluate
// before any statement here could guard it.
try {
  await import('../mcp-min/index.js');
} catch (error) {
  if (error?.name === 'ToolsConfigError') {
    await logger.Error(error.message, { exit: false, hideTimestamp: true });
    process.exit(1);
  }
  throw error;
}
