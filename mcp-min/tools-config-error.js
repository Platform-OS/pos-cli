/**
 * Raised when mcp-min/tools.config.json (or MCP_TOOLS_CONFIG) is present but invalid.
 *
 * A distinct type so the CLI boundary in bin/pos-cli-mcp.js can tell a user-fixable
 * configuration problem from an internal crash, and report it through the logger instead
 * of letting a module-loader stack trace reach the terminal.
 */
class ToolsConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ToolsConfigError';
  }
}

export { ToolsConfigError };
export default ToolsConfigError;
