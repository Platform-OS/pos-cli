// platformos.constants.unset tool - delete a constant
import { fetchSettings } from '../../lib/settings.js';
import Gateway from '../../lib/proxy.js';

const settings = { fetchSettings };

async function resolveAuth(env, settingsModule = settings) {
  const found = await settingsModule.fetchSettings(env);
  if (found) return { ...found, source: `.pos(${env})` };
  throw new Error(`Environment "${env}" not found in .pos config`);
}

function buildUnsetMutation(name) {
  const escapedName = name.replace(/"/g, '\\"');
  return `mutation {
    constant_unset(name: "${escapedName}") {
      name
    }
  }`;
}

const constantsUnsetTool = {
  description: 'Delete a constant from a platformOS instance.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['env', 'name'],
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      name: { type: 'string', description: 'Name of the constant to delete' }
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();

    try {
      const auth = await resolveAuth(params.env, ctx.settings || settings);

      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      const query = buildUnsetMutation(params.name);
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

      const result = resp?.data?.constant_unset;

      return {
        ok: true,
        data: {
          name: result?.name || params.name,
          deleted: !!result
        },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    } catch (e) {
      return {
        ok: false,
        error: { code: 'CONSTANTS_UNSET_FAILED', message: String(e.message || e) },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    }
  }
};

export default constantsUnsetTool;
