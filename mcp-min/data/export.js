// platformos.data.export - start data export from platformOS instance
import log from '../log.js';
import { resolveAuth, maskToken } from '../auth.js';
import Gateway from '../../lib/proxy.js';

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
    log.debug('tool:data-export invoked', { env: params?.env, zip: params?.zip });

    try {
      const auth = await resolveAuth(params, ctx);
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
      log.error('tool:data-export error', { error: String(e) });

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
