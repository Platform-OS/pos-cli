// Exposed-tool maps for tests that start a transport in-process.
import { selectTools } from '../../tool-selection.js';

/** What a bare `pos-cli-mcp` exposes, whatever MCP_TOOLS_CONFIG says. */
export function defaultTools() {
  return selectTools({ env: {} }).tools;
}

/** The default tools plus test-only ones, e.g. `{ 'test-slow': { handler, inputSchema } }`. */
export function toolsWith(extra) {
  return new Map([...defaultTools(), ...Object.entries(extra)]);
}
