// platformos.migrations.run - run a specific migration by name or timestamp via Gateway
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError } from '../tool-error.js';

function buildFormData({ timestamp, name }) {
  // The schema cannot express "one of these two", so the check lives here.
  if (!timestamp && !name) throw ToolError.input('INVALID_INPUT', 'Provide timestamp or name');
  // API expects { timestamp } and supports value being either full name or just numeric timestamp
  return { timestamp: timestamp || name };
}

const runMigrationTool = {
  description: 'Run one migration on an instance, named by its timestamp or its full name.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      timestamp: { type: 'string', description: 'The migration timestamp on its own.' },
      name: { type: 'string', description: 'The full migration name, without the extension; an alias for timestamp.' }
    }
  },
  handler: async (params = {}, ctx = {}) => {
    const auth = await resolveAuth(params, ctx);
    // The request URL comes from the resolved credentials only (see graphql-exec).
    const baseUrl = auth.url;
    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

    const raw = await gateway.runMigration(buildFormData(params));

    return { name: raw?.name || null, state: 'executed', raw };
  }
};

export default runMigrationTool;
