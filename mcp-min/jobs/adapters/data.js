/**
 * The three data jobs (import, export, clean) read their status the same way: one Gateway call and
 * a status that is either a string or `{ name }`.
 */
import log from '../../log.js';

const STATES = Object.freeze({
  pending: 'running',
  processing: 'running',
  scheduled: 'running',
  done: 'completed',
  failed: 'failed'
});

/** Whichever shape the instance used. */
export const statusOf = response => response?.status?.name ?? response?.status;

// A wait polls every second or so; the same unknown status is worth saying once, not thirty times.
const warned = new Set();

/**
 * An unrecognised status counts as still running: the job exists, so reporting it finished would
 * be a lie, and the raw value travels back with it.
 */
export function stateOf(status, kind) {
  if (typeof status === 'string' && Object.hasOwn(STATES, status)) return STATES[status];

  const seen = `${kind}:${status}`;
  if (!warned.has(seen)) {
    warned.add(seen);
    log.warn(`mcp-min: ${kind} reported an unknown status`, { status });
  }
  return 'running';
}
