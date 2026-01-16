import { z } from 'zod';
import { PlatformOSClient } from '../lib/apiWrappers';
import type { Tool } from './env.tools';

export const platformosModulesListTool: Tool = {
  name: 'platformos.modules.list',
  description: 'List installed modules in the environment',
  inputSchema: z.object({
    env: z.string().describe('Environment name'),
  }),
  outputSchema: z.object({
    modules: z.array(z.object({
      name: z.string(),
      version: z.string().optional(),
    }).passthrough()),
  }),
  async handler({ env }) {
    const client = new PlatformOSClient();
    const res = await client.listModules(env);
    if (!res.success) {
      throw new Error(res.error || 'Failed to list modules');
    }
    return { modules: res.data || [] };
  },
};

export const modulesTools: Tool[] = [
  platformosModulesListTool,
];