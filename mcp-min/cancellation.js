/**
 * Cancellation for tools that wait or page: `ctx.signal` aborts when the client cancels the call or
 * goes away. Nothing a cancelled tool returns is ever sent, so what matters is that it stops
 * making requests to the instance.
 */
import { ToolError } from './tool-error.js';

/** Thrown by a tool that notices its call was cancelled; `runTool` turns it into a result. */
export const cancelled = () => ToolError.cancelled('CANCELLED', 'The call was cancelled by the client.');

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
