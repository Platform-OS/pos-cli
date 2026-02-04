// platformos.deploy.wait - poll deployment status until completion
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const files = require('../../lib/files');
const settings = require('../../lib/settings');
const Gateway = require('../../lib/proxy');

function resolveAuth(params) {
  if (params?.url && params?.email && params?.token) {
    return { url: params.url, email: params.email, token: params.token, source: 'params' };
  }
  const { MPKIT_URL, MPKIT_EMAIL, MPKIT_TOKEN } = process.env;
  if (MPKIT_URL && MPKIT_EMAIL && MPKIT_TOKEN) {
    return { url: MPKIT_URL, email: MPKIT_EMAIL, token: MPKIT_TOKEN, source: 'env' };
  }
  if (params?.env) {
    const found = settings.fetchSettings(params.env);
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

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const waitDeployTool = {
  description: 'Wait for deployment to finish. Polls Gateway.getStatus(id) every intervalMs (default 1000ms) and errors on status=error.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string' },
      url: { type: 'string' },
      email: { type: 'string' },
      token: { type: 'string' },
      endpoint: { type: 'string' },
      id: { type: 'string', description: 'Deployment ID' },
      intervalMs: { type: 'integer', minimum: 200, default: 1000 },
      maxWaitMs: { type: 'integer', minimum: 1000, description: 'Optional maximum wait in ms; if exceeded returns timeout error' }
    },
    required: ['id']
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    try {
      const auth = resolveAuth(params);
      const baseUrl = params?.endpoint ? params.endpoint : auth.url;
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

      const id = params.id;
      const interval = Number.isFinite(params?.intervalMs) ? Number(params.intervalMs) : 1000;
      const started = Date.now();
      const maxWait = Number.isFinite(params?.maxWaitMs) && params.maxWaitMs > 0 ? Number(params.maxWaitMs) : null;
      while (true) {
        const resp = await gateway.getStatus(id);
        if (resp && resp.status === 'ready_for_import') {
          if (maxWait && (Date.now() - started) >= maxWait) {
            return { ok: false, error: { code: 'TIMEOUT', message: `Timed out waiting for deployment after ${maxWait}ms`, data: resp } };
          }
          await delay(interval);
          continue;
        }
        if (resp && resp.status === 'error') {
          const body = resp.error || {};
          let message = body.error || 'Deployment error';
          if (body.details && body.details.file_path) {
            message += `\n${body.details.file_path}`;
          }
          return { ok: false, error: { code: 'DEPLOY_ERROR', message, data: resp } };
        }
        return { ok: true, data: resp, meta: { startedAt, finishedAt: new Date().toISOString() } };
      }
    } catch (e) {
      return { ok: false, error: { code: 'DEPLOY_WAIT_ERROR', message: String(e) } };
    }
  }
};

export default waitDeployTool;
