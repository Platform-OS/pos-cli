// platformos.constants.unset tool - delete a constant
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { unsetConstant } from '../../lib/graph/queries.js';
import { graphQLErrorMessage } from '../../lib/graph/response.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError } from '../tool-error.js';

const constantsUnsetTool = {
  description: 'Delete a constant from an instance.',
  annotations: { destructiveHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['name'],
    properties: {
      ...authProperties,
      name: { type: 'string', description: 'Which constant to delete.' }
    }
  },
  handler: async (params, ctx = {}) => {
    const auth = await resolveAuth(params, ctx);

    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

    const resp = await gateway.graph(unsetConstant(params.name));

    const errorMessage = graphQLErrorMessage(resp);
    // The instance answered and refused the mutation: its judgement, not a broken call.
    if (errorMessage) throw ToolError.instance('GRAPHQL_ERROR', errorMessage);

    const result = resp?.data?.constant_unset;

    return { name: result?.name || params.name, deleted: !!result };
  }
};

export default constantsUnsetTool;
