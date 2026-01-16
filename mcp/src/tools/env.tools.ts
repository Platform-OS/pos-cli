import { z } from 'zod';
import { FsStorage } from '../storage/fsStorage';
import type { PlatformOSEnv } from '../storage/fsStorage';
import { PlatformOSClient } from '../../../lib/apiWrappers';

export interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodObject&lt;any&gt;;
  outputSchema: z.ZodObject&lt;any&gt;;
  handler: (input: any) =&gt; Promise&lt;any&gt;;
}

export const platformosEnvListTool: Tool = {
  name: 'platformos.env.list',
  description: 'List all configured platformOS environments from .pos file',
  inputSchema: z.object({}),
  outputSchema: z.object({
    envs: z.array(z.object({
      name: z.string(),
      account: z.string(),
      site: z.string().optional(),
    })),
  }),
  async handler(input) {
    const storage = new FsStorage();
    const envs = await storage.listEnvs();
    return { envs };
  },
};

export const platformosEnvAddTool: Tool = {
  name: 'platformos.env.add',
  description: 'Add new platformOS environment configuration. Token optional - add manually later if not provided.',
  inputSchema: z.object({
    name: z.string().min(1),
    url: z.string().url(),
    email: z.string().email().optional(),
    account: z.string().optional(),
    site: z.string().optional(),
    token: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  async handler(input) {
    const storage = new FsStorage();
    const existing = (await storage.listEnvs()).find(e =&gt; e.name === input.name);
    if (existing) {
      throw new Error(`Environment ${input.name} already exists`);
    }
    const env: PlatformOSEnv = {
      name: input.name,
      url: input.url,
      ...(input.email &amp;&amp; {email: input.email}),
      ...(input.account &amp;&amp; {account: input.account}),
      ...(input.site &amp;&amp; {site: input.site}),
      ...(input.token &amp;&amp; {token: input.token}),
    };
    await storage.saveEnv(env);
    return { success: true, message: `Environment ${input.name} added successfully` };
  },
};

export const platformosEnvAuthTool: Tool = {
  name: 'platformos.env.auth',
  description: 'Verify authentication for the environment by pinging the API',
  inputSchema: z.object({
    env: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    instance: z.object({}).passthrough().optional(),
  }),
  async handler(input) {
    const client = new PlatformOSClient();
    const gw = await client.getGateway(input.env);
    const instance = await gw.getInstance();
    return { success: true, instance };
  },
};

export const environmentTools: Tool[] = [
  platformosEnvListTool,
  platformosEnvAddTool,
  platformosEnvAuthTool,
];