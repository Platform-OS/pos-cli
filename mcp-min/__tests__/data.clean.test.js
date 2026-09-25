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

describe('data-clean tools', () => {
  let dataCleanTool;

  beforeAll(async () => {
    const cleanModule = await import('../data/clean.js');
    dataCleanTool = cleanModule.default;
  });

  describe('data-clean', () => {
    test('has the expected inputSchema, and says it destroys things where a client can act on it', () => {
      // The word DESTRUCTIVE used to be in the prose, where only a person could see it.
      expect(dataCleanTool.annotations).toEqual({ destructiveHint: true });
      expect(dataCleanTool.inputSchema.properties).toHaveProperty('env');
      expect(dataCleanTool.inputSchema.properties).toHaveProperty('confirmation');
      expect(dataCleanTool.inputSchema.properties).toHaveProperty('includeSchema');
      expect(dataCleanTool.inputSchema.required).toContain('confirmation');
    });

    test('rejects invalid confirmation text', async () => {
      const result = await runTool(dataCleanTool, { env: 'staging', confirmation: 'wrong' });

      expect(result.ok).toBe(false);
      expect(result.error.kind).toBe('input');
      expect(result.error.code).toBe('CONFIRMATION_REQUIRED');
      expect(result.error.details).toEqual({ expected: 'CLEAN DATA', received: 'wrong' });
    });

    test('rejects missing confirmation', async () => {
      const result = await runTool(dataCleanTool, { env: 'staging' });

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('CONFIRMATION_REQUIRED');
    });

    test('successfully starts clean with correct confirmation', async () => {
      class MockGateway {
        dataClean = vi.fn().mockResolvedValue({ id: 'clean-job-123', status: 'pending' });
      }

      const result = await runTool(dataCleanTool, 
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', confirmation: 'CLEAN DATA' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(true);
      expect(result.data.id).toBe('clean-job-123');
      expect(result.data.instanceStatus).toBe('pending');
      expect(result.data.includeSchema).toBe(false);
      expect(result.data.warning).toContain('remove ALL data');
    });

    test('includes schema warning when includeSchema is true', async () => {
      class MockGateway {
        dataClean = vi.fn().mockResolvedValue({ id: 'clean-job-456', status: 'pending' });
      }

      const result = await runTool(dataCleanTool, 
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', confirmation: 'CLEAN DATA', includeSchema: true },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(true);
      expect(result.data.includeSchema).toBe(true);
      expect(result.data.warning).toContain('schema files');
    });

    test('handles 422 error (not supported)', async () => {
      const error = new Error('Not supported');
      error.statusCode = 422;

      class MockGateway {
        dataClean = vi.fn().mockRejectedValue(error);
      }

      const result = await runTool(dataCleanTool, 
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', confirmation: 'CLEAN DATA' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(false);
      expect(result.error.kind).toBe('instance');
      expect(result.error.code).toBe('NOT_SUPPORTED');
      expect(result.error.details.statusCode).toBe(422);
    });

    test('an error carrying nothing to classify it by is reported as our defect', async () => {
      class MockGateway {
        dataClean = vi.fn().mockRejectedValue(new Error('something went wrong'));
      }

      const result = await runTool(dataCleanTool, 
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', confirmation: 'CLEAN DATA' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(false);
      // No status, no network code: there is genuinely nothing to tell the caller to do, and
      // saying so beats the old DATA_CLEAN_ERROR, which covered a 401 and a 503 as well.
      expect(result.error.kind).toBe('internal');
      expect(result.error.code).toBe('INTERNAL_ERROR');
      expect(result.error.message).toContain('something went wrong');
    });

    // What the Gateway actually throws when the instance cannot be reached. The old catch-all
    // reported this identically to a bug in pos-cli; an agent can act on the difference.
    test('an unreachable instance is reported as worth retrying', async () => {
      class MockGateway {
        dataClean = vi.fn().mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { code: 'ECONNREFUSED' }));
      }

      const result = await runTool(dataCleanTool,
        { url: 'https://staging.example.com', email: 'test@example.com', token: 'test-token', confirmation: 'CLEAN DATA' },
        { Gateway: MockGateway }
      );

      expect(result.ok).toBe(false);
      expect(result.error.kind).toBe('unavailable');
      expect(result.error.code).toBe('ECONNREFUSED');
    });
  });

});
