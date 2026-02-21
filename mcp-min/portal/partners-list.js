// partners-list tool - List partners and their billing plans from Partner Portal API
import log from '../log.js';
import { getPortalConfig, portalRequest } from './portal-client.js';

const partnersListTool = {
  description: 'List partners from Partner Portal. Optionally fetch billing plans for a specific partner.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      partner_id: {
        type: 'number',
        description: 'Optional: fetch details and billing plans for a specific partner'
      }
    },
    required: []
  },

  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    log.debug('tool:partners-list invoked', { partner_id: params.partner_id });

    try {
      const configFn = ctx.getPortalConfig || getPortalConfig;
      const requestFn = ctx.portalRequest || portalRequest;
      const config = ctx.portalConfig || configFn();

      if (params.partner_id) {
        // Fetch specific partner with billing plans
        log.debug('partners-list: fetching partner details', { partner_id: params.partner_id });
        const partner = await requestFn({
          method: 'GET',
          path: `/api/partners/${params.partner_id}`,
          config
        });

        return {
          ok: true,
          data: {
            partner: {
              id: partner.id,
              name: partner.name,
              billing_plans: (partner.instance_billing_plan_types || []).map(plan => ({
                id: plan.id,
                name: plan.name,
                code: plan.code
              }))
            }
          },
          meta: { startedAt, finishedAt: new Date().toISOString() }
        };
      }

      // List all partners
      log.debug('partners-list: fetching all partners');
      const response = await requestFn({
        method: 'GET',
        path: '/api/partners',
        config
      });

      const partners = Array.isArray(response) ? response : (response.partners || []);

      return {
        ok: true,
        data: {
          partners: partners.map(p => ({
            id: p.id,
            name: p.name
          })),
          count: partners.length
        },
        meta: { startedAt, finishedAt: new Date().toISOString() }
      };
    } catch (e) {
      log.error('partners-list: error', { error: e.message, status: e.status });
      return {
        ok: false,
        error: {
          code: e.status === 404 ? 'PARTNER_NOT_FOUND' : 'PARTNERS_LIST_ERROR',
          message: String(e.message || e)
        },
        meta: { startedAt, finishedAt: new Date().toISOString() }
      };
    }
  }
};

export default partnersListTool;
