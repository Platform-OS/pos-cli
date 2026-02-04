// instance-create tool - Create a new platformOS instance via Partner Portal API
import { DEBUG, debugLog } from '../config.js';
import { getPortalConfig, portalRequest } from './portal-client.js';

const instanceCreateTool = {
  description: 'Create a new platformOS instance via Partner Portal API. Returns job acknowledgment.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
        description: 'Instance name (subdomain). Will be validated for availability.'
      },
      partner_id: {
        type: 'number',
        description: 'Partner ID (use partners-list tool to find)'
      },
      endpoint_id: {
        type: 'number',
        description: 'Region/endpoint ID (use endpoints-list tool to find)'
      },
      billing_plan_id: {
        type: 'number',
        description: 'Billing plan ID (use partners-list to see available plans)'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags for the instance'
      }
    },
    required: ['name', 'partner_id', 'endpoint_id', 'billing_plan_id']
  },

  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    DEBUG && debugLog('tool:instance-create invoked', { name: params.name });

    try {
      // Allow injection for testing
      const configFn = ctx.getPortalConfig || getPortalConfig;
      const requestFn = ctx.portalRequest || portalRequest;
      const config = ctx.portalConfig || configFn();

      // 1. Validate instance name availability
      DEBUG && debugLog('instance-create: checking name availability', { name: params.name });
      const nameCheck = await requestFn({
        method: 'GET',
        path: `/api/instance_name_checks/${encodeURIComponent(params.name)}`,
        config
      });

      if (!nameCheck.available) {
        return {
          ok: false,
          error: {
            code: 'NAME_UNAVAILABLE',
            message: `Instance name "${params.name}" is not available`
          },
          meta: { startedAt, finishedAt: new Date().toISOString() }
        };
      }

      // 2. Create instance
      DEBUG && debugLog('instance-create: creating instance', { name: params.name, partner_id: params.partner_id });
      const response = await requestFn({
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
      });

      return {
        ok: true,
        data: {
          acknowledged: response.acknowledged,
          name: params.name,
          message: 'Instance creation started. It may take a few minutes to complete.'
        },
        meta: { startedAt, finishedAt: new Date().toISOString() }
      };
    } catch (e) {
      DEBUG && debugLog('instance-create: error', { error: e.message, status: e.status });
      return {
        ok: false,
        error: {
          code: e.status === 422 ? 'VALIDATION_ERROR' : 'INSTANCE_CREATE_ERROR',
          message: String(e.message || e),
          details: e.data
        },
        meta: { startedAt, finishedAt: new Date().toISOString() }
      };
    }
  }
};

export default instanceCreateTool;
