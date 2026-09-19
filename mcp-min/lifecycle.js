/**
 * When the MCP server process ends. A closed stdin is the spec's only portable shutdown signal
 * ("Servers SHOULD exit promptly when their standard input is closed"); without acting on it the
 * HTTP listener keeps the event loop alive forever, and a server started through a wrapper
 * (`npx`, `pos-cli mcp`) outlives the client that launched it.
 *
 * Shutdown is a drain, not an exit: transports stop taking new work and the process ends once
 * nothing is left running, so in-flight calls write their responses and background work
 * (deploy-start's asset upload) finishes. The deadline bounds a call that never ends.
 */
import net from 'net';
import log from './log.js';

// deploy-start returns before its asset upload finishes, and that upload waits up to 90 s
// for the CDN (lib/assets.js waitForUnpack), so the deadline must leave room for it.
export const SHUTDOWN_DEADLINE_MS = 120_000;

/**
 * Does stdin reaching EOF mean the client is gone? A pipe or socket is a client connection, so its
 * end always does, even before any message. `</dev/null`, a file or a terminal is not — that is how
 * the HTTP transport is run alone — so EOF there ends the session only once stdio has been used.
 *
 * @param {number} messagesReceived - non-empty lines read from stdin
 */
export function stdinEndEndsSession(stdin, messagesReceived) {
  const clientPipe = !stdin.isTTY && stdin instanceof net.Socket;
  return clientPipe || messagesReceived > 0;
}

/** @param {(code: number) => void} [options.exit] - called only if the deadline passes */
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
     * Registers something to stop when shutdown begins. A transport that finishes starting after
     * that — the HTTP bind can complete after the client closed stdin — is stopped at once.
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
        // A shutdown that began from an uncaught exception must not report success just because
        // the deadline was what ended it.
        exit(process.exitCode ?? 0);
      }, deadlineMs).unref();

      for (const closer of closers.splice(0)) run(closer);
      return true;
    }
  };
}
