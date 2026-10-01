// instance-create tool - Create a new platformOS instance via Partner Portal API
import log from '../log.js';
import { getPortalConfig, portalRequest } from './portal-client.js';
import { ToolError } from '../tool-error.js';

const instanceCreateTool = {
  description: 'Create a platformOS instance through the Partner Portal. Returns once creation has started; it takes a few minutes to finish.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
        description: 'Subdomain for the instance; checked for availability first.'
      },
      partner_id: {
        type: 'number',
        description: 'From partners-list.'
      },
      endpoint_id: {
        type: 'number',
        description: 'From endpoints-list.'
      },
      billing_plan_id: {
        type: 'number',
        description: 'From partner-get.'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags to attach.'
      }
    },
    required: ['name', 'partner_id', 'endpoint_id', 'billing_plan_id']
  },

  handler: async (params, ctx = {}) => {
    log.debug('tool:instance-create invoked', { name: params.name });

    // Injectable for tests.
    const configFn = ctx.getPortalConfig || getPortalConfig;
    const requestFn = ctx.portalRequest || portalRequest;
    const config = ctx.portalConfig || configFn();

    const withPortalErrors = (promise) => promise.catch((e) => {
      // The Portal rejected the payload rather than failing: the caller can fix it and call again.
      if (e?.status === 422 || e?.statusCode === 422) {
        throw ToolError.input('VALIDATION_ERROR', String(e.message || e), e.data);
      }
      throw e;
    });

    const nameCheck = await withPortalErrors(requestFn({
      method: 'GET',
      path: `/api/instance_name_checks/${encodeURIComponent(params.name)}`,
      config
    }));

    // `input`, not `instance`: the kind says what to do next, and the answer here is to call
    // again with another name. Nothing is wrong with the Portal or with this call otherwise.
    if (!nameCheck.available) {
      throw ToolError.input('NAME_UNAVAILABLE', `Instance name "${params.name}" is not available`, { name: params.name });
    }

    const response = await withPortalErrors(requestFn({
      method: 'POST',
      path: '/api/tasks/instance/create',
      body: {
        instance_billing_plan_type_id: params.billing_plan_id,
        partner_id: params.partner_id,
        instance_params: {
          endpoint_id: params.endpoint_id,
          name: params.name,
          tag_list: params.tags || []
        }
      },
      config
    }));

    return {
      acknowledged: response.acknowledged,
      name: params.name,
      message: 'Instance creation started. It may take a few minutes to complete.'
    };
  }
};

export default instanceCreateTool;
