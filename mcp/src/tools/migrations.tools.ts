import { z } from 'zod';
import { PlatformOSClient } from '../../../lib/apiWrappers';
import type { Tool } from './env.tools';

export const platformosMigrationsListTool: Tool = {
  name: 'platformos.migrations.list',
  description: 'List migrations and their status',
  inputSchema: z.object({
    env: z.string(),
  }),
  outputSchema: z.object({
    migrations: z.array(z.object({})).passthrough(),
  }),
  async handler({ env }) {
    const client = new PlatformOSClient();
    const res = await client.listMigrations(env);
    if (!res.success) throw new Error(res.error || 'List failed');
    return { migrations: res.data || [] };
  },
};

export const platformosMigrationsRunTool: Tool = {
  name: 'platformos.migrations.run',
  description: 'Run a specific migration by version',
  inputSchema: z.object({
    env: z.string(),
    version: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  async handler({ env, version }) {
    const client = new PlatformOSClient();
    const res = await client.runMigration(env, version);
    if (!res.success) throw new Error(res.error || 'Run failed');
    return { success: true };
  },
};

export const migrationsTools: Tool[] = [
  platformosMigrationsListTool,
  platformosMigrationsRunTool,
];