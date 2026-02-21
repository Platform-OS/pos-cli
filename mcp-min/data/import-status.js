// platformos.data.import.status - check the status of a data import job
import log from '../log.js';
import { fetchSettings } from '../../lib/settings.js';
import Gateway from '../../lib/proxy.js';

const settings = { fetchSettings };

async function resolveAuth(env, settingsModule = settings) {
  const found = await settingsModule.fetchSettings(env);
  if (found) return { ...found, source: `.pos(${env})` };
  throw new Error(`Environment "${env}" not found in .pos config`);
}

const dataImportStatusTool = {
  description: 'Check the status of a data import job. Poll until status is "done" or "failed".',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['env', 'jobId'],
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
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

      const auth = await resolveAuth(params.env, ctx.settings || settings);
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      const { jobId } = params;

      // Always use ZIP status endpoint (isZip=true) since we convert JSON to ZIP
      const response = await gateway.dataImportStatus(jobId, true);

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
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    } catch (e) {
      log.error('tool:data-import-status error', { error: String(e) });
      return {
        ok: false,
        error: { code: 'DATA_IMPORT_STATUS_ERROR', message: String(e.message || e) },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    }
  }
};

export default dataImportStatusTool;
