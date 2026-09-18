// platformos.migrations.list - list migrations and their statuses via Gateway
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';

const listMigrationsTool = {
  description: 'List migrations deployed to the server with their current status.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string' },
      ...authProperties
    }
  },
  handler: async (params = {}, ctx = {}) => {
    try {
      const auth = await resolveAuth(params, ctx);
      // The request URL comes from the resolved credentials only (see graphql-exec).
      const baseUrl = auth.url;
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

      const raw = await gateway.listMigrations();
      const migrations = Array.isArray(raw?.migrations) ? raw.migrations.map((m) => ({
        id: m.id,
        name: m.name,
        state: m.state,
        error_messages: m.error_messages || null
      })) : [];

      return { status: 'ok', data: { migrations }, raw };
    } catch (e) {
      return { status: 'error', error: { code: 'MIGRATIONS_LIST_ERROR', message: String(e?.message || e) } };
    }
  }
};

export default listMigrationsTool;
