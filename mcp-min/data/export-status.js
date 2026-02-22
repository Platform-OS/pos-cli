// platformos.data.export.status - check the status of a data export job
import log from '../log.js';
import { resolveAuth, maskToken } from '../auth.js';
import Gateway from '../../lib/proxy.js';

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
    log.debug('tool:data-export-status invoked', { jobId: params?.jobId });

    try {
      const auth = await resolveAuth(params, ctx);
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
      log.error('tool:data-export-status error', { error: String(e) });
      return { ok: false, error: { code: 'DATA_EXPORT_STATUS_ERROR', message: String(e.message || e) } };
    }
  }
};

export default dataExportStatusTool;
