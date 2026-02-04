// endpoints-list tool - List available regions/endpoints from Partner Portal API
import { DEBUG, debugLog } from '../config.js';
import { getPortalConfig, portalRequest } from './portal-client.js';

const endpointsListTool = {
  description: 'List available regions/endpoints for instance creation from Partner Portal.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {},
    required: []
  },

  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    DEBUG && debugLog('tool:endpoints-list invoked');

    try {
      const configFn = ctx.getPortalConfig || getPortalConfig;
      const requestFn = ctx.portalRequest || portalRequest;
      const config = ctx.portalConfig || configFn();

      DEBUG && debugLog('endpoints-list: fetching endpoints');
      const response = await requestFn({
        method: 'GET',
        path: '/api/endpoints',
        config
      });

      const endpoints = Array.isArray(response) ? response : (response.endpoints || []);

      return {
        ok: true,
        data: {
          endpoints: endpoints.map(e => ({
            id: e.id,
            name: e.name,
            url: e.url,
            region: e.region
          })),
          count: endpoints.length
        },
        meta: { startedAt, finishedAt: new Date().toISOString() }
      };
    } catch (e) {
      DEBUG && debugLog('endpoints-list: error', { error: e.message, status: e.status });
      return {
        ok: false,
        error: {
          code: 'ENDPOINTS_LIST_ERROR',
          message: String(e.message || e)
        },
        meta: { startedAt, finishedAt: new Date().toISOString() }
      };
    }
  }
};

export default endpointsListTool;
