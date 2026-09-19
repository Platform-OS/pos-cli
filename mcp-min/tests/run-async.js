// platformos.tests.run-async - trigger tests via /_tests/run_async (returns immediately)
import log from '../log.js';
import { resolveAuth } from '../auth.js';
import { mintFor } from '../jobs/handle.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError, kindForStatus } from '../tool-error.js';
import makeRequest, { testAuthHeaders, testsUrl } from './request.js';

const testsRunAsyncTool = {
  description: 'Start a test run on an instance and return at once with a job_id to poll with job-status. To run one test and wait for it, use unit-tests-run.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
    }
  },
  handler: async (params, ctx = {}) => {
    log.debug('tool:tests-run-async invoked', { env: params?.env });

    const auth = await resolveAuth(params, ctx);
    const requestFn = ctx.request || makeRequest;
    const authHeaders = testAuthHeaders(auth.token);

    const triggerUrl = testsUrl(auth.url, '/_tests/run_async');
    log.debug('Triggering async test run', { url: triggerUrl });

    const triggerResponse = await requestFn({
      method: 'GET',
      uri: triggerUrl,
      headers: authHeaders
    });

    // The endpoint answers with a status rather than throwing, so the kind is decided here.
    if (triggerResponse.statusCode >= 400) {
      throw new ToolError(
        kindForStatus(triggerResponse.statusCode),
        'HTTP_ERROR',
        `Trigger request failed with status ${triggerResponse.statusCode}`,
        { statusCode: triggerResponse.statusCode, body: triggerResponse.body }
      );
    }

    let runInfo;
    try {
      runInfo = JSON.parse(triggerResponse.body);
    } catch {
      // The instance accepted the request and answered with something that is not a run.
      throw ToolError.instance('INVALID_RESPONSE', 'Failed to parse run_async response as JSON', { body: triggerResponse.body });
    }

    const runId = runInfo.id;
    if (!runId) {
      throw ToolError.instance('MISSING_ID', 'run_async response did not contain an id', runInfo);
    }

    log.debug('Test run triggered', { id: runId, test_name: runInfo.test_name });

    return {
      id: runId,
      job_id: mintFor({ kind: 'test-run', id: runId, origin: auth.url }),
      test_name: runInfo.test_name,
      status: runInfo.status || 'pending',
      result_url: runInfo.result_url || `/_tests/results/${runId}`,
      url: triggerUrl
    };
  }
};

export default testsRunAsyncTool;
