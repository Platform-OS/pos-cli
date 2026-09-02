// platformos.constants.unset tool - delete a constant
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { unsetConstant } from '../../lib/graph/queries.js';
import { graphQLErrorMessage } from '../../lib/graph/response.js';
import { authProperties } from '../schemas/auth.js';

const constantsUnsetTool = {
  description: 'Delete a constant from a platformOS instance. Omitting env (and url/email/token) targets the first environment in .pos, so name the environment explicitly.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['name'],
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      ...authProperties,
      name: { type: 'string', description: 'Name of the constant to delete' }
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();

    try {
      const auth = await resolveAuth(params, ctx);

      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      const resp = await gateway.graph(unsetConstant(params.name));

      const errorMessage = graphQLErrorMessage(resp);
      if (errorMessage) {
        return {
          ok: false,
          error: { code: 'GRAPHQL_ERROR', message: errorMessage }
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
