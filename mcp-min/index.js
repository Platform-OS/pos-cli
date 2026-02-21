import startStdio from './stdio-server.js';
import startHttp from './http-server.js';
import log from './log.js';

const PORT = process.env.MCP_MIN_PORT || 5910;

// Global handlers - exit cleanly on EPIPE (client disconnected)
process.on('uncaughtException', (err) => {
  if (err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED') {
    log.debug('Pipe closed, exiting');
    process.exit(0);
  }
  log.error('Uncaught exception', err.message);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection', String(reason));
});

async function main() {
  log.info('mcp-min: starting MCP minimal server...');

  // Start stdio transport (MCP over stdio)
  startStdio();

  // Start HTTP server (includes SSE streaming endpoint)
  await startHttp({ port: PORT });

  log.info(`mcp-min: HTTP server listening on http://localhost:${PORT}`);
}

main().catch(err => {
  log.error('Fatal error during startup', String(err));
  process.exit(1);
});
