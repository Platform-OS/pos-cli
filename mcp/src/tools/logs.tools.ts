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
  handler: async function*(input) {
    const client = new PlatformOSClient();
    // Note: logs is streaming, here batch version yielding lines
    const gw = await client.getGateway(input.env);
    const json = { lastId: input.lastId };
    const result = await gw.logs(json);
    // Parse logs from result
    const lines = result.split('\n').filter((l: string) => l);
    for (let i = 0; i < Math.min(lines.length, input.limit ?? 100); i++) {
      yield lines[i];
    }
  },
};

export const logsTools: Tool[] = [
  platformosLogsFetchTool
];