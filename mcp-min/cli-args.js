/**
 * Command-line parsing for `pos-cli-mcp` / `pos-cli mcp`, done before the server module is
 * imported, because importing it starts both transports.
 *
 * Strict on purpose. An argument the server does not understand stops it with a message
 * instead of being ignored: `pos-cli mcp --help` and `pos-cli help mcp` used to start a
 * server that never exited, and the options this parser will grow (tool profiles) decide
 * which tools are exposed, so a mistyped one must not silently expose all of them — the same
 * reasoning as the fail-closed tools config.
 */
import { Command } from 'commander';
import { SHUTDOWN_DEADLINE_MS } from './lifecycle.js';

const HELP_AFTER = `
Transports:
  stdio  MCP over stdin/stdout, for AI tools (Claude Code, Cursor, VS Code).
  HTTP   127.0.0.1:5910 by default. Unauthenticated: reachable from this machine only.

The server exits when its MCP client closes stdin, once in-flight tool calls
finish (at most ${SHUTDOWN_DEADLINE_MS / 1000} seconds). To run only the HTTP transport, start it
with stdin from /dev/null: pos-cli-mcp </dev/null

Environment:
  MCP_MIN_PORT            HTTP port (default 5910)
  MCP_MIN_HOST            HTTP bind address (default 127.0.0.1)
  MCP_MIN_ALLOWED_HOSTS   extra hostnames accepted in Host/Origin
  MCP_TOOLS_CONFIG        path to a tools.config.json

Also available as \`pos-cli mcp\`. To see which tools are enabled, run \`pos-cli mcp-config\`.`;

/**
 * @param {string[]} argv - arguments after the executable, e.g. process.argv.slice(2)
 * @param {object} options
 * @param {string} options.version - printed by -v/--version
 * @param {(text: string) => void} [options.writeOut] - help and version
 * @param {(text: string) => void} [options.writeErr] - errors
 * @returns {{ start: true } | { start: false, exitCode: number }}
 */
export function parseServerArgs(argv, {
  version,
  writeOut = (text) => process.stdout.write(text),
  writeErr = (text) => process.stderr.write(text)
}) {
  const command = new Command('pos-cli-mcp')
    .description('Start the platformOS MCP server (stdio + HTTP)')
    .version(version, '-v, --version', 'output the version number')
    .allowExcessArguments(false)
    .allowUnknownOption(false)
    .addHelpText('after', HELP_AFTER)
    .exitOverride()
    .configureOutput({
      writeOut,
      writeErr,
      outputError: (message, write) => {
        let text = message.trimEnd();
        // `pos-cli mcp config` is the natural guess for `pos-cli mcp-config`.
        if (text.includes('too many arguments') && argv.includes('config')) {
          text += '\nTo display the MCP tool configuration, run `pos-cli mcp-config`.';
        }
        write(`${text}\nRun \`pos-cli-mcp --help\` for usage information.\n`);
      }
    });

  try {
    command.parse(argv, { from: 'user' });
  } catch (err) {
    // --help and --version end here too, with exit code 0.
    if (typeof err?.exitCode === 'number' && typeof err.code === 'string' && err.code.startsWith('commander.')) {
      return { start: false, exitCode: err.exitCode };
    }
    throw err;
  }
  return { start: true };
}
