// platformos.data.clean.status - check the status of a data clean job
import { DEBUG, debugLog } from '../config.js';
import files from '../../lib/files.js';
import { fetchSettings } from '../../lib/settings.js';
import Gateway from '../../lib/proxy.js';

const settings = { fetchSettings };

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

const dataCleanStatusTool = {
  description: 'Check the status of a data clean job. Poll until status is "done" or "failed".',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      url: { type: 'string', description: 'Instance URL (alternative to env)' },
      email: { type: 'string', description: 'Account email (alternative to env)' },
      token: { type: 'string', description: 'API token (alternative to env)' },
      jobId: { type: 'string', description: 'Clean job ID returned from data-clean' }
    },
    required: ['jobId']
  },
  handler: async (params, ctx = {}) => {
    DEBUG && debugLog('tool:data-clean-status invoked', { jobId: params?.jobId });

    try {
      const auth = await resolveAuth(params);
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      const { jobId } = params;

      if (!jobId) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'jobId is required' } };
      }

      const response = await gateway.dataCleanStatus(jobId);

      // Normalize status - it may be an object with .name or a string
      const status = response.status?.name || response.status;

      return {
        ok: true,
        data: {
          id: jobId,
          status,
          done: status === 'done',
          failed: status === 'failed',
          pending: ['pending', 'processing', 'scheduled'].includes(status),
          response
        },
        meta: {
          auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source }
        }
      };
    } catch (e) {
      DEBUG && debugLog('tool:data-clean-status error', { error: String(e) });
      return { ok: false, error: { code: 'DATA_CLEAN_STATUS_ERROR', message: String(e.message || e) } };
    }
  }
};

export default dataCleanStatusTool;
