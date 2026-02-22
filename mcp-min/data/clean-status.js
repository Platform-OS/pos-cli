// platformos.data.clean.status - check the status of a data clean job
import log from '../log.js';
import { resolveAuth, maskToken } from '../auth.js';
import Gateway from '../../lib/proxy.js';

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
    log.debug('tool:data-clean-status invoked', { jobId: params?.jobId });

    try {
      const auth = await resolveAuth(params, ctx);
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
      log.error('tool:data-clean-status error', { error: String(e) });
      return { ok: false, error: { code: 'DATA_CLEAN_STATUS_ERROR', message: String(e.message || e) } };
    }
  }
};

export default dataCleanStatusTool;
