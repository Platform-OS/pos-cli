/**
 * Exposed-tool maps for tests that start a transport in-process.
 *
 * Not a test file (no .test suffix), so vitest does not collect it.
 */
import { selectTools } from '../../tool-selection.js';

/** What a bare `pos-cli-mcp` exposes: the full profile under the bundled tools config, whatever MCP_TOOLS_CONFIG says. */
export function defaultTools() {
  return selectTools({ env: {} }).tools;
}

/** The default tools plus test-only ones, e.g. `{ 'test-slow': { handler, inputSchema } }`. */
export function toolsWith(extra) {
  return new Map([...defaultTools(), ...Object.entries(extra)]);
}
