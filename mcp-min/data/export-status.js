// platformos.data.export.status - check the status of a data export job
import log from '../log.js';
import { resolveAuth, maskToken } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import exportAdapter from '../jobs/adapters/data-export.js';
import { JobNotFoundError } from '../jobs/errors.js';

const dataExportStatusTool = {
  description: 'Deprecated: use job-status. Check the status of a data export job; when done, returns the exported data or a ZIP link.',
  // Tells MCP clients this tool changes nothing, locally or on the instance.
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      ...authProperties,
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

      const polled = await exportAdapter.poll({ gateway }, jobId, { zip: isZip });

      const result = {
        ok: true,
        data: {
          id: jobId,
          status: polled.status,
          done: polled.state === 'completed',
          failed: polled.state === 'failed',
          // An unrecognised status now counts as still pending rather than as none of the three.
          pending: polled.state === 'running'
        },
        meta: {
          auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source }
        }
      };

      // Include export data when done. The adapter builds it, so this tool and job-status hand
      // back the same export.
      const { zip, ...exported } = polled.result;
      Object.assign(result.data, exported);

      return result;
    } catch (e) {
      log.error('tool:data-export-status error', { error: String(e) });
      return { ok: false, error: { code: e instanceof JobNotFoundError ? 'NOT_FOUND' : 'DATA_EXPORT_STATUS_ERROR', message: String(e.message || e) } };
    }
  }
};

export default dataExportStatusTool;
