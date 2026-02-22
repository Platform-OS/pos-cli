// platformos.constants.set tool - set a constant
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';

function buildSetMutation(name, value) {
  // Escape quotes in name and value for GraphQL string
  const escapedName = name.replace(/"/g, '\\"');
  const escapedValue = value.replace(/"/g, '\\"');
  return `mutation {
    constant_set(name: "${escapedName}", value: "${escapedValue}") {
      name, value
    }
  }`;
}

const constantsSetTool = {
  description: 'Set a constant on a platformOS instance. Creates or updates the constant.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['env', 'name', 'value'],
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
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

      const query = buildSetMutation(params.name, params.value);
      const resp = await gateway.graph({ query });

      if (resp && Array.isArray(resp.errors) && resp.errors.length > 0) {
        return {
          ok: false,
          error: {
            code: 'GRAPHQL_ERROR',
            message: resp.errors[0]?.message || 'GraphQL error'
          }
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
