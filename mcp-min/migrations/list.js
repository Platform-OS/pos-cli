// platformos.migrations.list - list migrations and their statuses via Gateway
import files from '../../lib/files.js';
import { fetchSettings } from '../../lib/settings.js';
import Gateway from '../../lib/proxy.js';

const settings = { fetchSettings };

async function resolveAuth(params) {
  // precedence: explicit params -> env (MPKIT_*) -> .pos by env -> first .pos
  if (params?.url && params?.email && params?.token) {
    return { url: params.url, email: params.email, token: params.token, source: 'params' };
  }
  const { MPKIT_URL, MPKIT_EMAIL, MPKIT_TOKEN } = process.env;
  if (MPKIT_URL && MPKIT_EMAIL && MPKIT_TOKEN) {
    return { url: MPKIT_URL, email: MPKIT_EMAIL, token: MPKIT_TOKEN, source: 'env' };
  }
  if (params?.env) {
    const found = await settings.fetchSettings(params.env);
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

const listMigrationsTool = {
  description: 'List migrations deployed to the server with their current status.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string' },
      url: { type: 'string' },
      email: { type: 'string' },
      token: { type: 'string' },
      endpoint: { type: 'string', description: 'Override API base URL' }
    }
  },
  handler: async (params = {}, ctx = {}) => {
    try {
      const auth = await resolveAuth(params);
      const baseUrl = params?.endpoint ? params.endpoint : auth.url;
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
