// platformos.liquid.exec tool - execute Liquid on remote instance via Gateway.liquid
import { resolveAuth, maskToken } from '../auth.js';
import Gateway from '../../lib/proxy.js';

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
    const auth = await resolveAuth(params, ctx);
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
          ok: false,
          error: { code: 'LIQUID_EXEC_ERROR', message, details: resp },
          meta: {
            startedAt,
            finishedAt,
            auth: { url: baseUrl, email: auth.email, token: maskToken(auth.token), source: auth.source }
          }
        };
      }

      return {
        ok: true,
        result: resp,
        meta: {
          startedAt,
          finishedAt,
          auth: { url: baseUrl, email: auth.email, token: maskToken(auth.token), source: auth.source }
        }
      };
    } catch (e) {
      return {
        ok: false,
        error: { code: 'LIQUID_EXEC_ERROR', message: String(e) }
      };
    }
  }
};

export default execLiquidTool;
