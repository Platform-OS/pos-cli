// platformos.migrations.generate - create a new migration via Gateway and optionally write the file locally
import fs from 'fs';
import path from 'path';
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import dir from '../../lib/directories.js';

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
      const auth = await resolveAuth(params, ctx);
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
