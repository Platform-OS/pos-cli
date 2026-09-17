/**
 * When the MCP server process ends.
 *
 * MCP clients launch this server with stdin/stdout pipes, and a closed stdin is the
 * spec's primary — and only portable — shutdown signal (MCP stdio transport: "Servers
 * SHOULD exit promptly when their standard input is closed"). The HTTP listener would
 * otherwise keep the event loop alive forever, and a server started through a wrapper
 * (`npx`, `pos-cli mcp`) survives its client being killed.
 *
 * Shutdown is a drain, not an exit: the transports stop taking new work and the process
 * ends on its own once nothing is left running. That lets in-flight tool calls write their
 * responses, and lets work a tool started in the background — deploy-start's asset upload —
 * finish, which an immediate process.exit() would cut off mid-upload. The deadline bounds a
 * call that never ends.
 */
import net from 'net';
import log from './log.js';

// deploy-start returns before its asset upload finishes, and that upload waits up to 90 s
// for the CDN (lib/assets.js waitForUnpack), so the deadline must leave room for it.
export const SHUTDOWN_DEADLINE_MS = 120_000;

/**
 * Does stdin reaching EOF mean the client is gone?
 *
 * A pipe or socket on stdin is a client connection, so its end always does — even before
 * any message, which is what a client that starts the server and quits at once looks like.
 * `</dev/null`, a file or a terminal is not a client; that is how the HTTP transport is run
 * on its own (`pos-cli-mcp </dev/null &`, a container without -i), so EOF there only ends
 * the session once stdio has actually been used.
 *
 * @param {import('stream').Readable & { isTTY?: boolean }} stdin
 * @param {number} messagesReceived - non-empty lines read from stdin
 */
export function stdinEndEndsSession(stdin, messagesReceived) {
  const clientPipe = !stdin.isTTY && stdin instanceof net.Socket;
  return clientPipe || messagesReceived > 0;
}

/**
 * @param {object} [options]
 * @param {number} [options.deadlineMs]
 * @param {(code: number) => void} [options.exit] - called only if the deadline passes
 * @param {{ info: Function, warn: Function, error: Function }} [options.logger]
 */
export function createShutdown({
  deadlineMs = SHUTDOWN_DEADLINE_MS,
  exit = (code) => process.exit(code),
  logger = log
} = {}) {
  const closers = [];
  let started = false;

  const run = (closer) => {
    try {
      Promise.resolve(closer()).catch((err) => logger.error('mcp-min: error while shutting down', { error: String(err) }));
    } catch (err) {
      logger.error('mcp-min: error while shutting down', { error: String(err) });
    }
  };

  return {
    get started() {
      return started;
    },

    /**
     * Registers something to stop when shutdown begins. A transport that finishes starting
     * after shutdown has begun — the HTTP bind can complete after a client has already
     * closed stdin — is stopped at once instead of outliving the session.
     */
    onShutdown(closer) {
      if (started) run(closer);
      else closers.push(closer);
    },

    /** Idempotent. Returns whether this call began the shutdown. */
    begin(reason) {
      if (started) return false;
      started = true;
      logger.info(`mcp-min: ${reason}; shutting down once in-flight work finishes (at most ${Math.round(deadlineMs / 1000)}s)`);

      // unref: the timer must not itself keep a finished process alive.
      setTimeout(() => {
        logger.warn(`mcp-min: work still running ${Math.round(deadlineMs / 1000)}s after shutdown began; exiting anyway`);
        exit(0);
      }, deadlineMs).unref();

      for (const closer of closers.splice(0)) run(closer);
      return true;
    }
  };
}
