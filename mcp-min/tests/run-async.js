// platformos.tests.run-async - trigger tests via /_tests/run_async (returns immediately)
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

const testsRunAsyncTool = {
  description: 'Trigger a background platformOS test run via /_tests/run_async. Returns immediately with a run ID. Use tests-run-async-result to poll for completion.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      url: { type: 'string', description: 'Instance URL (alternative to env)' },
      email: { type: 'string', description: 'Account email (alternative to env)' },
      token: { type: 'string', description: 'API token (alternative to env)' }
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    log.debug('tool:tests-run-async invoked', { env: params?.env });

    try {
      const auth = await resolveAuth(params);
      const requestFn = ctx.request || makeRequest;
      const authHeaders = {
        'Authorization': `Token ${auth.token}`,
        'UserTemporaryToken': auth.token
      };

      const triggerUrl = `${auth.url}/_tests/run_async`;
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
