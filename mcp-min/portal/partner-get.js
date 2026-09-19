// partner-get tool - Get partner details and billing plans from Partner Portal API
import log from '../log.js';
import { getPortalConfig, portalRequest } from './portal-client.js';
import { ToolError } from '../tool-error.js';

const partnerGetTool = {
  description: 'Get one partner and its billing plans.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      partner_id: {
        type: 'number',
        description: 'Which partner to fetch.'
      }
    },
    required: ['partner_id']
  },

  handler: async (params, ctx = {}) => {
    log.debug('tool:partner-get invoked', { partner_id: params.partner_id });

    const configFn = ctx.getPortalConfig || getPortalConfig;
    const requestFn = ctx.portalRequest || portalRequest;
    const config = ctx.portalConfig || configFn();

    const partner = await requestFn({
      method: 'GET',
      path: `/api/partners/${params.partner_id}`,
      config
    }).catch((e) => {
      // The invoker would call a 404 NOT_FOUND; this says which thing was not found.
      if (e?.status === 404 || e?.statusCode === 404) {
        throw ToolError.not_found('PARTNER_NOT_FOUND', String(e.message || e), { partner_id: params.partner_id });
      }
      throw e;
    });

    const billingPlans = (partner.instance_billing_plan_types || []).map(plan => ({
      id: plan.id,
      name: plan.name,
      code: plan.code,
      description: plan.description,
      price: plan.price,
      currency: plan.currency
    }));

    return {
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        created_at: partner.created_at
      },
      billing_plans: billingPlans,
      billing_plans_count: billingPlans.length
    };
  }
};

export default partnerGetTool;
