// partners-list tool - List partners from Partner Portal API
import log from '../log.js';
import { getPortalConfig, portalRequest } from './portal-client.js';

/**
 * Lists, and only lists. It used to take `partner_id` and then fetch that one partner from the
 * same endpoint `partner-get` uses, returning a thinner version of the same record — two tools
 * answering one question, with nothing in either description to say which to call. A model has to
 * choose between them on every lookup, and either choice is defensible, which is the failure mode:
 * the overlap was the defect, not the wording.
 */
const partnersListTool = {
  description: 'List the partners this account can use, as id and name. For one partner and its billing plans, use partner-get.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {},
    required: []
  },

  handler: async (_params, ctx = {}) => {
    log.debug('tool:partners-list invoked');

    const configFn = ctx.getPortalConfig || getPortalConfig;
    const requestFn = ctx.portalRequest || portalRequest;
    const config = ctx.portalConfig || configFn();

    const response = await requestFn({ method: 'GET', path: '/api/partners', config });
    const partners = Array.isArray(response) ? response : (response.partners || []);

    return {
      partners: partners.map(p => ({ id: p.id, name: p.name })),
      count: partners.length
    };
  }
};

export default partnersListTool;
