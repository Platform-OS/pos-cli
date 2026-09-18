/**
 * Command-line parsing for `pos-cli-mcp` / `pos-cli mcp`, done before the server starts.
 *
 * Strict on purpose: an unknown argument stops the server rather than being ignored (`pos-cli mcp
 * --help` used to start a server that never exited), and a mistyped selection option must not
 * silently expose every tool. Only syntax here; the names are resolved in tool-selection.js.
 */
import { Command, InvalidArgumentError } from 'commander';
import { SHUTDOWN_DEADLINE_MS } from './lifecycle.js';
import { DEFAULT_PROFILE, describeProfiles } from './profiles.js';

// Hanging indent, so a long profile summary stays readable.
const wrap = (text, indent, width = 80) => {
  const lines = [''];
  for (const word of text.split(' ')) {
    const last = lines.length - 1;
    if (lines[last] && indent.length + lines[last].length + 1 + word.length > width) lines.push(word);
    else lines[last] = lines[last] ? `${lines[last]} ${word}` : word;
  }
  return lines.join(`\n${indent}`);
};

const profileHelp = describeProfiles()
  .map(({ name, summary }) => `    ${name.padEnd(5)} ${wrap(summary, ' '.repeat(10))}`)
  .join('\n');

const HELP_AFTER = `
Tool selection:
  Exposed tools are the tools of --profile, plus --include-tools, minus
  --exclude-tools, minus tools disabled in the tools config. --include-tools
  adds to the profile; for an allowlist, use --profile none --include-tools a,b.
  A profile or tool name that does not resolve stops the server.

  Profiles:
${profileHelp}

Transports:
  stdio  MCP over stdin/stdout, for AI tools (Claude Code, Cursor, VS Code).
  HTTP   MCP at /mcp on 127.0.0.1:5910 by default. Unauthenticated: reachable from
         this machine only. --no-http skips it, and MCP_MIN_* is then not read.

The server exits when its MCP client closes stdin, once in-flight tool calls
finish (at most ${SHUTDOWN_DEADLINE_MS / 1000} seconds). To run only the HTTP transport, start it
with stdin from /dev/null: pos-cli-mcp </dev/null

Environment:
  MCP_MIN_PORT            HTTP port (default 5910)
  MCP_MIN_HOST            HTTP bind address (default 127.0.0.1)
  MCP_MIN_ALLOWED_HOSTS   extra hostnames accepted in Host/Origin
  MCP_TOOLS_CONFIG        path to a tools.config.json

Also available as \`pos-cli mcp\`. To see which tools a selection exposes, run
\`pos-cli mcp-config\` with the same options.`;

const profileName = (value, previous) => {
  if (previous !== undefined) throw new InvalidArgumentError('given more than once.');
  if (!value.trim()) throw new InvalidArgumentError('expected a profile name.');
  return value.trim();
};

const toolNames = (value, previous = []) => {
  const names = value.split(',').map(name => name.trim());
  if (names.some(name => name === '')) {
    throw new InvalidArgumentError('expected comma-separated tool names, with no empty entries.');
  }
  return [...previous, ...names];
};

/** Shared by `pos-cli-mcp` and `pos-cli-mcp-config`, so both accept the same spellings. */
export function addToolSelectionOptions(command) {
  return command
    .option('--profile <name>', `starting set of tools (default: ${DEFAULT_PROFILE})`, profileName)
    .option('--include-tools <names>', 'comma-separated tools to add to the profile; repeatable', toolNames)
    .option('--exclude-tools <names>', 'comma-separated tools to remove; repeatable', toolNames);
}

/** The parsed options as the resolver takes them. */
export function selectionFrom(opts) {
  return { profile: opts.profile, include: opts.includeTools ?? [], exclude: opts.excludeTools ?? [] };
}

/**
 * @param {string[]} argv - arguments after the executable, e.g. process.argv.slice(2)
 * @returns {{ start: true, http: boolean, selection: object } | { start: false, exitCode: number }}
 */
export function parseServerArgs(argv, {
  version,
  writeOut = (text) => process.stdout.write(text),
  writeErr = (text) => process.stderr.write(text)
}) {
  const command = addToolSelectionOptions(new Command('pos-cli-mcp')
    .description('Start the platformOS MCP server (stdio + HTTP)')
    .version(version, '-v, --version', 'output the version number'))
    // Not a selection option, so pos-cli-mcp-config does not take it.
    .option('--no-http', 'serve MCP over stdio only: start no HTTP listener')
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
  return { start: true, http: command.opts().http, selection: selectionFrom(command.opts()) };
}
