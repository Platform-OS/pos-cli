import { fileURLToPath } from 'url';
import path from 'path';
import { PassThrough } from 'stream';
import { serveStdio, StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { selectTools, describeSelection } from './tool-selection.js';
import { createServerFactory } from './protocol/server-factory.js';
import { createShutdown, stdinEndEndsSession } from './lifecycle.js';
import log from './log.js';

// MCP over stdio, served by the MCP TypeScript SDK: a client opening with `server/discover`
// speaks 2026-07-28, one opening with `initialize` gets the 2025 revision it asks for.

/**
 * @param {Map<string, object>} options.tools - the exposed tools; no default, so a caller cannot
 *   serve every tool by leaving it out
 * @param {ReturnType<typeof createShutdown>} [options.shutdown] - shared with the other transports,
 *   so the client closing stdin stops all of them
 */
export default function startStdio({ tools, shutdown = createShutdown() } = {}) {
  if (!(tools instanceof Map)) throw new TypeError('startStdio: tools must be the Map of exposed tools');
  const factory = createServerFactory(tools, { transport: 'stdio' });
  log.info('stdio transport started (MCP protocol)');

  const stdin = process.stdin;

  // Since SDK 2.1.0 the stdio transport closes itself at stdin EOF and aborts the calls still
  // running, unanswered. It therefore reads a copy of stdin that carries the data but never the
  // end, so those calls still write their responses and the session's end is decided below. Its
  // handle is deliberately never closed on shutdown either, which would abort them the same way.
  const input = new PassThrough();
  stdin.pipe(input, { end: false });
  serveStdio(factory, {
    legacy: 'serve',
    transport: new StdioServerTransport(input, process.stdout),
    onerror: err => log.debug('stdio transport error', { error: err.message })
  });

  // Attached in the same tick as the SDK's own reader, before stdin can flow, so no input goes
  // unseen.
  let receivedInput = false;
  const onData = (chunk) => {
    if (!/\S/.test(chunk)) return;
    receivedInput = true;
    stdin.off('data', onData);
  };
  stdin.on('data', onData);

  let ended = false;
  const onEnd = () => {
    if (ended) return;
    ended = true;
    if (stdinEndEndsSession(stdin, receivedInput ? 1 : 0)) {
      shutdown.begin('stdin closed by the MCP client');
    } else {
      log.info('mcp-min: stdin closed before any message and is not a client pipe; other transports keep running');
    }
  };
  stdin.once('end', onEnd);
  stdin.once('close', onEnd);

  process.stdout.on('error', (err) => {
    if (err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED') {
      log.debug('stdout pipe closed, exiting');
      process.exit(0);
    }
    log.error('stdout error', err.message);
  });
}

function parseCwd(argv) {
  for (let i = 2; i < argv.length; i++) {
    if ((argv[i] === '--cwd' || argv[i] === '-C') && argv[i + 1]) {
      return argv[i + 1];
    }
    if (argv[i].startsWith('--cwd=')) {
      return argv[i].slice(6);
    }
  }
  return null;
}

// Auto-start when executed directly (node mcp-min/stdio-server.js).
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const cwd = parseCwd(process.argv);
  if (cwd) {
    process.chdir(path.resolve(cwd));
    log.info(`working directory set to ${process.cwd()}`);
  }
  log.info(`log file: ${log.LOG_FILE}`);
  let selection;
  try {
    selection = selectTools();
  } catch (err) {
    if (err?.name !== 'ToolsConfigError') throw err;
    log.error(err.message);
    process.exit(1);
  }
  log.info(describeSelection(selection));
  startStdio({ tools: selection.tools });
}
