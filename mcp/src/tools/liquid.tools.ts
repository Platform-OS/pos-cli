import { z } from 'zod';
import { PlatformOSClient } from '../lib/apiWrappers';
import type { Tool } from './env.tools';

export const platformosLiquidRenderTool: Tool = {
  name: 'platformos.liquid.render',
  description: 'Render Liquid template with locals in environment context',
  inputSchema: z.object({
    env: z.string(),
    template: z.string(),
    locals: z.record(z.unknown()).default({}),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  async handler({ env, template, locals }) {
    const client = new PlatformOSClient();
    const res = await client.liquidRender(env, template, locals);
    if (!res.success) throw new Error(res.error || 'Render failed');
    return { output: res.data };
  },
};

export const liquidTools: Tool[] = [platformosLiquidRenderTool];