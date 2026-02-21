// platformos.tests.run-async-result - check result of an async test run via /_tests/results/:id
import log from '../log.js';
import files from '../../lib/files.js';
import { fetchSettings } from '../../lib/settings.js';

const settings = { fetchSettings };

async function makeRequest(options) {
  const { uri, method = 'GET', headers = {} } = options;
  const response = await fetch(uri, { method, headers });
  const body = await response.text();
  return { statusCode: response.status, body };
}

function maskToken(token) {
  if (!token) return token;
  return token.slice(0, 3) + '...' + token.slice(-3);
}

async function resolveAuth(params) {
  if (params?.url && params?.email && params?.token) {
    return { url: params.url, email: params.email, token: params.token, source: 'params' };
  }
  const { MPKIT_URL, MPKIT_EMAIL, MPKIT_TOKEN } = process.env;
  if (MPKIT_URL && MPKIT_EMAIL && MPKIT_TOKEN) {
    return { url: MPKIT_URL, email: MPKIT_EMAIL, token: MPKIT_TOKEN, source: 'env' };
  }
  if (params?.env) {
    const found = await settings.fetchSettings(params.env);
    if (found) return { ...found, source: `.pos(${params.env})` };
  }
  const conf = files.getConfig();
  const firstEnv = conf && Object.keys(conf)[0];
  if (firstEnv) {
    const found = conf[firstEnv];
    if (found) return { ...found, source: `.pos(${firstEnv})` };
  }
  throw new Error('AUTH_MISSING: Provide url,email,token or configure .pos / MPKIT_* env vars');
}

function normalizeResult(result) {
  const status = result.status;
  const data = {
    id: result.id,
    status,
    test_name: result.test_name,
    total_assertions: parseInt(result.total_assertions, 10) || 0,
    total_errors: parseInt(result.total_errors, 10) || 0,
    total_duration: parseInt(result.total_duration, 10) || 0,
    error_message: result.error_message || '',
    tests: result.tests || [],
    pending: status === 'pending',
    passed: status === 'success',
    done: status !== 'pending'
  };
  return data;
}

const testsRunAsyncResultTool = {
  description: 'Check the result of an async test run by ID via /_tests/results/:id. Returns current status: pending (still running), success (all passed), failed (assertion failures), or error (runner crashed). Poll until done=true.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      url: { type: 'string', description: 'Instance URL (alternative to env)' },
      email: { type: 'string', description: 'Account email (alternative to env)' },
      token: { type: 'string', description: 'API token (alternative to env)' },
      id: { type: 'string', description: 'Test run ID returned by tests-run-async' }
    },
    required: ['id']
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    log.debug('tool:tests-run-async-result invoked', { id: params?.id, env: params?.env });

    try {
      const auth = await resolveAuth(params);
      const requestFn = ctx.request || makeRequest;
      const authHeaders = {
        'Authorization': `Token ${auth.token}`,
        'UserTemporaryToken': auth.token
      };

      const runId = params.id;
      const resultsUrl = `${auth.url}/_tests/results/${runId}`;

      log.debug('Fetching test results', { url: resultsUrl });

      const response = await requestFn({
        method: 'GET',
        uri: resultsUrl,
        headers: authHeaders
      });

      const authMeta = { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source };

      if (response.statusCode >= 400) {
        return {
          ok: false,
          error: {
            code: 'HTTP_ERROR',
            message: `Results request failed with status ${response.statusCode}`,
            statusCode: response.statusCode,
            body: response.body
          },
          meta: { url: resultsUrl, startedAt, finishedAt: new Date().toISOString(), auth: authMeta }
        };
      }

      let result;
      try {
        result = JSON.parse(response.body);
      } catch {
        return {
          ok: false,
          error: {
            code: 'INVALID_RESPONSE',
            message: 'Failed to parse results response as JSON',
            body: response.body
          },
          meta: { url: resultsUrl, startedAt, finishedAt: new Date().toISOString(), auth: authMeta }
        };
      }

      if (result.error === 'not_found') {
        return {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: `Test result ${runId} not found`,
            data: result
          },
          meta: { url: resultsUrl, startedAt, finishedAt: new Date().toISOString(), auth: authMeta }
        };
      }

      const data = normalizeResult(result);

      return {
        ok: true,
        data,
        meta: { url: resultsUrl, startedAt, finishedAt: new Date().toISOString(), auth: authMeta }
      };
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
