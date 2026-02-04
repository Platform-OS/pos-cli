// platformos.migrations.run - run a specific migration by name or timestamp via Gateway
import files from '../../lib/files.js';
import { fetchSettings } from '../../lib/settings.js';
import Gateway from '../../lib/proxy.js';

const settings = { fetchSettings };

function resolveAuth(params) {
  if (params?.url && params?.email && params?.token) {
    return { url: params.url, email: params.email, token: params.token, source: 'params' };
  }
  const { MPKIT_URL, MPKIT_EMAIL, MPKIT_TOKEN } = process.env;
  if (MPKIT_URL && MPKIT_EMAIL && MPKIT_TOKEN) {
    return { url: MPKIT_URL, email: MPKIT_EMAIL, token: MPKIT_TOKEN, source: 'env' };
  }
  if (params?.env) {
    const found = settings.fetchSettings(params.env);
    if (found) return { ...found, source: `.pos(${params.env})` };
  }
  const conf = files.getConfig();
  const firstEnv = conf && Object.keys(conf)[0];
  if (firstEnv) {
    const found = conf[firstEnv];
    if (found) return { ...found, source: `.pos(${firstEnv})` };
  }
  throw new Error('AUTH_MISSING: Provide url,email,token or configure .pos / MPKIT_* env vars');
}

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
      const auth = resolveAuth(params);
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
