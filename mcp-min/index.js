import startStdio from './stdio-server.js';
import startHttp from './http-server.js';
import { DEBUG, debugLog } from './config.js';

const PORT = process.env.MCP_MIN_PORT || 5910;

async function main() {
  console.log('mcp-min: starting MCP minimal server...');
  DEBUG && debugLog('Debug mode enabled');

  // Start stdio transport (MCP over stdio)
  startStdio();

  // Start HTTP server (includes SSE streaming endpoint)
  await startHttp({ port: PORT });

  console.log(`mcp-min: HTTP server listening on http://localhost:${PORT}`);
}

main().catch(err => {
  console.error('Fatal error during startup', err);
  process.exit(1);
});
