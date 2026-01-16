import { z } from 'zod';
import { PlatformOSClient } from '../../../lib/apiWrappers';
import type { Tool } from './env.tools';

const CONSTANTS_QUERY = `{ constants { name value type } }`;

export const platformosConstantsListTool: Tool = {
  name: 'platformos.constants.list',
  description: 'List all constants in the environment',
  inputSchema: z.object({
    env: z.string(),
  }),
  outputSchema: z.object({
    constants: z.array(z.object({
      name: z.string(),
      value: z.string(),
      type: z.string(),
    })),
  }),
  async handler({ env }) {
    const client = new PlatformOSClient();
    const res = await client.graphql(env, CONSTANTS_QUERY);
    if (!res.success) throw new Error(res.error || 'Query failed');
    return { constants: res.data?.constants || [] };
  },
};

const SET_CONSTANT_MUTATION = `mutation ($name: String!, $value: String!, $type: String) {
  set_constant(name: $name, value: $value, type: $type) {
    name
    value
  }
}`;

export const platformosConstantsSetTool: Tool = {
  name: 'platformos.constants.set',
  description: 'Set a constant value (assumes set_constant mutation exists)',
  inputSchema: z.object({
    env: z.string(),
    name: z.string(),
    value: z.string(),
    type: z.string().default('String'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    constant: z.object({ name: z.string(), value: z.string() }).optional(),
  }),
  async handler(input) {
    const client = new PlatformOSClient();
    const res = await client.graphql(input.env, SET_CONSTANT_MUTATION, {
      name: input.name,
      value: input.value,
      type: input.type,
    });
    if (!res.success) throw new Error(res.error || 'Mutation failed');
    return { success: true, constant: res.data?.set_constant };
  },
};

export const constantsTools: Tool[] = [
  platformosConstantsListTool,
  platformosConstantsSetTool,
];