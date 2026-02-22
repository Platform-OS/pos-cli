// platformos.migrations.run - run a specific migration by name or timestamp via Gateway
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';

function buildFormData({ timestamp, name }) {
  if (!timestamp && !name) throw new Error('INVALID_INPUT: Provide timestamp or name');
  // API expects { timestamp } and supports value being either full name or just numeric timestamp
  return { timestamp: timestamp || name };
}

const runMigrationTool = {
  description: 'Run a specific migration identified by timestamp or full name.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string' },
      url: { type: 'string' },
      email: { type: 'string' },
      token: { type: 'string' },
      timestamp: { type: 'string', description: 'Numeric timestamp' },
      name: { type: 'string', description: 'Alias for timestamp; full migration name without .liquid' },
      endpoint: { type: 'string', description: 'Override API base URL' }
    }
  },
  handler: async (params = {}, ctx = {}) => {
    try {
      const auth = await resolveAuth(params, ctx);
      const baseUrl = params?.endpoint ? params.endpoint : auth.url;
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

      const raw = await gateway.runMigration(buildFormData(params));
      const data = { name: raw?.name || null, status: 'executed' };
      return { status: 'ok', data, raw };
    } catch (e) {
      return { status: 'error', error: { code: 'MIGRATIONS_RUN_ERROR', message: String(e?.message || e) } };
    }
  }
};

export default runMigrationTool;
