import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { runTool } from '../run-tool.js';
import { rejectionFor } from '../validate-params.js';

// Mock the pos-cli libs before importing tools
vi.mock('../../lib/files', () => ({
  default: { getConfig: () => ({ staging: { url: 'https://staging.example.com', token: 'test-token', email: 'test@example.com' } }) },
  getConfig: () => ({ staging: { url: 'https://staging.example.com', token: 'test-token', email: 'test@example.com' } })
}));

vi.mock('../../lib/settings', () => ({
  default: { settingsFromDotPos: (env) => ({ url: `https://${env}.example.com`, token: 'test-token', email: 'test@example.com' }) },
  settingsFromDotPos: (env) => ({ url: `https://${env}.example.com`, token: 'test-token', email: 'test@example.com' })
}));

describe('data-export tools', () => {
  let dataExportTool;

  beforeAll(async () => {
    const exportModule = await import('../data/export.js');
    dataExportTool = exportModule.default;
  });

  describe('data-export', () => {
    test('has the expected inputSchema', () => {
      expect(dataExportTool.inputSchema.properties).toHaveProperty('env');
      expect(dataExportTool.inputSchema.properties).toHaveProperty('exportInternalIds');
      expect(dataExportTool.inputSchema.properties).toHaveProperty('zip');
    });

    test('successfully starts JSON export', async () => {
      class MockGateway {
        dataExportStart = vi.fn().mockResolvedValue({ id: 'export-job-123', status: 'pending' });
      }

      const result = await runTool(dataExportTool, 
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

      const result = await runTool(dataExportTool, 
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

      const result = await runTool(dataExportTool, 
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

      const result = await runTool(dataExportTool, 
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('INTERNAL_ERROR');
    });
  });

});
