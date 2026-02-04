// Centralized config for mcp-min
export const DEBUG = !!process.env.MCP_MIN_DEBUG && process.env.MCP_MIN_DEBUG !== '0' && process.env.MCP_MIN_DEBUG.toLowerCase?.() !== 'false';

export function debugLog(...args) {
  if (DEBUG) {
    const ts = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.log(`[DEBUG ${ts}]`, ...args);
  }
}
