import * as z from 'zod';

export const configSchema = z.object({
  port: z.number().default(8787),
  adminPort: z.number().default(3000),
  cwd: z.string().default(process.cwd()),
});

export type Config = z.infer<typeof configSchema>;

export const config = configSchema.parse({
  port: parseInt(process.env.MCP_PORT || '8787'),
  adminPort: parseInt(process.env.ADMIN_PORT || '3000'),
  cwd: process.env.CWD || process.cwd(),
});