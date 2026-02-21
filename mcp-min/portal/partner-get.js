// partner-get tool - Get partner details and billing plans from Partner Portal API
import log from '../log.js';
import { getPortalConfig, portalRequest } from './portal-client.js';

const partnerGetTool = {
  description: 'Get partner details including available billing plans from Partner Portal.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      partner_id: {
        type: 'number',
        description: 'Partner ID to fetch details for'
      }
    },
    required: ['partner_id']
  },

  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    log.debug('tool:partner-get invoked', { partner_id: params.partner_id });

    try {
      const configFn = ctx.getPortalConfig || getPortalConfig;
      const requestFn = ctx.portalRequest || portalRequest;
      const config = ctx.portalConfig || configFn();

      log.debug('partner-get: fetching partner details', { partner_id: params.partner_id });
      const partner = await requestFn({
        method: 'GET',
        path: `/api/partners/${params.partner_id}`,
        config
      });

      // Extract billing plans with full details
      const billingPlans = (partner.instance_billing_plan_types || []).map(plan => ({
        id: plan.id,
        name: plan.name,
        code: plan.code,
        description: plan.description,
        price: plan.price,
        currency: plan.currency
      }));

      return {
        ok: true,
        data: {
          partner: {
            id: partner.id,
            name: partner.name,
            email: partner.email,
            created_at: partner.created_at
          },
          billing_plans: billingPlans,
          billing_plans_count: billingPlans.length
        },
        meta: { startedAt, finishedAt: new Date().toISOString() }
      };
    } catch (e) {
      log.error('partner-get: error', { error: e.message, status: e.status });
      return {
        ok: false,
        error: {
          code: e.status === 404 ? 'PARTNER_NOT_FOUND' : 'PARTNER_GET_ERROR',
          message: String(e.message || e)
        },
        meta: { startedAt, finishedAt: new Date().toISOString() }
      };
    }
  }
};

export default partnerGetTool;
