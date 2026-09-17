// platformos.tests.run-async - trigger tests via /_tests/run_async (returns immediately)
import log from '../log.js';
import { resolveAuth, maskToken } from '../auth.js';
import { mintFor } from '../jobs/handle.js';
import { authProperties } from '../schemas/auth.js';
import makeRequest, { testAuthHeaders, testsUrl } from './request.js';

const testsRunAsyncTool = {
  description: 'Trigger a background platformOS test run via /_tests/run_async. Returns immediately with a run ID and a job_id to poll with job-status.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      ...authProperties,
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    log.debug('tool:tests-run-async invoked', { env: params?.env });

    try {
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

      if (triggerResponse.statusCode >= 400) {
        return {
          ok: false,
          error: {
            code: 'HTTP_ERROR',
            message: `Trigger request failed with status ${triggerResponse.statusCode}`,
            statusCode: triggerResponse.statusCode,
            body: triggerResponse.body
          },
          meta: {
            url: triggerUrl,
            startedAt,
            finishedAt: new Date().toISOString(),
            auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source }
          }
        };
      }

      let runInfo;
      try {
        runInfo = JSON.parse(triggerResponse.body);
      } catch {
        return {
          ok: false,
          error: {
            code: 'INVALID_RESPONSE',
            message: 'Failed to parse run_async response as JSON',
            body: triggerResponse.body
          },
          meta: {
            url: triggerUrl,
            startedAt,
            finishedAt: new Date().toISOString(),
            auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source }
          }
        };
      }

      const runId = runInfo.id;
      if (!runId) {
        return {
          ok: false,
          error: {
            code: 'MISSING_ID',
            message: 'run_async response did not contain an id',
            data: runInfo
          },
          meta: {
            url: triggerUrl,
            startedAt,
            finishedAt: new Date().toISOString(),
            auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source }
          }
        };
      }

      log.debug('Test run triggered', { id: runId, test_name: runInfo.test_name });

      return {
        ok: true,
        data: {
          id: runId,
          job_id: mintFor({ kind: 'test-run', id: runId, origin: auth.url }),
          test_name: runInfo.test_name,
          status: runInfo.status || 'pending',
          result_url: runInfo.result_url || `/_tests/results/${runId}`
        },
        meta: {
          url: triggerUrl,
          startedAt,
          finishedAt: new Date().toISOString(),
          auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source }
        }
      };
    } catch (e) {
      log.error('tool:tests-run-async error', { error: String(e) });
      return {
        ok: false,
        error: { code: 'TESTS_RUN_ASYNC_ERROR', message: String(e.message || e) }
      };
    }
  }
};

export default testsRunAsyncTool;
