// platformos.data.export.status - check the status of a data export job
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

const dataExportStatusTool = {
  description: 'Check the status of a data export job. When done, returns data (JSON) or zip_file_url (ZIP).',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      url: { type: 'string', description: 'Instance URL (alternative to env)' },
      email: { type: 'string', description: 'Account email (alternative to env)' },
      token: { type: 'string', description: 'API token (alternative to env)' },
      jobId: { type: 'string', description: 'Export job ID returned from data-export' },
      isZip: { type: 'boolean', description: 'Whether the export is a ZIP file', default: false }
    },
    required: ['jobId']
  },
  handler: async (params, ctx = {}) => {
    DEBUG && debugLog('tool:data-export-status invoked', { jobId: params?.jobId });

    try {
      const auth = await resolveAuth(params);
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      const { jobId, isZip = false } = params;

      if (!jobId) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'jobId is required' } };
      }

      const response = await gateway.dataExportStatus(jobId, isZip);

      // Normalize status
      const status = response.status?.name || response.status;

      const result = {
        ok: true,
        data: {
          id: jobId,
          status,
          done: status === 'done',
          failed: status === 'failed',
          pending: ['pending', 'processing', 'scheduled'].includes(status)
        },
        meta: {
          auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source }
        }
      };

      // Include export data when done
      if (status === 'done') {
        if (isZip && response.zip_file_url) {
          result.data.zipFileUrl = response.zip_file_url;
        } else if (response.data) {
          // Transform data to standard format
          result.data.exportedData = {
            users: response.data.users?.results || [],
            transactables: response.data.transactables?.results || [],
            models: response.data.models?.results || []
          };
        }
      }

      return result;
    } catch (e) {
      DEBUG && debugLog('tool:data-export-status error', { error: String(e) });
      return { ok: false, error: { code: 'DATA_EXPORT_STATUS_ERROR', message: String(e.message || e) } };
    }
  }
};

export default dataExportStatusTool;
