import nock from 'nock';
import { platformosDataExportStartTool, platformosDataExportStatusTool } from '../tools/data.tools';

jest.mock('../lib/apiWrappers', () => {
  return {
    PlatformOSClient: jest.fn().mockImplementation(() => ({
      dataExportStart: jest.fn(async (export_internal, csv_export) => ({ success: true, data: { id: 'job-123' } })),
      dataExportStatus: jest.fn(async (id) => ({ success: true, data: { status: 'completed', download_url: 'https://example.com/download' } })),
    }))
  };
});

describe('Data tools', () => {
  test('start export returns jobId', async () => {
    const res = await platformosDataExportStartTool.handler({ env: 'staging', export_internal: true, csv_export: false });
    expect(res).toHaveProperty('jobId', 'job-123');
  });

  test('status returns completed', async () => {
    const res = await platformosDataExportStatusTool.handler({ env: 'staging', jobId: 'job-123', csv_export: false });
    expect(res.status).toBe('completed');
    expect(res.download_url).toBe('https://example.com/download');
  });
});
