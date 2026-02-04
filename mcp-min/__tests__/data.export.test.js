import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Mock the pos-cli libs before importing tools
vi.mock('../../lib/files', () => ({
  default: { getConfig: () => ({ staging: { url: 'https://staging.example.com', token: 'test-token', email: 'test@example.com' } }) },
  getConfig: () => ({ staging: { url: 'https://staging.example.com', token: 'test-token', email: 'test@example.com' } })
}));

vi.mock('../../lib/settings', () => ({
  default: { fetchSettings: (env) => ({ url: `https://${env}.example.com`, token: 'test-token', email: 'test@example.com' }) },
  fetchSettings: (env) => ({ url: `https://${env}.example.com`, token: 'test-token', email: 'test@example.com' })
}));

describe('data-export tools', () => {
  let dataExportTool;
  let dataExportStatusTool;

  beforeAll(async () => {
    const exportModule = await import('../data/export.js');
    const statusModule = await import('../data/export-status.js');
    dataExportTool = exportModule.default;
    dataExportStatusTool = statusModule.default;
  });

  describe('data-export', () => {
    test('has correct description and inputSchema', () => {
      expect(dataExportTool.description).toContain('export');
      expect(dataExportTool.inputSchema.properties).toHaveProperty('env');
      expect(dataExportTool.inputSchema.properties).toHaveProperty('exportInternalIds');
      expect(dataExportTool.inputSchema.properties).toHaveProperty('zip');
    });

    test('successfully starts JSON export', async () => {
      class MockGateway {
        dataExportStart = vi.fn().mockResolvedValue({ id: 'export-job-123', status: 'pending' });
      }

      const result = await dataExportTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(true);
      expect(result.data.id).toBe('export-job-123');
      expect(result.data.status).toBe('pending');
      expect(result.data.isZip).toBe(false);
    });

    test('successfully starts ZIP export', async () => {
      class MockGateway {
        dataExportStart = vi.fn().mockResolvedValue({ id: 'export-zip-456', status: 'pending' });
      }

      const result = await dataExportTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', zip: true },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(true);
      expect(result.data.id).toBe('export-zip-456');
      expect(result.data.isZip).toBe(true);
    });

    test('handles 404 error (not supported)', async () => {
      const error = new Error('Not found');
      error.statusCode = 404;

      class MockGateway {
        dataExportStart = vi.fn().mockRejectedValue(error);
      }

      const result = await dataExportTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('NOT_SUPPORTED');
    });

    test('handles generic errors', async () => {
      class MockGateway {
        dataExportStart = vi.fn().mockRejectedValue(new Error('Network error'));
      }

      const result = await dataExportTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('DATA_EXPORT_ERROR');
    });
  });

  describe('data-export-status', () => {
    test('has correct description and inputSchema', () => {
      expect(dataExportStatusTool.description).toContain('status');
      expect(dataExportStatusTool.inputSchema.properties).toHaveProperty('jobId');
      expect(dataExportStatusTool.inputSchema.required).toContain('jobId');
    });

    test('returns validation error when jobId not provided', async () => {
      const result = await dataExportStatusTool.handler({ url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token' });

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns pending status', async () => {
      class MockGateway {
        dataExportStatus = vi.fn().mockResolvedValue({ id: 'job-123', status: 'pending' });
      }

      const result = await dataExportStatusTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', jobId: 'job-123' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('pending');
      expect(result.data.pending).toBe(true);
      expect(result.data.done).toBe(false);
    });

    test('returns completed JSON export with data', async () => {
      class MockGateway {
        dataExportStatus = vi.fn().mockResolvedValue({
          id: 'job-456',
          status: 'done',
          data: {
            users: { results: [{ id: 1, email: 'test@example.com' }] },
            transactables: { results: [] },
            models: { results: [{ id: 2, name: 'product' }] }
          }
        });
      }

      const result = await dataExportStatusTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', jobId: 'job-456' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('done');
      expect(result.data.done).toBe(true);
      expect(result.data.exportedData.users).toHaveLength(1);
      expect(result.data.exportedData.models).toHaveLength(1);
    });

    test('returns completed ZIP export with download URL', async () => {
      class MockGateway {
        dataExportStatus = vi.fn().mockResolvedValue({
          id: 'job-789',
          status: 'done',
          zip_file_url: 'https://s3.example.com/export.zip'
        });
      }

      const result = await dataExportStatusTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', jobId: 'job-789', isZip: true },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('done');
      expect(result.data.zipFileUrl).toBe('https://s3.example.com/export.zip');
    });

    test('handles failed status', async () => {
      class MockGateway {
        dataExportStatus = vi.fn().mockResolvedValue({ id: 'job-fail', status: 'failed' });
      }

      const result = await dataExportStatusTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', jobId: 'job-fail' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('failed');
      expect(result.data.failed).toBe(true);
    });
  });
});
