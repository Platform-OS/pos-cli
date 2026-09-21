
import path from 'path';
import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';

// Import the tool directly
import uploadsTool from '../uploads/push.js';
import { runTool } from '../run-tool.js';

// Mock settings that can be injected via context
const mockSettings = {
  settingsFromDotPos: (env) => {
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

    const mockPresignUrl = vi.fn().mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      accessUrl: 'https://cdn.example.com/uploads.zip'
    });
    const mockUploadFile = vi.fn().mockResolvedValue('https://s3.example.com/upload');

    const res = await runTool(uploadsTool, 
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
    const res = await runTool(uploadsTool, 
      { env: 'staging', filePath: '/nonexistent/file.zip' },
      { settings: mockSettings }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('FILE_NOT_FOUND');
    expect(res.error.message).toContain('/nonexistent/file.zip');
  });

  test('returns error when env not found', async () => {
    const res = await runTool(uploadsTool, 
      { env: 'unknown-env', filePath: tempFile },
      { settings: mockSettings }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('ENV_NOT_FOUND');
    expect(res.error.message).toContain('unknown-env');
    expect(res.error.message).toContain('not found');
  });

  test('has correct description and schema with required fields', () => {
    expect(uploadsTool.description).toContain('ZIP');
    // `env` is optional: resolveAuth also accepts url/email/token or MPKIT_* env vars.
    expect(uploadsTool.inputSchema.required).toEqual(['filePath']);
    expect(uploadsTool.inputSchema.properties.env).toBeDefined();
    expect(uploadsTool.inputSchema.properties.filePath).toBeDefined();
  });

  test('handles presignUrl failure', async () => {
    class MockGateway {
      async getInstance() {
        return { id: 'test-instance-123' };
      }
    }

    const mockPresignUrl = vi.fn().mockRejectedValue(new Error('S3 service unavailable'));
    const mockUploadFile = vi.fn();

    const res = await runTool(uploadsTool, 
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

    const mockPresignUrl = vi.fn().mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      accessUrl: 'https://cdn.example.com/uploads.zip'
    });
    const mockUploadFile = vi.fn().mockRejectedValue(new Error('Upload timeout'));

    const res = await runTool(uploadsTool, 
      { env: 'staging', filePath: tempFile },
      { Gateway: MockGateway, presignUrl: mockPresignUrl, uploadFile: mockUploadFile, settings: mockSettings }
    );

    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('UPLOAD_FAILED');
    expect(res.error.message).toContain('Upload timeout');
  });

  /**
   * The code says which leg failed; the kind says what to do about it, and that judgement is
   * `classify`'s. This tool used to answer `unavailable` — "the same call may work later" — for
   * anything without an HTTP status, so a defect of ours sent the agent round a retry loop that
   * could never finish.
   */
  describe('the kind it reports is the one classify would', () => {
    const failing = (error) => {
      class MockGateway {
        async getInstance() { return { id: 'test-instance-123' }; }
      }
      return runTool(uploadsTool,
        { env: 'staging', filePath: tempFile },
        {
          Gateway: MockGateway,
          presignUrl: vi.fn().mockResolvedValue({ uploadUrl: 'https://s3.example.com/upload', accessUrl: 'https://cdn.example.com/u.zip' }),
          uploadFile: vi.fn().mockRejectedValue(error),
          settings: mockSettings
        }
      );
    };

    const refused = Object.assign(new Error('fetch failed'), { name: 'RequestError', cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) });

    test.each([
      ['a programming error, which is ours to fix', new TypeError('uploadUrl is not a function'), 'internal'],
      ['a rejected token, which retrying cannot mend', Object.assign(new Error('Forbidden'), { statusCode: 403 }), 'auth'],
      ['a refused connection, which may work later', refused, 'unavailable']
    ])('%s', async (_label, error, kind) => {
      const res = await failing(error);

      expect(res.error).toMatchObject({ kind, code: 'UPLOAD_FAILED' });
      // The code and the file it was asked to send stay this tool's to report.
      expect(res.error.details.filePath).toContain('test-uploads.zip');
    });
  });

  test('sets MARKETPLACE env vars for presignUrl', async () => {
    class MockGateway {
      async getInstance() {
        return { id: 'inst-001' };
      }
    }

    let capturedToken, capturedUrl;
    const mockPresignUrl = vi.fn().mockImplementation(() => {
      capturedToken = process.env.MARKETPLACE_TOKEN;
      capturedUrl = process.env.MARKETPLACE_URL;
      return Promise.resolve({ uploadUrl: 'https://s3.example.com/upload', accessUrl: 'https://cdn.example.com/file.zip' });
    });
    const mockUploadFile = vi.fn().mockResolvedValue('ok');

    await runTool(uploadsTool, 
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

    const mockPresignUrl = vi.fn().mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      accessUrl: 'https://cdn.example.com/uploads.zip'
    });
    const mockUploadFile = vi.fn().mockResolvedValue('ok');

    const res = await runTool(uploadsTool, 
      { env: 'production', filePath: tempFile },
      { Gateway: MockGateway, presignUrl: mockPresignUrl, uploadFile: mockUploadFile, settings: mockSettings }
    );

    expect(res.ok).toBe(true);
    expect(res.data.instanceId).toBe('prod-instance');
  });
});
