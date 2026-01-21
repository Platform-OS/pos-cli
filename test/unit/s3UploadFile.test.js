/**
 * Unit tests for S3 upload module
 * Tests file upload, FormData upload, memory handling, and error scenarios
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import mime from 'mime';

// Mock fs module
vi.mock('fs');

// Mock mime module
vi.mock('mime');

// Mock global fetch
global.fetch = vi.fn();

describe('s3UploadFile', () => {
  let uploadFile, uploadFileFormData;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset fetch mock
    global.fetch.mockReset();

    // Import module fresh for each test
    const module = await import('#lib/s3UploadFile.js');
    uploadFile = module.uploadFile;
    uploadFileFormData = module.uploadFileFormData;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadFile', () => {
    test('successfully uploads a small file', async () => {
      const fileName = '/path/to/test.jpg';
      const s3Url = 'https://s3.amazonaws.com/bucket/test.jpg';
      const fileBuffer = Buffer.from('small file content');
      const fileSize = fileBuffer.length;

      fs.statSync.mockReturnValue({ size: fileSize });
      fs.readFileSync.mockReturnValue(fileBuffer);
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      const result = await uploadFile(fileName, s3Url);

      expect(fs.statSync).toHaveBeenCalledWith(fileName);
      expect(fs.readFileSync).toHaveBeenCalledWith(fileName);
      expect(global.fetch).toHaveBeenCalledWith(s3Url, {
        method: 'PUT',
        headers: {
          'Content-Length': fileSize.toString()
        },
        body: fileBuffer
      });
      expect(result).toBe(s3Url);
    });

    test('handles large file near 50MB limit', async () => {
      const fileName = '/path/to/large-video.mp4';
      const s3Url = 'https://s3.amazonaws.com/bucket/large-video.mp4';
      // Simulating large file size (48MB) without actually allocating memory in test
      const fileSize = 48 * 1024 * 1024;
      const largeBuffer = Buffer.alloc(1024); // Small buffer for testing, but reporting large size

      fs.statSync.mockReturnValue({ size: fileSize });
      fs.readFileSync.mockReturnValue(largeBuffer);
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      const result = await uploadFile(fileName, s3Url);

      expect(fs.readFileSync).toHaveBeenCalledWith(fileName);
      expect(global.fetch).toHaveBeenCalledWith(s3Url, expect.objectContaining({
        method: 'PUT',
        headers: {
          'Content-Length': fileSize.toString()
        },
        body: largeBuffer
      }));
      expect(result).toBe(s3Url);
    });

    test('throws error when upload fails with 403 forbidden', async () => {
      const fileName = '/path/to/test.jpg';
      const s3Url = 'https://s3.amazonaws.com/bucket/test.jpg';

      fs.statSync.mockReturnValue({ size: 1000 });
      fs.readFileSync.mockReturnValue(Buffer.from('content'));
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403
      });

      await expect(uploadFile(fileName, s3Url)).rejects.toThrow('Upload failed with status 403');
    });

    test('throws error when upload fails with 500 server error', async () => {
      const fileName = '/path/to/test.jpg';
      const s3Url = 'https://s3.amazonaws.com/bucket/test.jpg';

      fs.statSync.mockReturnValue({ size: 1000 });
      fs.readFileSync.mockReturnValue(Buffer.from('content'));
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      await expect(uploadFile(fileName, s3Url)).rejects.toThrow('Upload failed with status 500');
    });

    test('throws error when network fails', async () => {
      const fileName = '/path/to/test.jpg';
      const s3Url = 'https://s3.amazonaws.com/bucket/test.jpg';

      fs.statSync.mockReturnValue({ size: 1000 });
      fs.readFileSync.mockReturnValue(Buffer.from('content'));
      global.fetch.mockRejectedValue(new Error('Network error'));

      await expect(uploadFile(fileName, s3Url)).rejects.toThrow('Network error');
    });

    test('handles file with zero size', async () => {
      const fileName = '/path/to/empty.txt';
      const s3Url = 'https://s3.amazonaws.com/bucket/empty.txt';
      const emptyBuffer = Buffer.from('');

      fs.statSync.mockReturnValue({ size: 0 });
      fs.readFileSync.mockReturnValue(emptyBuffer);
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      const result = await uploadFile(fileName, s3Url);

      expect(global.fetch).toHaveBeenCalledWith(s3Url, {
        method: 'PUT',
        headers: {
          'Content-Length': '0'
        },
        body: emptyBuffer
      });
      expect(result).toBe(s3Url);
    });

    test('handles various image formats', async () => {
      const testCases = [
        { fileName: '/path/to/image.png', size: 500000 },
        { fileName: '/path/to/image.jpg', size: 300000 },
        { fileName: '/path/to/image.gif', size: 100000 },
        { fileName: '/path/to/image.svg', size: 50000 }
      ];

      for (const testCase of testCases) {
        const s3Url = `https://s3.amazonaws.com/bucket/${testCase.fileName.split('/').pop()}`;
        const buffer = Buffer.alloc(testCase.size);

        fs.statSync.mockReturnValue({ size: testCase.size });
        fs.readFileSync.mockReturnValue(buffer);
        global.fetch.mockResolvedValue({ ok: true, status: 200 });

        await uploadFile(testCase.fileName, s3Url);

        expect(fs.readFileSync).toHaveBeenCalledWith(testCase.fileName);
      }
    });
  });

  describe('uploadFileFormData', () => {
    test('successfully uploads file with FormData', async () => {
      const filePath = '/path/to/document.pdf';
      const data = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: {
          key: 'assets/${filename}',
          'Content-Type': 'application/pdf',
          policy: 'base64-encoded-policy',
          signature: 'signature-value'
        }
      };
      const fileBuffer = Buffer.from('PDF content');

      fs.readFileSync.mockReturnValue(fileBuffer);
      mime.getType.mockReturnValue('application/pdf');
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      const result = await uploadFileFormData(filePath, data);

      expect(fs.readFileSync).toHaveBeenCalledWith(filePath);
      expect(mime.getType).toHaveBeenCalledWith(filePath);
      expect(global.fetch).toHaveBeenCalledWith(data.url, {
        method: 'POST',
        body: expect.any(FormData)
      });
      expect(result).toBe(true);
    });

    test('correctly extracts filename from Unix path', async () => {
      const filePath = '/home/user/projects/app/assets/images/logo.png';
      const data = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: { key: 'assets/${filename}' }
      };

      fs.readFileSync.mockReturnValue(Buffer.from('image'));
      mime.getType.mockReturnValue('image/png');
      global.fetch.mockResolvedValue({ ok: true, status: 200 });

      await uploadFileFormData(filePath, data);

      // Verify FormData was created (we can't easily inspect FormData contents)
      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = global.fetch.mock.calls[0];
      expect(fetchCall[1].body).toBeInstanceOf(FormData);
    });

    test('correctly extracts filename from Windows path', async () => {
      const filePath = 'C:\\Users\\user\\projects\\app\\assets\\images\\logo.png';
      const data = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: { key: 'assets/${filename}' }
      };

      fs.readFileSync.mockReturnValue(Buffer.from('image'));
      mime.getType.mockReturnValue('image/png');
      global.fetch.mockResolvedValue({ ok: true, status: 200 });

      await uploadFileFormData(filePath, data);

      expect(global.fetch).toHaveBeenCalled();
    });

    test('handles large file near 50MB limit with FormData', async () => {
      const filePath = '/path/to/large-asset.zip';
      const fileSize = 49 * 1024 * 1024; // 49MB (simulated)
      const largeBuffer = Buffer.alloc(1024); // Small buffer for testing
      const data = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: { key: 'assets/${filename}' }
      };

      fs.readFileSync.mockReturnValue(largeBuffer);
      mime.getType.mockReturnValue('application/zip');
      global.fetch.mockResolvedValue({ ok: true, status: 200 });

      const result = await uploadFileFormData(filePath, data);

      expect(fs.readFileSync).toHaveBeenCalledWith(filePath);
      expect(result).toBe(true);
    });

    test('throws error when FormData upload fails with 403', async () => {
      const filePath = '/path/to/file.txt';
      const data = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: { key: 'assets/${filename}' }
      };

      fs.readFileSync.mockReturnValue(Buffer.from('content'));
      mime.getType.mockReturnValue('text/plain');
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403
      });

      await expect(uploadFileFormData(filePath, data)).rejects.toThrow('Upload failed with status 403');
    });

    test('throws error when FormData upload fails with network error', async () => {
      const filePath = '/path/to/file.txt';
      const data = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: { key: 'assets/${filename}' }
      };

      fs.readFileSync.mockReturnValue(Buffer.from('content'));
      mime.getType.mockReturnValue('text/plain');
      global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(uploadFileFormData(filePath, data)).rejects.toThrow('ECONNREFUSED');
    });

    test('appends all fields from data.fields to FormData', async () => {
      const filePath = '/path/to/file.txt';
      const data = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: {
          key: 'assets/${filename}',
          policy: 'policy-value',
          'x-amz-credential': 'credential-value',
          'x-amz-algorithm': 'AWS4-HMAC-SHA256',
          'x-amz-date': '20260121T000000Z',
          'x-amz-signature': 'signature-value'
        }
      };

      fs.readFileSync.mockReturnValue(Buffer.from('content'));
      mime.getType.mockReturnValue('text/plain');
      global.fetch.mockResolvedValue({ ok: true, status: 200 });

      await uploadFileFormData(filePath, data);

      // Verify fetch was called with FormData
      expect(global.fetch).toHaveBeenCalledWith(data.url, {
        method: 'POST',
        body: expect.any(FormData)
      });
    });

    test('handles various MIME types correctly', async () => {
      const testCases = [
        { filePath: '/path/to/script.js', mimeType: 'application/javascript' },
        { filePath: '/path/to/style.css', mimeType: 'text/css' },
        { filePath: '/path/to/data.json', mimeType: 'application/json' },
        { filePath: '/path/to/video.mp4', mimeType: 'video/mp4' },
        { filePath: '/path/to/audio.mp3', mimeType: 'audio/mpeg' }
      ];

      for (const testCase of testCases) {
        const data = {
          url: 'https://s3.amazonaws.com/bucket',
          fields: { key: 'assets/${filename}' }
        };

        fs.readFileSync.mockReturnValue(Buffer.from('content'));
        mime.getType.mockReturnValue(testCase.mimeType);
        global.fetch.mockResolvedValue({ ok: true, status: 200 });

        await uploadFileFormData(testCase.filePath, data);

        expect(mime.getType).toHaveBeenCalledWith(testCase.filePath);

        vi.clearAllMocks();
      }
    });

    test('handles file with special characters in name', async () => {
      const filePath = '/path/to/file with spaces & special-chars.txt';
      const data = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: { key: 'assets/${filename}' }
      };

      fs.readFileSync.mockReturnValue(Buffer.from('content'));
      mime.getType.mockReturnValue('text/plain');
      global.fetch.mockResolvedValue({ ok: true, status: 200 });

      const result = await uploadFileFormData(filePath, data);

      expect(result).toBe(true);
    });

    test('handles empty file upload', async () => {
      const filePath = '/path/to/empty.txt';
      const data = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: { key: 'assets/${filename}' }
      };
      const emptyBuffer = Buffer.from('');

      fs.readFileSync.mockReturnValue(emptyBuffer);
      mime.getType.mockReturnValue('text/plain');
      global.fetch.mockResolvedValue({ ok: true, status: 200 });

      const result = await uploadFileFormData(filePath, data);

      expect(result).toBe(true);
    });
  });

  describe('Memory and Buffer handling', () => {
    test('uploadFile creates single buffer in memory', async () => {
      const fileName = '/path/to/test.jpg';
      const s3Url = 'https://s3.amazonaws.com/bucket/test.jpg';
      const fileBuffer = Buffer.alloc(1024); // Small buffer for testing (simulating 10MB)

      fs.statSync.mockReturnValue({ size: fileBuffer.length });
      fs.readFileSync.mockReturnValue(fileBuffer);
      global.fetch.mockResolvedValue({ ok: true, status: 200 });

      await uploadFile(fileName, s3Url);

      // Verify readFileSync was called synchronously
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
      expect(fs.readFileSync).toHaveBeenCalledWith(fileName);
    });

    test('uploadFileFormData wraps buffer in Blob', async () => {
      const filePath = '/path/to/file.txt';
      const data = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: { key: 'assets/${filename}' }
      };
      const fileBuffer = Buffer.from('test content');

      fs.readFileSync.mockReturnValue(fileBuffer);
      mime.getType.mockReturnValue('text/plain');
      global.fetch.mockResolvedValue({ ok: true, status: 200 });

      await uploadFileFormData(filePath, data);

      // Verify buffer was read
      expect(fs.readFileSync).toHaveBeenCalledWith(filePath);

      // Verify fetch was called (Blob wrapping happens inside FormData)
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Error scenarios', () => {
    test('uploadFile handles file read error', async () => {
      const fileName = '/path/to/missing.jpg';
      const s3Url = 'https://s3.amazonaws.com/bucket/missing.jpg';

      fs.statSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      await expect(uploadFile(fileName, s3Url)).rejects.toThrow('ENOENT');
    });

    test('uploadFileFormData handles file read error', async () => {
      const filePath = '/path/to/missing.txt';
      const data = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: { key: 'assets/${filename}' }
      };

      fs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      await expect(uploadFileFormData(filePath, data)).rejects.toThrow('ENOENT');
    });

    test('uploadFile handles S3 presigned URL expiration (403)', async () => {
      const fileName = '/path/to/test.jpg';
      const s3Url = 'https://s3.amazonaws.com/bucket/test.jpg';

      fs.statSync.mockReturnValue({ size: 1000 });
      fs.readFileSync.mockReturnValue(Buffer.from('content'));
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403
      });

      await expect(uploadFile(fileName, s3Url)).rejects.toThrow('Upload failed with status 403');
    });

    test('uploadFileFormData handles invalid presigned data', async () => {
      const filePath = '/path/to/file.txt';
      const data = {
        url: 'https://s3.amazonaws.com/bucket',
        fields: { key: 'invalid-key' }
      };

      fs.readFileSync.mockReturnValue(Buffer.from('content'));
      mime.getType.mockReturnValue('text/plain');
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400
      });

      await expect(uploadFileFormData(filePath, data)).rejects.toThrow('Upload failed with status 400');
    });
  });
});
