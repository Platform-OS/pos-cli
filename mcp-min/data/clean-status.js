// platformos.data.clean.status - check the status of a data clean job
import log from '../log.js';
import { resolveAuth, maskToken } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import cleanAdapter from '../jobs/adapters/data-clean.js';
import { JobNotFoundError } from '../jobs/errors.js';

const dataCleanStatusTool = {
  description: 'Deprecated: use job-status. Check the status of a data clean job.',
  // Tells MCP clients this tool changes nothing, locally or on the instance.
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      ...authProperties,
      jobId: { type: 'string', description: 'Clean job ID returned from data-clean' }
    },
    required: ['jobId']
  },
  handler: async (params, ctx = {}) => {
    log.debug('tool:data-clean-status invoked', { jobId: params?.jobId });

    try {
      const auth = await resolveAuth(params, ctx);
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      const { jobId } = params;

      if (!jobId) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'jobId is required' } };
      }

      const polled = await cleanAdapter.poll({ gateway }, jobId);

      return {
        ok: true,
        data: {
          id: jobId,
          status: polled.status,
          done: polled.state === 'completed',
          failed: polled.state === 'failed',
          // An unrecognised status now counts as still pending rather than as none of the three.
          pending: polled.state === 'running',
          response: polled.result
        },
        meta: {
          auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source }
        }
      };
    } catch (e) {
      log.error('tool:data-clean-status error', { error: String(e) });
      return { ok: false, error: { code: e instanceof JobNotFoundError ? 'NOT_FOUND' : 'DATA_CLEAN_STATUS_ERROR', message: String(e.message || e) } };
    }
  }
};

export default dataCleanStatusTool;
