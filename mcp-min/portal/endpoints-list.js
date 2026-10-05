// endpoints-list tool - List available regions/endpoints from Partner Portal API
import log from '../log.js';
import { getPortalConfig, portalRequest } from './portal-client.js';

const endpointsListTool = {
  description: 'List the regions an instance can be created in.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {},
    required: []
  },

  handler: async (params, ctx = {}) => {
    log.debug('tool:endpoints-list invoked');

    const configFn = ctx.getPortalConfig || getPortalConfig;
    const requestFn = ctx.portalRequest || portalRequest;
    const config = ctx.portalConfig || configFn();

    const response = await requestFn({ method: 'GET', path: '/api/endpoints', config });

    const endpoints = Array.isArray(response) ? response : (response.endpoints || []);

    return {
      endpoints: endpoints.map(e => ({ id: e.id, name: e.name, url: e.url, region: e.region })),
      count: endpoints.length
    };
  }
};

export default endpointsListTool;
