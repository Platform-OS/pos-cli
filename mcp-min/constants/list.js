// platformos.constants.list tool - list all constants
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';

const QUERY = `query getConstants {
  constants(per_page: 99) {
    results { name, value, updated_at }
  }
}`;

const constantsListTool = {
  description: 'List all constants configured on a platformOS instance.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['env'],
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' }
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();

    try {
      const auth = await resolveAuth(params, ctx);

      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      const resp = await gateway.graph({ query: QUERY });

      if (resp && Array.isArray(resp.errors) && resp.errors.length > 0) {
        return {
          ok: false,
          error: {
            code: 'GRAPHQL_ERROR',
            message: resp.errors[0]?.message || 'GraphQL error'
          }
        };
      }

      const constants = resp?.data?.constants?.results || [];

      return {
        ok: true,
        data: {
          constants: constants.map(c => ({
            name: c.name,
            value: c.value,
            updatedAt: c.updated_at
          })),
          count: constants.length
        },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    } catch (e) {
      return {
        ok: false,
        error: { code: 'CONSTANTS_LIST_FAILED', message: String(e.message || e) },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    }
  }
};

export default constantsListTool;
