/**
 * Starts the MCP server's transports for an already-resolved tool selection.
 *
 * Importing this module opens no transport: bin/pos-cli-mcp.js parses its arguments and resolves
 * the selection first, so a bad option or tools config is reported before any transport opens.
 * (It does put the CLI logger into server mode and install the process handlers below.)
 */
import net from 'net';
import startStdio from './stdio-server.js';
import startHttp, { stopHttp } from './http-server.js';
import { readHttpConfig } from './http-config.js';
import { createShutdown } from './lifecycle.js';
import { describeSelection } from './tool-selection.js';
import log from './log.js';
import { setServerMode } from '../lib/logger.js';

// This host loads CLI code in-process; a fatal logger.Error must throw (caught
// per-request), never process.exit and take down all tools. Enable before any
// tool can run.
setServerMode(true);

// The session's shutdown, so the handlers below can drain rather than abandon the process.
let sessionShutdown = null;

// Global handlers - exit cleanly on EPIPE (client disconnected)
process.on('uncaughtException', (err) => {
  if (err?.code === 'EPIPE' || err?.code === 'ERR_STREAM_DESTROYED') {
    log.debug('Pipe closed, exiting');
    process.exit(0);
  }

  // After an uncaught exception the process's state is undefined, and this one is listening on an
  // unauthenticated port with credentials resolved: carrying on would keep serving from a server
  // that is broken in a way nobody has looked at. Drain instead — responses in flight are written,
  // the port is released, and the exit code says it was not a clean stop.
  log.error('Uncaught exception, shutting down', err);
  process.exitCode = 1;
  if (!sessionShutdown) process.exit(1);

  sessionShutdown.begin('uncaught exception');
  // The session is over, so stop reading from the client as well: `begin` alone leaves stdin
  // open, and the process would sit there — broken, still holding its credentials — until the
  // shutdown deadline. Work already in flight still keeps the loop alive until it finishes.
  process.stdin.pause();
  process.stdin.unref?.();
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection', reason);
});

const hostPort = (host, port) => `${net.isIPv6(host) ? `[${host}]` : host}:${port}`;

function bindFailureMessage(err, { host, port }) {
  const where = hostPort(host, port);
  const code = err.code || 'unknown error';
  const detail = {
    // The hint matters on upgrade: an older pos-cli-mcp holds the port on every interface, and
    // requests to 127.0.0.1 keep reaching it — unprotected — until it is stopped.
    EADDRINUSE: `${where} is already in use by another process. If that is an older pos-cli-mcp, it is bound to ` +
      'all interfaces without Host/Origin checks: stop it or restart the MCP client that launched it. ' +
      'Otherwise choose a free port with MCP_MIN_PORT',
    // Not only privileged ports: Windows also refuses reserved port ranges this way, and may
    // refuse a bind that would shadow another process's listener on all interfaces.
    EACCES: `permission denied for ${where}: ports below 1024 need elevated privileges, and on Windows the port ` +
      'may be reserved or held by another process (such as an older pos-cli-mcp). Choose another port with MCP_MIN_PORT',
    EADDRNOTAVAIL: `${host} is not an address of this machine. Check MCP_MIN_HOST`
  }[err.code] || `${where}: ${err.message}`;

  return `mcp-min: HTTP transport not started (${code}): ${detail}. MCP over stdio is unaffected.`;
}

function exposureWarning(url, allowedHostnames) {
  return `mcp-min: the HTTP transport at ${url} is reachable beyond this machine (MCP_MIN_HOST). ` +
    'It has no authentication: anyone who can reach this port can run every enabled tool with the ' +
    'platformOS credentials this server resolves (.pos, MPKIT_*). Host/Origin validation still applies ' +
    `(allowed hostnames: ${allowedHostnames.join(', ')}); it blocks DNS rebinding from web pages, not ` +
    'direct clients. Unset MCP_MIN_HOST to listen on 127.0.0.1 only.';
}

// The HTTP transport is optional next to stdio, which is what MCP clients launch this
// process for, so a failed bind is reported and stdio keeps serving.
async function startHttpTransport(config, tools, shutdown) {
  let server;
  try {
    server = await startHttp({ ...config, tools });
  } catch (err) {
    // Only a failed bind is the optional-transport case. A tool schema that will not compile, or
    // a programming error in the middleware, would otherwise be reported as "not started
    // (unknown error)" and the server would carry on as if a port were busy.
    if (err?.syscall !== 'listen') throw err;
    log.error(bindFailureMessage(err, config));
    return;
  }

  const { address, port } = server.address();
  const url = `http://${hostPort(address, port)}`;
  log.info(`mcp-min: HTTP server listening on ${url}`);
  if (config.exposed) log.warn(exposureWarning(url, config.allowedHostnames));

  // Registered after the bind, so if the client closed stdin while the bind was in progress
  // the listener is stopped at once rather than kept open for nobody.
  shutdown.onShutdown(async () => {
    await stopHttp(server);
    log.info(`mcp-min: HTTP server on ${url} closed`);
  });
}

/**
 * @param {object} options
 * @param {ReturnType<import('./tool-selection.js').selectTools>} options.selection - the tools to
 *   expose, identical for both transports
 * @param {boolean} [options.http] - false for --no-http: stdio only. MCP_MIN_* is then not read
 *   at all, since there is nothing it could expose, and a stale value in an editor's
 *   environment must not stop a stdio server
 * @throws {import('./http-config.js').HttpConfigError} before any transport starts, when HTTP
 *   is on and an MCP_MIN_* variable is malformed
 */
export async function start({ selection, http = true }) {
  const httpConfig = http ? readHttpConfig(process.env) : null;

  try {
    log.info('mcp-min: starting MCP minimal server...');
    log.info(describeSelection(selection));

    // One shutdown for both transports: the MCP client closing stdin ends the session, and the
    // HTTP listener must not keep the process — and its port — alive after that.
    const shutdown = createShutdown();
  sessionShutdown = shutdown;

    startStdio({ tools: selection.tools, shutdown });
    if (httpConfig) {
      await startHttpTransport(httpConfig, selection.tools, shutdown);
    } else {
      log.info('mcp-min: HTTP transport disabled (--no-http); serving MCP over stdio only');
    }
  } catch (err) {
    log.error('Fatal error during startup', String(err));
    process.exit(1);
  }
}
