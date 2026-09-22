// platformos.graphql.exec tool - execute GraphQL via Gateway.graph
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { graphQLErrors, formatGraphQLErrors } from '../../lib/graph/response.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError } from '../tool-error.js';

const execGraphqlTool = {
  description: 'Run a GraphQL query or mutation against a live instance. A mutation run to test a document has already written its data. Errors in the document come back as an instance failure carrying them in details. admin_* queries read the instance itself back, source and all: admin_pages, admin_liquid_partials, admin_assets.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      query: { type: 'string', description: 'The GraphQL document to run.' },
      variables: { type: 'object', additionalProperties: true, description: 'Values for the document variables; safer than interpolating them into the query.' }
    },
    required: ['query']
  },
  handler: async (params, ctx = {}) => {
    const auth = await resolveAuth(params, ctx);
    // The request URL comes from the resolved credentials only. An `endpoint` argument used to
    // replace it while the .pos token was still sent, so a caller could name any host and be
    // handed this machine's token. The other tools that take a URL point here.
    const baseUrl = auth.url;
    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

    const body = { query: params.query, variables: params.variables || {} };

    const resp = await gateway.graph(body);

    // The instance ran the document and refused it. The errors are what the caller acts on, so
    // they travel in the details, where this tool's description says they are.
    const errors = graphQLErrors(resp);
    if (errors) {
      throw ToolError.instance(
        'GRAPHQL_EXEC_ERROR',
        `GraphQLError: ${formatGraphQLErrors(errors) || 'GraphQL execution error'}`,
        { errors, data: resp.data ?? null }
      );
    }

    return resp;
  }
};

export default execGraphqlTool;
