// platformos.constants.list tool - list all constants
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { getConstants } from '../../lib/graph/queries.js';
import { graphQLErrorMessage } from '../../lib/graph/response.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError } from '../tool-error.js';

const constantsListTool = {
  description: 'List the constants set on an instance.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties
    }
  },
  handler: async (params, ctx = {}) => {
    const auth = await resolveAuth(params, ctx);

    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

    const resp = await gateway.graph(getConstants());

    const errorMessage = graphQLErrorMessage(resp);
    // The instance answered and refused the query: its judgement, not a broken call.
    if (errorMessage) throw ToolError.instance('GRAPHQL_ERROR', errorMessage);

    const constants = resp?.data?.constants?.results || [];

    return {
      constants: constants.map(c => ({ name: c.name, value: c.value, updatedAt: c.updated_at })),
      count: constants.length
    };
  }
};

export default constantsListTool;
