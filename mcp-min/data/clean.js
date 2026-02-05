// platformos.data.clean - start data clean operation (removes data from instance)
import { DEBUG, debugLog } from '../config.js';
import files from '../../lib/files.js';
import { fetchSettings } from '../../lib/settings.js';
import Gateway from '../../lib/proxy.js';

const settings = { fetchSettings };

const CONFIRMATION_TEXT = 'CLEAN DATA';

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

const dataCleanTool = {
  description: 'Start data clean operation to remove data from a platformOS instance. DESTRUCTIVE - requires confirmation. Returns job ID for status polling.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      url: { type: 'string', description: 'Instance URL (alternative to env)' },
      email: { type: 'string', description: 'Account email (alternative to env)' },
      token: { type: 'string', description: 'API token (alternative to env)' },
      confirmation: {
        type: 'string',
        description: `Confirmation text - must be exactly "${CONFIRMATION_TEXT}" to proceed`
      },
      includeSchema: {
        type: 'boolean',
        description: 'Also remove instance files (pages, schemas, etc.). Default: false',
        default: false
      }
    },
    required: ['confirmation']
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    DEBUG && debugLog('tool:data-clean invoked', { env: params?.env, includeSchema: params?.includeSchema });

    try {
      // Validate confirmation
      if (params.confirmation !== CONFIRMATION_TEXT) {
        return {
          ok: false,
          error: {
            code: 'CONFIRMATION_REQUIRED',
            message: `Confirmation text must be exactly "${CONFIRMATION_TEXT}". This is a destructive operation.`,
            expected: CONFIRMATION_TEXT,
            received: params.confirmation
          }
        };
      }

      const auth = await resolveAuth(params);
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

      const includeSchema = !!params.includeSchema;

      const response = await gateway.dataClean(CONFIRMATION_TEXT, includeSchema);

      return {
        ok: true,
        data: {
          id: response.id,
          status: response.status || 'pending',
          includeSchema
        },
        warning: includeSchema
          ? 'This will remove ALL data AND schema files (pages, schemas, etc.) from the instance!'
          : 'This will remove ALL data from the instance!',
        meta: {
          startedAt,
          finishedAt: new Date().toISOString(),
          auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source }
        }
      };
    } catch (e) {
      DEBUG && debugLog('tool:data-clean error', { error: String(e) });

      // Handle specific error cases
      if (e.statusCode === 422) {
        return {
          ok: false,
          error: {
            code: 'NOT_SUPPORTED',
            message: 'Data clean is either not supported by the server or has been disabled.',
            statusCode: 422
          }
        };
      }

      return { ok: false, error: { code: 'DATA_CLEAN_ERROR', message: String(e.message || e) } };
    }
  }
};

export default dataCleanTool;
