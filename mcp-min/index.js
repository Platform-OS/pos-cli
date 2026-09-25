/**
 * Starts the MCP server's transports for an already-resolved tool selection. Importing this opens
 * no transport — bin/pos-cli-mcp.js resolves the selection first, so a bad option or tools config
 * is reported before anything listens — but it does set server mode and the process handlers.
 */
import net from 'net';
import startStdio from './stdio-server.js';
import startHttp, { stopHttp } from './http-server.js';
import { readHttpConfig } from './http-config.js';
import { createShutdown } from './lifecycle.js';
import { describeSelection } from './tool-selection.js';
import log from './log.js';
import { setServerMode } from '../lib/logger.js';

// CLI code runs in-process here, so a fatal logger.Error must throw (caught per-request) rather
// than process.exit and take down every tool. Before anything can run.
setServerMode(true);

// The session's shutdown, so the handlers below can drain rather than abandon the process.
let sessionShutdown = null;

process.on('uncaughtException', (err) => {
  if (err?.code === 'EPIPE' || err?.code === 'ERR_STREAM_DESTROYED') {
    log.debug('Pipe closed, exiting');
    process.exit(0);
  }

  // The process's state is undefined now, and it is listening on an unauthenticated port with
  // credentials resolved. Drain rather than carry on: responses in flight are written, the port is
  // released, and the exit code says it was not a clean stop.
  log.error('Uncaught exception, shutting down', err);
  process.exitCode = 1;
  if (!sessionShutdown) process.exit(1);

  sessionShutdown.begin('uncaught exception');
  // `begin` alone leaves stdin open, and the process would sit there until the shutdown deadline.
  // Work already in flight still keeps the loop alive until it finishes.
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
    // requests to 127.0.0.1 keep reaching it, unprotected, until it is stopped.
    EADDRINUSE: `${where} is already in use by another process. If that is an older pos-cli-mcp, it is bound to ` +
      'all interfaces without Host/Origin checks: stop it or restart the MCP client that launched it. ' +
      'Otherwise choose a free port with MCP_MIN_PORT',
    // Not only privileged ports: Windows refuses reserved ranges this way too.
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
    // Only a failed bind is the optional-transport case; a schema that will not compile would
    // otherwise be reported as "not started (unknown error)" and the server carry on regardless.
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
 * @param {boolean} [options.http] - false for --no-http: stdio only, and MCP_MIN_* is then not read
 *   at all, so a stale value in an editor's environment cannot stop a stdio server.
 * @throws {import('./http-config.js').HttpConfigError} before any transport starts.
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
