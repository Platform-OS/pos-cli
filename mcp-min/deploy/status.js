// platformos.deploy.status - check deployment status via Gateway.getStatus
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';

const statusDeployTool = {
  description: 'Get current deployment status using Gateway.getStatus(id).',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string' },
      url: { type: 'string' },
      email: { type: 'string' },
      token: { type: 'string' },
      endpoint: { type: 'string' },
      id: { type: 'string', description: 'Deployment ID returned from start' }
    },
    required: ['id']
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    try {
      const auth = await resolveAuth(params, ctx);
      const baseUrl = params?.endpoint ? params.endpoint : auth.url;
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

      const resp = await gateway.getStatus(params.id);
      return {
        ok: true,
        data: resp,
        meta: { startedAt, finishedAt: new Date().toISOString(), auth: { url: baseUrl, email: auth.email, source: auth.source } }
      };
    } catch (e) {
      return { ok: false, error: { code: 'DEPLOY_STATUS_ERROR', message: String(e) } };
    }
  }
};

export default statusDeployTool;
