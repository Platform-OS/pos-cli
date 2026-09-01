// platformos.constants.list tool - list all constants
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { getConstants } from '../../lib/graph/queries.js';
import { graphQLErrorMessage } from '../../lib/graph/response.js';
import { authProperties } from '../schemas/auth.js';

const constantsListTool = {
  description: 'List all constants configured on a platformOS instance.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      ...authProperties
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();

    try {
      const auth = await resolveAuth(params, ctx);

      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      const resp = await gateway.graph(getConstants());

      const errorMessage = graphQLErrorMessage(resp);
      if (errorMessage) {
        return {
          ok: false,
          error: { code: 'GRAPHQL_ERROR', message: errorMessage }
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
