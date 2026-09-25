// platformos.data.clean - start data clean operation (removes data from instance)
import log from '../log.js';
import { ToolError } from '../tool-error.js';
import { resolveAuth } from '../auth.js';
import { mintFor } from '../jobs/handle.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';

const CONFIRMATION_TEXT = 'CLEAN DATA';

const dataCleanTool = {
  description: 'Delete the records on an instance, and its files too when includeSchema is set. Returns a job_id to poll with job-status.',
  annotations: { destructiveHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      confirmation: {
        type: 'string',
        description: `Must be exactly "${CONFIRMATION_TEXT}".`
      },
      includeSchema: {
        type: 'boolean',
        description: 'Also delete the instance files: pages, schemas and the rest.',
        default: false
      }
    },
    required: ['confirmation']
  },
  handler: async (params, ctx = {}) => {
    log.debug('tool:data-clean invoked', { env: params?.env, includeSchema: params?.includeSchema });

    if (params.confirmation !== CONFIRMATION_TEXT) {
      throw ToolError.input(
        'CONFIRMATION_REQUIRED',
        `Confirmation text must be exactly "${CONFIRMATION_TEXT}". This is a destructive operation.`,
        { expected: CONFIRMATION_TEXT, received: params.confirmation }
      );
    }

    const auth = await resolveAuth(params, ctx);
    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });

    const includeSchema = !!params.includeSchema;

    let response;
    try {
      response = await gateway.dataClean(CONFIRMATION_TEXT, includeSchema);
    } catch (e) {
      // A 422 here is the instance saying it does not offer this at all, which reads as an
      // ordinary refusal otherwise. Nothing else is reinterpreted: the invoker classifies it.
      if (e.statusCode === 422) {
        throw ToolError.instance(
          'NOT_SUPPORTED',
          'Data clean is either not supported by the server or has been disabled.',
          { statusCode: 422 }
        );
      }
      throw e;
    }

    return {
      id: response.id,
      job_id: mintFor({ kind: 'data-clean', id: response.id, origin: auth.url }),
      instanceStatus: response.status || 'pending',
      includeSchema,
      warning: includeSchema
        ? 'This will remove ALL data AND schema files (pages, schemas, etc.) from the instance!'
        : 'This will remove ALL data from the instance!'
    };
  }
};

export default dataCleanTool;
