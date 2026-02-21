import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import envAddTool from '../portal/env-add.js';

describe('env-add', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-add-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('direct token', () => {
    test('adds environment with provided token', async () => {
      const res = await envAddTool.handler({
        environment: 'staging',
        url: 'https://my-app.example.com',
        token: 'direct-token-123'
      });

      expect(res.ok).toBe(true);
      expect(res.data.environment).toBe('staging');
      expect(res.data.url).toBe('https://my-app.example.com/');
      expect(res.data.message).toContain('added successfully');

      // Verify .pos file
      const config = JSON.parse(fs.readFileSync(path.join(tempDir, '.pos'), 'utf8'));
      expect(config.staging.url).toBe('https://my-app.example.com/');
      expect(config.staging.token).toBe('direct-token-123');
    });

    test('adds trailing slash to URL', async () => {
      const res = await envAddTool.handler({
        environment: 'prod',
        url: 'https://example.com',
        token: 'token123'
      });

      expect(res.ok).toBe(true);
      expect(res.data.url).toBe('https://example.com/');
    });

    test('preserves existing environments in .pos', async () => {
      // Create existing .pos
      fs.writeFileSync(path.join(tempDir, '.pos'), JSON.stringify({
        existing: { url: 'https://existing.com/', token: 'old-token' }
      }));

      const res = await envAddTool.handler({
        environment: 'staging',
        url: 'https://new.com',
        token: 'new-token'
      });

      expect(res.ok).toBe(true);

      const config = JSON.parse(fs.readFileSync(path.join(tempDir, '.pos'), 'utf8'));
      expect(config.existing.token).toBe('old-token');
      expect(config.staging.token).toBe('new-token');
    });

    test('includes email and partner_portal_url when provided', async () => {
      const res = await envAddTool.handler({
        environment: 'staging',
        url: 'https://example.com',
        token: 'token123',
        email: 'user@example.com',
        partner_portal_url: 'https://custom-portal.com'
      });

      expect(res.ok).toBe(true);

      const config = JSON.parse(fs.readFileSync(path.join(tempDir, '.pos'), 'utf8'));
      expect(config.staging.email).toBe('user@example.com');
      expect(config.staging.partner_portal_url).toBe('https://custom-portal.com');
    });
  });

  describe('URL validation', () => {
    test('rejects invalid URL', async () => {
      const res = await envAddTool.handler({
        environment: 'staging',
        url: 'not-a-valid-url',
        token: 'token123'
      });

      expect(res.ok).toBe(false);
      expect(res.error.code).toBe('INVALID_URL');
    });
  });

  describe('device authorization with background waiter', () => {
    test('returns verification URL immediately and spawns background waiter', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          verification_uri_complete: 'https://portal.example.com/verify?code=ABC123',
          device_code: 'device-code-xyz',
          interval: 5
        })
      });

      const res = await envAddTool.handler(
        { environment: 'staging', url: 'https://my-app.example.com' },
        { fetch: mockFetch }
      );

      expect(res.ok).toBe(true);
      expect(res.data.status).toBe('awaiting_authorization');
      expect(res.data.verification_url).toBe('https://portal.example.com/verify?code=ABC123');
      expect(res.data.waiter_id).toBeDefined();
      expect(res.data.timeout_seconds).toBe(60);
      expect(res.data.message).toContain('Background waiter active');

      // Should NOT create .pos file immediately (waiter does it)
      expect(fs.existsSync(path.join(tempDir, '.pos'))).toBe(false);
    });

    test('handles instance not registered error', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found')
      });

      const res = await envAddTool.handler(
        { environment: 'staging', url: 'https://unregistered.example.com' },
        { fetch: mockFetch }
      );

      expect(res.ok).toBe(false);
      expect(res.error.code).toBe('INSTANCE_NOT_REGISTERED');
      expect(res.error.message).toContain('not registered');
    });

    test('background waiter saves .pos when authorization completes', async () => {
      let pollCount = 0;
      const mockFetch = vi.fn()
        // First call: device auth
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            verification_uri_complete: 'https://portal.example.com/verify',
            device_code: 'device-123',
            interval: 0.1 // Fast for testing
          })
        });

      // Mock storeEnvironment to verify it's called
      const storeEnvironment = vi.fn();

      const res = await envAddTool.handler(
        { environment: 'staging', url: 'https://my-app.example.com', timeout_seconds: 2 },
        {
          fetch: async (url, opts) => {
            // First call is device auth
            if (pollCount === 0) {
              pollCount++;
              return mockFetch(url, opts);
            }
            // Subsequent calls are token polls - return success immediately
            return {
              ok: true,
              status: 200,
              json: () => Promise.resolve({ access_token: 'the-token' })
            };
          },
          storeEnvironment
        }
      );

      expect(res.ok).toBe(true);
      expect(res.data.status).toBe('awaiting_authorization');

      // Wait for background waiter to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // storeEnvironment should have been called by background waiter
      expect(storeEnvironment).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'staging',
          token: 'the-token'
        })
      );
    });
  });

  describe('schema', () => {
    test('has correct required fields', () => {
      expect(envAddTool.inputSchema.required).toContain('environment');
      expect(envAddTool.inputSchema.required).toContain('url');
      expect(envAddTool.inputSchema.required).not.toContain('token');
    });

    test('has optional fields', () => {
      const props = envAddTool.inputSchema.properties;
      expect(props.token).toBeDefined();
      expect(props.email).toBeDefined();
      expect(props.partner_portal_url).toBeDefined();
      expect(props.timeout_seconds).toBeDefined();
    });
  });

  describe('meta timestamps', () => {
    test('includes timestamps in response', async () => {
      const res = await envAddTool.handler({
        environment: 'staging',
        url: 'https://example.com',
        token: 'token123'
      });

      expect(res.meta.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(res.meta.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('portal URL priority', () => {
    const originalEnv = process.env.PARTNER_PORTAL_URL;

    afterEach(() => {
      if (originalEnv) {
        process.env.PARTNER_PORTAL_URL = originalEnv;
      } else {
        delete process.env.PARTNER_PORTAL_URL;
      }
    });

    test('uses PARTNER_PORTAL_URL env var when set', async () => {
      process.env.PARTNER_PORTAL_URL = 'https://env-portal.example.com';

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          verification_uri_complete: 'https://env-portal.example.com/verify',
          device_code: 'test',
          interval: 5
        })
      });

      await envAddTool.handler(
        { environment: 'staging', url: 'https://my-app.example.com' },
        { fetch: mockFetch }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://env-portal.example.com/oauth/authorize_device',
        expect.any(Object)
      );
    });

    test('parameter overrides env var', async () => {
      process.env.PARTNER_PORTAL_URL = 'https://env-portal.example.com';

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          verification_uri_complete: 'https://param-portal.example.com/verify',
          device_code: 'test',
          interval: 5
        })
      });

      await envAddTool.handler(
        {
          environment: 'staging',
          url: 'https://my-app.example.com',
          partner_portal_url: 'https://param-portal.example.com'
        },
        { fetch: mockFetch }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://param-portal.example.com/oauth/authorize_device',
        expect.any(Object)
      );
    });
  });
});
