// platformos.data.clean - start data clean operation (removes data from instance)
import log from '../log.js';
import { resolveAuth, maskToken } from '../auth.js';
import Gateway from '../../lib/proxy.js';

const CONFIRMATION_TEXT = 'CLEAN DATA';

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
    log.debug('tool:data-clean invoked', { env: params?.env, includeSchema: params?.includeSchema });

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

      const auth = await resolveAuth(params, ctx);
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
      log.error('tool:data-clean error', { error: String(e) });

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
