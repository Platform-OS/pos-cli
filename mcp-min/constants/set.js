// platformos.constants.set tool - set a constant
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { setConstant } from '../../lib/graph/queries.js';
import { graphQLErrorMessage } from '../../lib/graph/response.js';
import { authProperties } from '../schemas/auth.js';

const constantsSetTool = {
  description: 'Set a constant on a platformOS instance. Creates or updates the constant.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'value'],
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      ...authProperties,
      name: { type: 'string', description: 'Name of the constant (e.g., API_KEY)' },
      value: { type: 'string', description: 'Value of the constant' }
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();

    try {
      const auth = await resolveAuth(params, ctx);

      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      const resp = await gateway.graph(setConstant(params.name, params.value));

      const errorMessage = graphQLErrorMessage(resp);
      if (errorMessage) {
        return {
          ok: false,
          error: { code: 'GRAPHQL_ERROR', message: errorMessage }
        };
      }

      const result = resp?.data?.constant_set;

      return {
        ok: true,
        data: {
          name: result?.name,
          value: result?.value
        },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    } catch (e) {
      return {
        ok: false,
        error: { code: 'CONSTANTS_SET_FAILED', message: String(e.message || e) },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    }
  }
};

export default constantsSetTool;
