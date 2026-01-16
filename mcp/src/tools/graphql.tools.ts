import { z } from 'zod';
import { PlatformOSClient, type GraphQLResult } from '../lib/apiWrappers';
import type { Tool } from './env.tools';

export const graphqlExecuteSchema = z.object({
  env: z.string().describe('Environment name from .pos config'),
  query: z.string().describe('GraphQL query string'),
  variables: z.record(z.unknown()).optional().describe('GraphQL variables'),
});

export const graphqlExecuteOutputSchema = z.object({
  success: z.boolean(),
  data: z.record(z.unknown()).optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export const platformosGraphqlExecuteTool: Tool = {
  name: 'platformos.graphql.execute',
  description: 'Execute GraphQL query or mutation against platformOS environment',
  inputSchema: graphqlExecuteSchema,
  outputSchema: graphqlExecuteOutputSchema,
  handler: async (input) => {
    const client = new PlatformOSClient();
    const result = await client.graphql(input.env as string, input.query as string, input.variables);
    return result;
  },
};

export const graphqlTools: Tool[] = [platformosGraphqlExecuteTool];