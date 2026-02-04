// platformos.data.export - start data export from platformOS instance
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { DEBUG, debugLog } from '../config.js';

const files = require('../../lib/files');
const settings = require('../../lib/settings');
const Gateway = require('../../lib/proxy');

function maskToken(token) {
  if (!token) return token;
  return token.slice(0, 3) + '...' + token.slice(-3);
}

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

const dataExportTool = {
  description: 'Start data export from platformOS instance. Returns job ID for status polling. When complete, status will include data or zip_file_url.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      url: { type: 'string', description: 'Instance URL (alternative to env)' },
      email: { type: 'string', description: 'Account email (alternative to env)' },
      token: { type: 'string', description: 'API token (alternative to env)' },
      exportInternalIds: {
        type: 'boolean',
        description: 'Use internal object IDs instead of external_id in exported data',
        default: false
      },
      zip: {
        type: 'boolean',
        description: 'Export as ZIP archive (returns download URL when complete)',
        default: false
      }
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    DEBUG && debugLog('tool:data-export invoked', { env: params?.env, zip: params?.zip });

    try {
      const auth = resolveAuth(params);
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      const exportInternalIds = !!params.exportInternalIds;
      const isZip = !!params.zip;

      const exportTask = await gateway.dataExportStart(exportInternalIds, isZip);

      return {
        ok: true,
        data: {
          id: exportTask.id,
          status: exportTask.status || 'pending',
          isZip
        },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString(),
          auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source }
        }
      };
    } catch (e) {
      DEBUG && debugLog('tool:data-export error', { error: String(e) });

      if (e.statusCode === 404) {
        return {
          ok: false,
          error: {
            code: 'NOT_SUPPORTED',
            message: 'Data export is not supported by the server.',
            statusCode: 404
          }
        };
      }

      return { ok: false, error: { code: 'DATA_EXPORT_ERROR', message: String(e.message || e) } };
    }
  }
};

export default dataExportTool;
