import { z } from 'zod';
import { PlatformOSClient } from '../../../lib/apiWrappers';
import type { Tool } from './env.tools';

export const platformosDataExportStartTool: Tool = {
  name: 'platformos.data.export_start',
  description: 'Start a data export job. Returns jobId for status polling.',
  inputSchema: z.object({
    env: z.string().describe('Environment name'),
    export_internal: z.boolean().default(true).describe('Export internal data'),
    csv_export: z.boolean().default(false).describe('Export as CSV'),
  }),
  outputSchema: z.object({
    jobId: z.string(),
    poll: z.literal(true),
  }),
  async handler(input) {
    const client = new PlatformOSClient();
    const res = await client.dataExportStart(input.env, input.export_internal, input.csv_export);
    if (!res.success) {
      throw new Error(res.error || 'Failed to start export');
    }
    return { jobId: res.data.id, poll: true };
  },
};

export const platformosDataExportStatusTool: Tool = {
  name: 'platformos.data.export_status',
  description: 'Poll export job status until complete.',
  inputSchema: z.object({
    env: z.string().describe('Environment name'),
    jobId: z.string().describe('Job ID from export_start'),
    csv_export: z.boolean().default(false),
  }),
  outputSchema: z.object({
    status: z.enum(['pending', 'completed', 'failed']),
    download_url: z.string().optional(),
    error: z.string().optional(),
  }).passthrough(),
  async handler(input) {
    const client = new PlatformOSClient();
    const res = await client.dataExportStatus(input.env, input.jobId, input.csv_export);
    if (!res.success) {
      throw new Error(res.error || 'Failed to check status');
    }
    const data = res.data;
    let status: 'pending' | 'completed' | 'failed' = 'pending';
    if (data.status === 'completed') status = 'completed';
    else if (data.status === 'failed' || data.error) status = 'failed';
    return {
      status,
      ...(data.download_url &amp;&amp; { download_url: data.download_url }),
      ...(status === 'failed' &amp;&amp; { error: data.error || 'Export failed' }),
      ...data,
    };
  },
};

export const dataTools: Tool[] = [
  platformosDataExportStartTool,
  platformosDataExportStatusTool,
];