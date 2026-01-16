import { z } from 'zod';
import { PlatformOSClient } from '../lib/apiWrappers';
import type { Tool } from './env.tools';

export const platformosLogsFetchTool: Tool = {
  name: 'platformos.logs.fetch',
  description: 'Fetch recent logs from the environment',
  inputSchema: z.object({
    env: z.string().describe('Environment name'),
    lastId: z.string().optional().describe('Last log ID for pagination'),
    limit: z.number().default(100).optional(),
  }),
  outputSchema: z.object({
    logs: z.array(z.union([z.string(), z.record(z.unknown())])),
    lastId: z.string().optional(),
  }),
  handler: async (input) => {
    const client = new PlatformOSClient();
    // Note: logs is streaming, here batch version returning array
    const gw = await client.getGateway(input.env);
    const json = { lastId: input.lastId };
    const result = await gw.logs(json);
    // Parse logs from result
    const lines = result.split('\n').filter((l: string) => l);
    return { logs: lines.slice(0, input.limit ?? 100) };
  },
};

export const logsTools: Tool[] = [
  platformosLogsFetchTool
];