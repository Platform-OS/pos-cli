// platformos.constants.set tool - set a constant
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { setConstant } from '../../lib/graph/queries.js';
import { graphQLErrorMessage } from '../../lib/graph/response.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError } from '../tool-error.js';

const constantsSetTool = {
  description: 'Set a constant on an instance, creating it or replacing its current value.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'value'],
    properties: {
      ...authProperties,
      name: { type: 'string', description: 'Name of the constant, e.g. API_KEY.' },
      value: { type: 'string', description: 'What to set it to.' }
    }
  },
  handler: async (params, ctx = {}) => {
    const auth = await resolveAuth(params, ctx);

    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

    const resp = await gateway.graph(setConstant(params.name, params.value));

    const errorMessage = graphQLErrorMessage(resp);
    // The instance answered and refused the mutation: its judgement, not a broken call.
    if (errorMessage) throw ToolError.instance('GRAPHQL_ERROR', errorMessage);

    const result = resp?.data?.constant_set;

    return { name: result?.name, value: result?.value };
  }
};

export default constantsSetTool;
