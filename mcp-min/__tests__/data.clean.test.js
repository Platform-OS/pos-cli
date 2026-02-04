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

describe('data-clean tools', () => {
  let dataCleanTool;
  let dataCleanStatusTool;

  beforeAll(async () => {
    const cleanModule = await import('../data/clean.js');
    const statusModule = await import('../data/clean-status.js');
    dataCleanTool = cleanModule.default;
    dataCleanStatusTool = statusModule.default;
  });

  describe('data-clean', () => {
    test('has correct description and inputSchema', () => {
      expect(dataCleanTool.description).toContain('clean');
      expect(dataCleanTool.description).toContain('DESTRUCTIVE');
      expect(dataCleanTool.inputSchema.properties).toHaveProperty('env');
      expect(dataCleanTool.inputSchema.properties).toHaveProperty('confirmation');
      expect(dataCleanTool.inputSchema.properties).toHaveProperty('includeSchema');
      expect(dataCleanTool.inputSchema.required).toContain('confirmation');
    });

    test('rejects invalid confirmation text', async () => {
      const result = await dataCleanTool.handler({ env: 'staging', confirmation: 'wrong' });

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('CONFIRMATION_REQUIRED');
      expect(result.error.expected).toBe('CLEAN DATA');
      expect(result.error.received).toBe('wrong');
    });

    test('rejects missing confirmation', async () => {
      const result = await dataCleanTool.handler({ env: 'staging' });

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('CONFIRMATION_REQUIRED');
    });

    test('successfully starts clean with correct confirmation', async () => {
      class MockGateway {
        dataClean = vi.fn().mockResolvedValue({ id: 'clean-job-123', status: 'pending' });
      }

      const result = await dataCleanTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', confirmation: 'CLEAN DATA' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(true);
      expect(result.data.id).toBe('clean-job-123');
      expect(result.data.status).toBe('pending');
      expect(result.data.includeSchema).toBe(false);
      expect(result.warning).toContain('remove ALL data');
    });

    test('includes schema warning when includeSchema is true', async () => {
      class MockGateway {
        dataClean = vi.fn().mockResolvedValue({ id: 'clean-job-456', status: 'pending' });
      }

      const result = await dataCleanTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', confirmation: 'CLEAN DATA', includeSchema: true },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(true);
      expect(result.data.includeSchema).toBe(true);
      expect(result.warning).toContain('schema files');
    });

    test('handles 422 error (not supported)', async () => {
      const error = new Error('Not supported');
      error.statusCode = 422;

      class MockGateway {
        dataClean = vi.fn().mockRejectedValue(error);
      }

      const result = await dataCleanTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', confirmation: 'CLEAN DATA' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('NOT_SUPPORTED');
      expect(result.error.statusCode).toBe(422);
    });

    test('handles generic errors', async () => {
      class MockGateway {
        dataClean = vi.fn().mockRejectedValue(new Error('Network error'));
      }

      const result = await dataCleanTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', confirmation: 'CLEAN DATA' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('DATA_CLEAN_ERROR');
      expect(result.error.message).toContain('Network error');
    });
  });

  describe('data-clean-status', () => {
    test('has correct description and inputSchema', () => {
      expect(dataCleanStatusTool.description).toContain('status');
      expect(dataCleanStatusTool.inputSchema.properties).toHaveProperty('jobId');
      expect(dataCleanStatusTool.inputSchema.required).toContain('jobId');
    });

    test('returns validation error when jobId not provided', async () => {
      const result = await dataCleanStatusTool.handler({ url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token' });

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('jobId');
    });

    test('successfully returns status for completed job', async () => {
      class MockGateway {
        dataCleanStatus = vi.fn().mockResolvedValue({ id: 'job-123', status: { name: 'done' } });
      }

      const result = await dataCleanStatusTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', jobId: 'job-123' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(true);
      expect(result.data.id).toBe('job-123');
      expect(result.data.status).toBe('done');
      expect(result.data.done).toBe(true);
      expect(result.data.failed).toBe(false);
      expect(result.data.pending).toBe(false);
    });

    test('correctly identifies pending status', async () => {
      class MockGateway {
        dataCleanStatus = vi.fn().mockResolvedValue({ id: 'job-456', status: 'pending' });
      }

      const result = await dataCleanStatusTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', jobId: 'job-456' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('pending');
      expect(result.data.done).toBe(false);
      expect(result.data.pending).toBe(true);
    });

    test('correctly identifies failed status', async () => {
      class MockGateway {
        dataCleanStatus = vi.fn().mockResolvedValue({ id: 'job-789', status: 'failed' });
      }

      const result = await dataCleanStatusTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', jobId: 'job-789' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('failed');
      expect(result.data.done).toBe(false);
      expect(result.data.failed).toBe(true);
    });

    test('handles errors', async () => {
      class MockGateway {
        dataCleanStatus = vi.fn().mockRejectedValue(new Error('Not found'));
      }

      const result = await dataCleanStatusTool.handler(
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', jobId: 'invalid-job' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('DATA_CLEAN_STATUS_ERROR');
    });
  });
});
