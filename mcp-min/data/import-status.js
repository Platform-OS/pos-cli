// platformos.data.import.status - check the status of a data import job
import log from '../log.js';
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import importAdapter from '../jobs/adapters/data-import.js';
import { JobNotFoundError } from '../jobs/errors.js';

const dataImportStatusTool = {
  description: 'Deprecated: use job-status. Check the status of a data import job.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['jobId'],
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      ...authProperties,
      jobId: { type: 'string', description: 'Import job ID returned from data-import' }
    }
  },
  handler: async (params, ctx = {}) => {
    log.debug('tool:data-import-status invoked', { jobId: params?.jobId });
    const startedAt = new Date().toISOString();

    try {
      if (!params.jobId) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'jobId is required' } };
      }

      const auth = await resolveAuth(params, ctx);
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      const { jobId } = params;

      const polled = await importAdapter.poll({ gateway }, jobId);

      return {
        ok: true,
        data: {
          id: jobId,
          status: polled.status,
          done: polled.state === 'completed',
          failed: polled.state === 'failed',
          // An unrecognised status counts as still pending: the job exists, so the only honest
          // answer is that it has not finished.
          pending: polled.state === 'running',
          response: polled.result
        },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    } catch (e) {
      log.error('tool:data-import-status error', { error: String(e) });
      return {
        ok: false,
        error: { code: e instanceof JobNotFoundError ? 'NOT_FOUND' : 'DATA_IMPORT_STATUS_ERROR', message: String(e.message || e) },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    }
  }
};

export default dataImportStatusTool;
