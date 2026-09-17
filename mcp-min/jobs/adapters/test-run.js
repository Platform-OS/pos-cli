/**
 * An async test run. `/_tests/results/:id` is not an app_builder endpoint, so this adapter takes
 * the request function rather than the Gateway.
 *
 * A run whose assertions failed is `completed`, not `failed`: the job did what it was asked to.
 * `failed` is kept for the runner itself going down, which is the one case where the answer says
 * nothing about the code under test.
 */
import { JobNotFoundError } from '../errors.js';
import { normalizeResult, resultsUrl } from '../../tests/result.js';

const STATES = Object.freeze({ pending: 'running', success: 'completed', failed: 'completed', error: 'failed' });

export default {
  kind: 'test-run',
  poll: async ({ auth, request }, id) => {
    const url = resultsUrl(auth.url, id);
    const response = await request({ method: 'GET', uri: url, headers: auth.headers });

    if (response.statusCode === 404) throw new JobNotFoundError(`the test-run job ${id} is not on this instance`);
    if (response.statusCode >= 400) {
      const err = new Error(`the test results request failed with status ${response.statusCode}`);
      err.statusCode = response.statusCode;
      err.body = response.body;
      throw err;
    }

    let body;
    try {
      body = JSON.parse(response.body);
    } catch {
      const err = new Error('the instance answered the test results request with something other than JSON');
      err.body = response.body;
      throw err;
    }

    // The runner answers 200 with this for an id it does not have.
    if (body?.error === 'not_found') throw new JobNotFoundError(`the test-run job ${id} is not on this instance`);

    const result = normalizeResult(body);
    return {
      state: STATES[result.status] ?? 'running',
      status: result.status,
      ...(result.status === 'error' && { error: result.error_message || 'the test runner failed' }),
      result
    };
  }
};
