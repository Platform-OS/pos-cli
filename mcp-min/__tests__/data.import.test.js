import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

import dataImportTool from '../data/import.js';
import dataImportStatusTool from '../data/import-status.js';

const mockSettings = {
  fetchSettings: (env) => {
    if (env === 'staging') {
      return { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token' };
    }
    return null;
  }
};

describe('data-import tool', () => {
  describe('data-import', () => {
    test('has correct description and inputSchema', () => {
      expect(dataImportTool.description).toContain('Import data');
      expect(dataImportTool.inputSchema.properties).toHaveProperty('env');
      expect(dataImportTool.inputSchema.properties).toHaveProperty('filePath');
      expect(dataImportTool.inputSchema.properties).toHaveProperty('jsonData');
      expect(dataImportTool.inputSchema.properties).toHaveProperty('zipFileUrl');
      expect(dataImportTool.inputSchema.required).toContain('env');
    });

    test('returns error when env not found', async () => {
      const result = await dataImportTool.handler(
        { env: 'unknown', jsonData: { records: [] } },
        { settings: mockSettings }
      );
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('DATA_IMPORT_ERROR');
      expect(result.error.message).toContain('unknown');
    });

    test('returns validation error when no data source provided', async () => {
      const result = await dataImportTool.handler(
        { env: 'staging' },
        { settings: mockSettings }
      );
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('Provide one of');
    });

    test('returns validation error when multiple data sources provided', async () => {
      const result = await dataImportTool.handler(
        {
          env: 'staging',
          jsonData: { records: [] },
          zipFileUrl: 'https://example.com/data.zip'
        },
        { settings: mockSettings }
      );
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('only one');
    });

    test('successfully starts import with jsonData', async () => {
      class MockGateway {
        async getInstance() { return { id: 'instance-123' }; }
        async dataImportStart(formData) {
          // Verify it's using ZIP format
          expect(formData.zip_file_url).toBeDefined();
          return { id: 'import-job-789', status: 'pending' };
        }
      }

      const mockPresignUrl = jest.fn().mockResolvedValue({
        uploadUrl: 'https://s3.example.com/upload',
        accessUrl: 'https://s3.example.com/access/data.zip'
      });
      const mockUploadFile = jest.fn().mockResolvedValue(true);

      const result = await dataImportTool.handler(
        { env: 'staging', jsonData: { records: [{ id: '1', properties: { name: 'test' }, model_schema: 'todo' }] }, validate: false },
        { Gateway: MockGateway, settings: mockSettings, presignUrl: mockPresignUrl, uploadFile: mockUploadFile }
      );

      expect(result.ok).toBe(true);
      expect(result.data.id).toBe('import-job-789');
      expect(result.data.status).toBe('pending');
      expect(mockPresignUrl).toHaveBeenCalled();
      expect(mockUploadFile).toHaveBeenCalled();
    });

    test('successfully starts import with zipFileUrl', async () => {
      class MockGateway {
        async dataImportStart(formData) {
          expect(formData.zip_file_url).toBe('https://example.com/data.zip');
          return { id: 'import-job-zip', status: 'pending' };
        }
      }

      const result = await dataImportTool.handler(
        { env: 'staging', zipFileUrl: 'https://example.com/data.zip' },
        { Gateway: MockGateway, settings: mockSettings }
      );

      expect(result.ok).toBe(true);
      expect(result.data.id).toBe('import-job-zip');
    });

    test('returns error when file not found', async () => {
      const result = await dataImportTool.handler(
        { env: 'staging', filePath: '/nonexistent/file.json' },
        { settings: mockSettings }
      );

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('FILE_NOT_FOUND');
    });

    test('blocks import when validation fails (default)', async () => {
      const result = await dataImportTool.handler(
        {
          env: 'staging',
          jsonData: {
            records: [{ id: 'test-id', properties: {}, created_at: 'invalid-date' }]
          }
        },
        { settings: mockSettings }
      );

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.details).toBeDefined();
      expect(result.error.details[0].errors.some(e => e.code === 'INVALID_DATETIME')).toBe(true);
    });

    test('rejects jsonData with invalid top-level structure (empty object)', async () => {
      const result = await dataImportTool.handler(
        { env: 'staging', jsonData: {} },
        { settings: mockSettings }
      );

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('INVALID_STRUCTURE');
      expect(result.error.message).toContain('records');
      expect(result.error.message).toContain('users');
    });

    test('rejects jsonData with unknown top-level keys only', async () => {
      const result = await dataImportTool.handler(
        { env: 'staging', jsonData: { items: [], data: [] } },
        { settings: mockSettings }
      );

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('INVALID_STRUCTURE');
      expect(result.error.message).toContain('must contain at least one of');
    });

    test('rejects jsonData with mix of valid and unknown top-level keys', async () => {
      const result = await dataImportTool.handler(
        { env: 'staging', jsonData: { records: [], extra: 'data' } },
        { settings: mockSettings }
      );

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('INVALID_STRUCTURE');
      expect(result.error.message).toContain('Unknown top-level keys');
      expect(result.error.message).toContain('extra');
    });

    test('accepts jsonData with only users key', async () => {
      class MockGateway {
        async getInstance() { return { id: 'instance-123' }; }
        async dataImportStart() { return { id: 'import-users', status: 'pending' }; }
      }

      const mockPresignUrl = jest.fn().mockResolvedValue({
        uploadUrl: 'https://s3.example.com/upload',
        accessUrl: 'https://s3.example.com/access/data.zip'
      });
      const mockUploadFile = jest.fn().mockResolvedValue(true);

      const result = await dataImportTool.handler(
        { env: 'staging', jsonData: { users: [] } },
        { Gateway: MockGateway, settings: mockSettings, presignUrl: mockPresignUrl, uploadFile: mockUploadFile }
      );

      expect(result.ok).toBe(true);
    });

    test('accepts jsonData with both records and users keys', async () => {
      class MockGateway {
        async getInstance() { return { id: 'instance-123' }; }
        async dataImportStart() { return { id: 'import-both', status: 'pending' }; }
      }

      const mockPresignUrl = jest.fn().mockResolvedValue({
        uploadUrl: 'https://s3.example.com/upload',
        accessUrl: 'https://s3.example.com/access/data.zip'
      });
      const mockUploadFile = jest.fn().mockResolvedValue(true);

      const result = await dataImportTool.handler(
        { env: 'staging', jsonData: { records: [], users: [] } },
        { Gateway: MockGateway, settings: mockSettings, presignUrl: mockPresignUrl, uploadFile: mockUploadFile }
      );

      expect(result.ok).toBe(true);
    });

    test('rejects JSON file with invalid top-level structure', async () => {
      const tmpFile = path.join(os.tmpdir(), 'test-invalid-structure.json');
      fs.writeFileSync(tmpFile, JSON.stringify({ items: [{ id: 1 }] }));

      try {
        const result = await dataImportTool.handler(
          { env: 'staging', filePath: tmpFile },
          { settings: mockSettings }
        );

        expect(result.ok).toBe(false);
        expect(result.error.code).toBe('INVALID_STRUCTURE');
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    test('skips validation when validate: false', async () => {
      class MockGateway {
        async getInstance() { return { id: 'instance-123' }; }
        async dataImportStart() {
          return { id: 'import-no-validate', status: 'pending' };
        }
      }

      const mockPresignUrl = jest.fn().mockResolvedValue({
        uploadUrl: 'https://s3.example.com/upload',
        accessUrl: 'https://s3.example.com/access/data.zip'
      });
      const mockUploadFile = jest.fn().mockResolvedValue(true);

      const result = await dataImportTool.handler(
        {
          env: 'staging',
          jsonData: { records: [{ id: 'invalid-uuid' }] },
          validate: false
        },
        { Gateway: MockGateway, settings: mockSettings, presignUrl: mockPresignUrl, uploadFile: mockUploadFile }
      );

      expect(result.ok).toBe(true);
      expect(result.data.id).toBe('import-no-validate');
    });

    test('blocks import from JSON file when validation fails', async () => {
      // Create temp JSON file with missing upload versions
      const tmpFile = path.join(os.tmpdir(), 'test-invalid-data.json');
      const invalidData = {
        records: [{
          id: 'test-1',
          type: 'photo',
          properties: {
            title: 'Test',
            image: {
              path: 'photos/test.jpg'
              // Missing required versions
            }
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z'
        }]
      };
      fs.writeFileSync(tmpFile, JSON.stringify(invalidData));

      try {
        const result = await dataImportTool.handler(
          {
            env: 'staging',
            filePath: tmpFile,
            appPath: path.join(process.cwd(), 'examples')
          },
          { settings: mockSettings }
        );

        expect(result.ok).toBe(false);
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.details[0].errors.some(e => e.code === 'MISSING_VERSION')).toBe(true);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    test('handles ZIP file path', async () => {
      // Create temp ZIP file
      const tmpFile = path.join(os.tmpdir(), 'test-data.zip');
      fs.writeFileSync(tmpFile, 'fake zip content');

      try {
        class MockGateway {
          async getInstance() { return { id: 'instance-123' }; }
          async dataImportStart(formData) {
            expect(formData.zip_file_url).toContain('s3.example.com');
            return { id: 'import-zip-file', status: 'pending' };
          }
        }

        const mockPresignUrl = jest.fn().mockResolvedValue({
          uploadUrl: 'https://s3.example.com/upload',
          accessUrl: 'https://s3.example.com/access/data.zip'
        });
        const mockUploadFile = jest.fn().mockResolvedValue(true);

        const result = await dataImportTool.handler(
          { env: 'staging', filePath: tmpFile },
          { Gateway: MockGateway, settings: mockSettings, presignUrl: mockPresignUrl, uploadFile: mockUploadFile }
        );

        expect(result.ok).toBe(true);
        expect(result.data.id).toBe('import-zip-file');
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  describe('data-import-status', () => {
    test('has correct description and inputSchema', () => {
      expect(dataImportStatusTool.description).toContain('status');
      expect(dataImportStatusTool.inputSchema.properties).toHaveProperty('jobId');
      expect(dataImportStatusTool.inputSchema.required).toContain('jobId');
    });

    test('returns validation error when jobId not provided', async () => {
      const result = await dataImportStatusTool.handler(
        { env: 'staging' },
        { settings: mockSettings }
      );
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('jobId');
    });

    test('successfully returns status for completed job', async () => {
      class MockGateway {
        async dataImportStatus() {
          return { id: 'job-123', status: { name: 'done' } };
        }
      }

      const result = await dataImportStatusTool.handler(
        { env: 'staging', jobId: 'job-123' },
        { Gateway: MockGateway, settings: mockSettings }
      );

      expect(result.ok).toBe(true);
      expect(result.data.id).toBe('job-123');
      expect(result.data.status).toBe('done');
    });

    test('correctly identifies pending status', async () => {
      class MockGateway {
        async dataImportStatus() {
          return { id: 'job-456', status: 'pending' };
        }
      }

      const result = await dataImportStatusTool.handler(
        { env: 'staging', jobId: 'job-456' },
        { Gateway: MockGateway, settings: mockSettings }
      );

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('pending');
    });
  });
});
