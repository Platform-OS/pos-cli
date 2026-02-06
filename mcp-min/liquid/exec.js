// platformos.liquid.exec tool - execute Liquid on remote instance via Gateway.liquid
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

const execLiquidTool = {
  description: 'Render a Liquid template on a platformOS instance server-side via /api/app_builder/liquid_exec. Returns the rendered output. Useful for testing Liquid code, running one-off queries via {% graphql %}, or inspecting instance state. Auth resolved from: explicit params > MPKIT_* env vars > .pos config.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config (e.g., staging, production). Used to resolve auth when url/email/token are not provided.' },
      url: { type: 'string', description: 'Instance URL (e.g., https://my-app.staging.oregon.platform-os.com). Requires email and token.' },
      email: { type: 'string', description: 'Email for instance authentication. Required with url and token.' },
      token: { type: 'string', description: 'API token for instance authentication. Required with url and email.' },
      endpoint: { type: 'string', description: 'Override the base URL for the Liquid exec endpoint. Defaults to the resolved instance URL.' },
      template: { type: 'string', description: 'Liquid template string to render server-side (e.g., "Hello {{ name }}", "{% graphql g = \'users/search\' %}").' },
      locals: { type: 'object', additionalProperties: true, description: 'Variables available inside the template as top-level Liquid variables (e.g., { "name": "World" } makes {{ name }} render "World").' }
    },
    required: ['template']
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    const auth = await resolveAuth(params);
    const baseUrl = params?.endpoint ? params.endpoint : auth.url;

    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

    const body = {
      content: params.template,
      locals: params.locals || {}
    };

    try {
      const resp = await gateway.liquid(body);
      const finishedAt = new Date().toISOString();

      // Detect logical errors returned by the endpoint (HTTP 200 but Liquid error payload)
      const respError = resp && (resp.error || resp.errors);
      const resultStr = typeof resp?.result === 'string' ? resp.result.toLowerCase() : '';
      const looksLikeError = resultStr.includes('error');

      if (respError || looksLikeError) {
        const message = String(resp?.error || resp?.errors || resp?.result || 'Liquid execution failed');
        return {
          success: false,
          error: { code: 'LIQUID_EXEC_ERROR', message, details: resp },
          meta: {
            startedAt,
            finishedAt,
            auth: { url: baseUrl, email: auth.email, token: maskToken(auth.token), source: auth.source }
          }
        };
      }

      return {
        success: true,
        result: resp,
        meta: {
          startedAt,
          finishedAt,
          auth: { url: baseUrl, email: auth.email, token: maskToken(auth.token), source: auth.source }
        }
      };
    } catch (e) {
      return {
        success: false,
        error: { code: 'LIQUID_EXEC_ERROR', message: String(e) }
      };
    }
  }
};

export default execLiquidTool;
