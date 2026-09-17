/**
 * The three data jobs (import, export, clean) read their status the same way: one Gateway call,
 * a status that is either a string or `{ name }`, and the same vocabulary.
 */
import log from '../../log.js';

const STATES = Object.freeze({
  pending: 'running',
  processing: 'running',
  scheduled: 'running',
  done: 'completed',
  failed: 'failed'
});

/** The status the instance reports, whichever shape it uses. */
export const statusOf = response => response?.status?.name ?? response?.status;

/**
 * An unrecognised status counts as still running: the job exists, so reporting it finished would
 * be a lie, and the raw value travels back with it.
 */
export function stateOf(status, kind) {
  if (typeof status === 'string' && Object.hasOwn(STATES, status)) return STATES[status];
  log.warn(`mcp-min: ${kind} reported an unknown status`, { status });
  return 'running';
}
