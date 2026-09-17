// platformos.deploy.status - deprecated wrapper over the job-status deploy adapter
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import deployAdapter from '../jobs/adapters/deploy.js';
import { originOf } from '../jobs/handle.js';
import { JobNotFoundError } from '../jobs/errors.js';

// Deprecated in 6.x, removed in the next major: `job-status` answers for every kind of job, and
// its job_id says which instance the deploy was started on — which a bare release id does not.
// Kept working, and on the same adapter, so it cannot drift from what job-status reports.
const statusDeployTool = {
  description: 'Deprecated: use job-status. Get current deployment status by release id.',
  // Tells MCP clients this tool changes nothing, locally or on the instance.
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string' },
      ...authProperties,
      id: { type: 'string', description: 'Deployment ID returned from start' }
    },
    required: ['id']
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    try {
      const auth = await resolveAuth(params, ctx);
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      // `assets: false` — this tool reports on the release, as it always has; the asset phase is
      // job-status's answer, and only a job_id carries what is needed to read it.
      const polled = await deployAdapter.poll({ gateway, origin: originOf(auth.url) }, params.id, { assets: false });

      return {
        ok: true,
        data: polled.result.release,
        meta: { startedAt, finishedAt: new Date().toISOString(), auth: { url: auth.url, email: auth.email, source: auth.source } }
      };
    } catch (e) {
      const code = e instanceof JobNotFoundError ? 'NOT_FOUND' : 'DEPLOY_STATUS_ERROR';
      return { ok: false, error: { code, message: String(e) } };
    }
  }
};

export default statusDeployTool;
