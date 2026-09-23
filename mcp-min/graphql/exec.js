// platformos.graphql.exec tool - execute GraphQL via Gateway.graph
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { graphQLErrors, formatGraphQLErrors } from '../../lib/graph/response.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError } from '../tool-error.js';

const execGraphqlTool = {
  description: 'Run a GraphQL query or mutation against a live instance. A mutation run to test a document has already written its data. Errors in the document come back as an input failure carrying them in details. admin_* queries read the instance itself back, source and all: admin_pages, admin_liquid_partials, admin_assets. The schema is introspectable, so __type gives a type\'s fields rather than guessing them.',
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

    // The errors are what the caller acts on, so they travel in the details, where this tool's
    // description says they are.
    const errors = graphQLErrors(resp);
    if (errors) {
      const message = `GraphQLError: ${formatGraphQLErrors(errors) || 'GraphQL execution error'}`;

      // Nothing ran, so the document is what has to change — `input`, not `instance`, which would
      // tell the caller to read the message and not to rewrite the query. `data` is the signal:
      // GraphQL omits it when a request fails before execution and sends it, null included, once
      // execution has begun. `extensions` cannot do this — a parse error and a missing variable
      // carry none (measured against a live instance, 2026-09-23).
      if (!Object.hasOwn(resp, 'data')) throw ToolError.input('GRAPHQL_DOCUMENT_ERROR', message, { errors });

      throw ToolError.instance('GRAPHQL_EXEC_ERROR', message, { errors, data: resp.data });
    }

    return resp;
  }
};

export default execGraphqlTool;
