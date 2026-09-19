// platformos.migrations.generate - create a new migration via Gateway and optionally write the file locally
import fs from 'fs';
import path from 'path';
import { resolveAuth } from '../auth.js';
import Gateway from '../../lib/proxy.js';
import dir from '../../lib/directories.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError } from '../tool-error.js';

function ensureMigrationsDir() {
  const appDirectory = fs.existsSync(dir.APP) ? dir.APP : dir.LEGACY_APP;
  const migrationsDir = path.posix.join(appDirectory, 'migrations');
  return migrationsDir;
}

const generateMigrationTool = {
  description: 'Create a migration on an instance and write the generated file into the project.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      name: { type: 'string', description: 'Base name for the migration, without the timestamp.' },
      skipWrite: { type: 'boolean', description: 'Do not write the generated file into the project.', default: false }
    },
    required: ['name']
  },
  handler: async (params = {}, ctx = {}) => {
    const auth = await resolveAuth(params, ctx);
    // The request URL comes from the resolved credentials only (see graphql-exec).
    const baseUrl = auth.url;
    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: baseUrl, token: auth.token, email: auth.email });

    const raw = await gateway.generateMigration({ name: params.name });

    let filePath = null;
    if (!params.skipWrite) {
      const migrationsDir = ensureMigrationsDir();
      filePath = path.posix.join(migrationsDir, `${raw.name}.liquid`);
      try {
        fs.mkdirSync(migrationsDir, { recursive: true });
        fs.writeFileSync(filePath, raw.body);
      } catch (e) {
        // The migration exists on the instance whatever happens here, and a caller that reads
        // "could not write" as "nothing happened" would generate it a second time.
        throw ToolError.project(
          'MIGRATION_NOT_WRITTEN',
          `Created ${raw.name} on the instance, but could not write ${filePath}: ${String(e?.message || e)}`,
          { name: raw.name, filePath }
        );
      }
    }

    return {
      name: raw.name,
      bodyLength: typeof raw.body === 'string' ? raw.body.length : null,
      filePath,
      raw
    };
  }
};

export default generateMigrationTool;
