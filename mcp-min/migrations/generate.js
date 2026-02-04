// platformos.migrations.generate - create a new migration via Gateway and optionally write the file locally
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const files = require('../../lib/files');
const settings = require('../../lib/settings');
const Gateway = require('../../lib/proxy');
const dir = require('../../lib/directories');

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

function ensureMigrationsDir() {
  const appDirectory = fs.existsSync(dir.APP) ? dir.APP : dir.LEGACY_APP;
  const migrationsDir = path.posix.join(appDirectory, 'migrations');
  return migrationsDir;
}

const generateMigrationTool = {
  description: 'Generate a migration on server and write local file unless skipWrite=true.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string' },
      url: { type: 'string' },
      email: { type: 'string' },
      token: { type: 'string' },
      name: { type: 'string', description: 'Base name of the migration, without timestamp' },
      skipWrite: { type: 'boolean', description: 'When true, do not create local file', default: false },
      endpoint: { type: 'string', description: 'Override API base URL' }
    },
    required: ['name']
  },
  handler: async (params = {}, ctx = {}) => {
    try {
      const auth = resolveAuth(params);
      const baseUrl = params?.endpoint ? params.endpoint : auth.url;
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

      const formData = { name: params.name };
      const raw = await gateway.generateMigration(formData);

      let filePath = null;
      if (!params.skipWrite) {
        const migrationsDir = ensureMigrationsDir();
        // Ensure directory exists
        fs.mkdirSync(migrationsDir, { recursive: true });
        filePath = path.posix.join(migrationsDir, `${raw.name}.liquid`);
        fs.writeFileSync(filePath, raw.body);
      }

      const data = {
        name: raw.name,
        bodyLength: typeof raw.body === 'string' ? raw.body.length : null,
        filePath
      };

      return { status: 'ok', data, raw };
    } catch (e) {
      return { status: 'error', error: { code: 'MIGRATIONS_GENERATE_ERROR', message: String(e?.message || e) } };
    }
  }
};

export default generateMigrationTool;
