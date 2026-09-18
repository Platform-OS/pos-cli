import { testsUrl } from './request.js';

/**
 * One reading of a `/_tests/results/:id` body, shared by `tests-run-async-result` and by
 * `job-status`'s test-run adapter, so the two can never disagree about whether a run is done.
 */

/**
 * What a status means, for both readers. A run whose assertions failed is finished — the run did
 * what it was asked to; only the runner going down is a failure of the job itself.
 */
export const RUN_STATES = Object.freeze({ pending: 'running', success: 'completed', failed: 'completed', error: 'failed' });

/** An unfamiliar status is not a finished run: it is one nobody here can read. */
export const runState = status => RUN_STATES[status] ?? 'running';

/** The run, with its counters as numbers and the three questions a caller actually asks. */
export function normalizeResult(result) {
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new TypeError(`the test results endpoint answered with ${result === null ? 'null' : typeof result}, not a run`);
  }

  const status = result.status;
  return {
    id: result.id,
    status,
    test_name: result.test_name,
    total_assertions: parseInt(result.total_assertions, 10) || 0,
    total_errors: parseInt(result.total_errors, 10) || 0,
    total_duration: parseInt(result.total_duration, 10) || 0,
    error_message: result.error_message || '',
    tests: result.tests || [],
    pending: runState(status) === 'running',
    passed: status === 'success',
    done: runState(status) !== 'running'
  };
}

export const resultsUrl = (instanceUrl, id) => testsUrl(instanceUrl, `/_tests/results/${id}`);
