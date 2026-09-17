// platformos.tests.run-async-result - check result of an async test run via /_tests/results/:id
import log from '../log.js';
import { resolveAuth, maskToken } from '../auth.js';
import { authProperties } from '../schemas/auth.js';
import makeRequest, { testAuthHeaders } from './request.js';
import { resultsUrl as buildResultsUrl } from './result.js';
import testRunAdapter from '../jobs/adapters/test-run.js';
import { JobNotFoundError } from '../jobs/errors.js';

const testsRunAsyncResultTool = {
  description: 'Deprecated: use job-status. Check the results of an async test run by ID: pending, success, failed (assertion failures) or error (runner crashed).',
  // Tells MCP clients this tool changes nothing, locally or on the instance.
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      ...authProperties,
      id: { type: 'string', description: 'Test run ID returned by tests-run-async' }
    },
    required: ['id']
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    log.debug('tool:tests-run-async-result invoked', { id: params?.id, env: params?.env });

    try {
      const auth = await resolveAuth(params, ctx);
      const requestFn = ctx.request || makeRequest;
      const authHeaders = testAuthHeaders(auth.token);

      const runId = params.id;
      const resultsUrl = buildResultsUrl(auth.url, runId);

      log.debug('Fetching test results', { url: resultsUrl });

      const authMeta = { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source };
      const finished = () => ({ url: resultsUrl, startedAt, finishedAt: new Date().toISOString(), auth: authMeta });

      // Same adapter job-status uses, so the two can never disagree about a run.
      let polled;
      try {
        polled = await testRunAdapter.poll({ auth: { url: auth.url, headers: authHeaders }, request: requestFn }, runId);
      } catch (e) {
        if (e instanceof JobNotFoundError) {
          return { ok: false, error: { code: 'NOT_FOUND', message: `Test result ${runId} not found` }, meta: finished() };
        }
        if (e.statusCode) {
          return {
            ok: false,
            error: { code: 'HTTP_ERROR', message: e.message, statusCode: e.statusCode, body: e.body },
            meta: finished()
          };
        }
        if (e.body !== undefined) {
          return { ok: false, error: { code: 'INVALID_RESPONSE', message: e.message, body: e.body }, meta: finished() };
        }
        throw e;
      }

      return { ok: true, data: polled.result, meta: finished() };
    } catch (e) {
      log.error('tool:tests-run-async-result error', { error: String(e) });
      return {
        ok: false,
        error: { code: 'TESTS_RESULT_ERROR', message: String(e.message || e) }
      };
    }
  }
};

export default testsRunAsyncResultTool;
