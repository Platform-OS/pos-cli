/**
 * Cancellation for tools that wait or page: the protocol layer passes the call's AbortSignal as
 * `ctx.signal`, aborted when the client cancels the call or goes away.
 *
 * Whatever a cancelled tool returns is never sent — the client has stopped waiting — so what
 * matters is that it stops making requests to the instance.
 */

/** The result of a call that stopped because it was cancelled. */
export const cancelled = () => ({ ok: false, error: { code: 'CANCELLED', message: 'The call was cancelled by the client.' } });

/** Waits `ms`, or less if `signal` aborts first. Resolves either way; check `signal.aborted` after. */
export function abortableDelay(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener('abort', finish, { once: true });
  });
}
