// platformos.graphql.exec tool - execute GraphQL via Gateway.graph
import files from '../../lib/files.js';
import { fetchSettings } from '../../lib/settings.js';
import Gateway from '../../lib/proxy.js';

const settings = { fetchSettings };

function maskToken(token) {
  if (!token) return token;
  return token.slice(0, 3) + '...' + token.slice(-3);
}

async function resolveAuth(params) {
  if (params?.url && params?.email && params?.token) {
    return { url: params.url, email: params.email, token: params.token, source: 'params' };
  }
  const { MPKIT_URL, MPKIT_EMAIL, MPKIT_TOKEN } = process.env;
  if (MPKIT_URL && MPKIT_EMAIL && MPKIT_TOKEN) {
    return { url: MPKIT_URL, email: MPKIT_EMAIL, token: MPKIT_TOKEN, source: 'env' };
  }
  if (params?.env) {
    const found = await settings.fetchSettings(params.env);
    if (found) return { ...found, source: `.pos(${params.env})` };
  }
  const conf = files.getConfig();
  const firstEnv = conf && Object.keys(conf)[0];
  if (firstEnv) {
    const found = conf[firstEnv];
    if (found) return { ...found, source: `.pos(${firstEnv})` };
  }
  throw new Error('AUTH_MISSING: Provide url,email,token or configure .pos / MPKIT_* env vars');
}

const execGraphqlTool = {
  description: 'Execute a GraphQL query or mutation on a platformOS instance via /api/graph. Returns JSON data and errors from the instance. Auth resolved from: explicit params > MPKIT_* env vars > .pos config. Use variables to pass dynamic values safely instead of string interpolation.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config (e.g., staging, production). Used to resolve auth when url/email/token are not provided.' },
      url: { type: 'string', description: 'Instance URL (e.g., https://my-app.staging.oregon.platform-os.com). Requires email and token.' },
      email: { type: 'string', description: 'Email for instance authentication. Required with url and token.' },
      token: { type: 'string', description: 'API token for instance authentication. Required with url and email.' },
      endpoint: { type: 'string', description: 'Override the base URL for the GraphQL endpoint. Defaults to the resolved instance URL.' },
      query: { type: 'string', description: 'GraphQL query or mutation string (e.g., "{ users { results { id email } } }").' },
      variables: { type: 'object', additionalProperties: true, description: 'Variables to pass to the GraphQL query/mutation. Preferred over string interpolation for dynamic values.' }
    },
    required: ['query']
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    const auth = await resolveAuth(params);
    const baseUrl = params?.endpoint ? params.endpoint : auth.url;
    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

    const body = { query: params.query, variables: params.variables || {} };

    try {
      const resp = await gateway.graph(body);

      if (resp && Array.isArray(resp.errors) && resp.errors.length > 0) {
        // Return error object but do not throw (keep HTTP 200 at MCP layer)
        const firstMsg = resp.errors[0]?.message || 'GraphQL execution error';
        return {
          success: false,
          error: {
            code: 'GRAPHQL_EXEC_ERROR',
            message: `GraphQLError: ${firstMsg}`,
            details: { errors: resp.errors, data: resp.data ?? null }
          },
          meta: {
            startedAt,
            finishedAt: new Date().toISOString(),
            auth: { url: baseUrl, email: auth.email, token: maskToken(auth.token), source: auth.source }
          }
        };
      }

      return {
        success: true,
        result: resp,
        meta: {
          startedAt,
          finishedAt: new Date().toISOString(),
          auth: { url: baseUrl, email: auth.email, token: maskToken(auth.token), source: auth.source }
        }
      };
    } catch (e) {
      // Return error instead of throwing
      return {
        success: false,
        error: { code: 'GRAPHQL_EXEC_ERROR', message: String(e) }
      };
    }
  }
};

export default execGraphqlTool;
