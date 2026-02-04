/* eslint-env jest */
import path from 'path';
import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';

// Import the tool directly
import uploadsTool from '../uploads/push.js';

// Mock settings that can be injected via context
const mockSettings = {
  fetchSettings: (env) => {
    if (env === 'staging') {
      return { url: 'https://staging.example.com', email: 'test@example.com', token: 'secret123' };
    }
    if (env === 'production') {
      return { url: 'https://prod.example.com', email: 'prod@example.com', token: 'prodtoken' };
    }
    return null;
  }
};

describe('uploads-push', () => {
  let tempFile;

  beforeEach(() => {
    // Create a temp ZIP file for testing
    tempFile = path.join(os.tmpdir(), 'test-uploads.zip');
    fs.writeFileSync(tempFile, 'fake zip content');
  });

  afterEach(() => {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  });

  test('uploads file successfully with env and filePath', async () => {
    class MockGateway {
      async getInstance() {
        return { id: 'test-instance-123' };
      }
    }

    const mockPresignUrl = jest.fn().mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      accessUrl: 'https://cdn.example.com/uploads.zip'
    });
    const mockUploadFile = jest.fn().mockResolvedValue('https://s3.example.com/upload');

    const res = await uploadsTool.handler(
      { env: 'staging', filePath: tempFile },
      { Gateway: MockGateway, presignUrl: mockPresignUrl, uploadFile: mockUploadFile, settings: mockSettings }
    );

    expect(res.ok).toBe(true);
    expect(res.data.instanceId).toBe('test-instance-123');
    expect(res.data.filePath).toBe(tempFile);
    expect(res.data.accessUrl).toBe('https://cdn.example.com/uploads.zip');
    expect(res.meta.startedAt).toBeDefined();
    expect(res.meta.finishedAt).toBeDefined();

    // Verify mocks were called with correct arguments
    expect(mockPresignUrl).toHaveBeenCalledWith(
      'instances/test-instance-123/property_uploads/data.public_property_upload_import.zip',
      tempFile
    );
    expect(mockUploadFile).toHaveBeenCalledWith(tempFile, 'https://s3.example.com/upload');
  });

  test('returns error when file not found', async () => {
    const res = await uploadsTool.handler(
      { env: 'staging', filePath: '/nonexistent/file.zip' },
      { settings: mockSettings }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('FILE_NOT_FOUND');
    expect(res.error.message).toContain('/nonexistent/file.zip');
  });

  test('returns error when env not found', async () => {
    const res = await uploadsTool.handler(
      { env: 'unknown-env', filePath: tempFile },
      { settings: mockSettings }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('UPLOAD_FAILED');
    expect(res.error.message).toContain('unknown-env');
    expect(res.error.message).toContain('not found');
  });

  test('has correct description and schema with required fields', () => {
    expect(uploadsTool.description).toContain('ZIP');
    expect(uploadsTool.inputSchema.required).toContain('env');
    expect(uploadsTool.inputSchema.required).toContain('filePath');
    expect(uploadsTool.inputSchema.properties.env).toBeDefined();
    expect(uploadsTool.inputSchema.properties.filePath).toBeDefined();
  });

  test('handles presignUrl failure', async () => {
    class MockGateway {
      async getInstance() {
        return { id: 'test-instance-123' };
      }
    }

    const mockPresignUrl = jest.fn().mockRejectedValue(new Error('S3 service unavailable'));
    const mockUploadFile = jest.fn();

    const res = await uploadsTool.handler(
      { env: 'staging', filePath: tempFile },
      { Gateway: MockGateway, presignUrl: mockPresignUrl, uploadFile: mockUploadFile, settings: mockSettings }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('UPLOAD_FAILED');
    expect(res.error.message).toContain('S3 service unavailable');
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  test('handles uploadFile failure', async () => {
    class MockGateway {
      async getInstance() {
        return { id: 'test-instance-123' };
      }
    }

    const mockPresignUrl = jest.fn().mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      accessUrl: 'https://cdn.example.com/uploads.zip'
    });
    const mockUploadFile = jest.fn().mockRejectedValue(new Error('Upload timeout'));

    const res = await uploadsTool.handler(
      { env: 'staging', filePath: tempFile },
      { Gateway: MockGateway, presignUrl: mockPresignUrl, uploadFile: mockUploadFile, settings: mockSettings }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('UPLOAD_FAILED');
    expect(res.error.message).toContain('Upload timeout');
  });

  test('sets MARKETPLACE env vars for presignUrl', async () => {
    class MockGateway {
      async getInstance() {
        return { id: 'inst-001' };
      }
    }

    let capturedToken, capturedUrl;
    const mockPresignUrl = jest.fn().mockImplementation(() => {
      capturedToken = process.env.MARKETPLACE_TOKEN;
      capturedUrl = process.env.MARKETPLACE_URL;
      return Promise.resolve({ uploadUrl: 'https://s3.example.com/upload', accessUrl: 'https://cdn.example.com/file.zip' });
    });
    const mockUploadFile = jest.fn().mockResolvedValue('ok');

    await uploadsTool.handler(
      { env: 'staging', filePath: tempFile },
      { Gateway: MockGateway, presignUrl: mockPresignUrl, uploadFile: mockUploadFile, settings: mockSettings }
    );

    expect(capturedToken).toBe('secret123');
    expect(capturedUrl).toBe('https://staging.example.com');
  });

  test('works with production environment', async () => {
    class MockGateway {
      async getInstance() {
        return { id: 'prod-instance' };
      }
    }

    const mockPresignUrl = jest.fn().mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      accessUrl: 'https://cdn.example.com/uploads.zip'
    });
    const mockUploadFile = jest.fn().mockResolvedValue('ok');

    const res = await uploadsTool.handler(
      { env: 'production', filePath: tempFile },
      { Gateway: MockGateway, presignUrl: mockPresignUrl, uploadFile: mockUploadFile, settings: mockSettings }
    );

    expect(res.ok).toBe(true);
    expect(res.data.instanceId).toBe('prod-instance');
  });
});
