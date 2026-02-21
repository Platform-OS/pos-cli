// Centralized config for mcp-min
export const DEBUG = !!(
  process.env.DEBUG && process.env.DEBUG !== '0' && process.env.DEBUG.toLowerCase?.() !== 'false'
) || !!(
  process.env.MCP_MIN_DEBUG && process.env.MCP_MIN_DEBUG !== '0' && process.env.MCP_MIN_DEBUG.toLowerCase?.() !== 'false'
);

