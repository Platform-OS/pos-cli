import { z } from 'zod';
import { PlatformOSClient } from '../../../lib/apiWrappers';
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
    logs: z.array(z.string()).or(z.array(z.object({}))).passthrough(),
    lastId: z.string().optional(),
  }),
  async handler(input) {
    const client = new PlatformOSClient();
    // Note: logs is streaming, here timeout version
    const gw = await client.getGateway(input.env);
    const json = { lastId: input.lastId };
    const result = await gw.logs(json);
    // Parse logs from result
    return { logs: result.split('\n').filter(l =&gt; l), lastId: '' }; // stub parse
  },
};

export const logsTools: Tool[] = [
  platformosLogsFetchTool,
];