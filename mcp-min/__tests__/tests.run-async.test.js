import { vi, describe, test, expect, beforeAll } from 'vitest';
import { runTool } from '../run-tool.js';

vi.mock('../../lib/files', () => ({
  default: { getConfig: () => ({ staging: { url: 'https://staging.example.com', token: 'test-token-0123456789', email: 'test@example.com' } }) },
  getConfig: () => ({ staging: { url: 'https://staging.example.com', token: 'test-token-0123456789', email: 'test@example.com' } })
}));

vi.mock('../../lib/settings', () => ({
  default: { settingsFromDotPos: (env) => ({ url: `https://${env}.example.com`, token: 'test-token-0123456789', email: 'test@example.com' }) },
  settingsFromDotPos: (env) => ({ url: `https://${env}.example.com`, token: 'test-token-0123456789', email: 'test@example.com' })
}));

describe('tests-run-async tool', () => {
  let testsRunAsyncTool;

  beforeAll(async () => {
    const module = await import('../tests/run-async.js');
    testsRunAsyncTool = module.default;
  });

  test('has correct description and inputSchema', () => {
    // job-status is now the only way to read the run back; tests-run-async-result is gone.
    expect(testsRunAsyncTool.description).toContain('job-status');
    expect(testsRunAsyncTool.description).not.toContain('tests-run-async-result');
    expect(testsRunAsyncTool.inputSchema.properties).toHaveProperty('env');
    expect(testsRunAsyncTool.inputSchema.properties).not.toHaveProperty('intervalMs');
    expect(testsRunAsyncTool.inputSchema.properties).not.toHaveProperty('maxWaitMs');
  });

  test('triggers run_async and returns immediately with run id', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ id: '42', test_name: 'liquid_test_abc', status: 'pending', result_url: '/_tests/results/42' })
    });

    const result = await runTool(testsRunAsyncTool, 
      { env: 'staging' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(true);
    expect(result.data.id).toBe('42');
    expect(result.data.test_name).toBe('liquid_test_abc');
    expect(result.data.status).toBe('pending');
    expect(result.data.result_url).toBe('/_tests/results/42');
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      uri: expect.stringContaining('/_tests/run_async')
    }));
  });

  test('returns error on HTTP failure', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 500,
      body: 'Internal Server Error'
    });

    const result = await runTool(testsRunAsyncTool, 
      { env: 'staging' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('HTTP_ERROR');
    expect(result.error.details.statusCode).toBe(500);
  });

  test('returns error when response is not JSON', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: '<html>not json</html>'
    });

    const result = await runTool(testsRunAsyncTool, 
      { env: 'staging' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_RESPONSE');
  });

  test('returns error when response has no id', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ status: 'pending' })
    });

    const result = await runTool(testsRunAsyncTool, 
      { env: 'staging' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('MISSING_ID');
  });

  test('returns error on network failure', async () => {
    const mockRequest = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await runTool(testsRunAsyncTool, 
      { env: 'staging' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INTERNAL_ERROR');
    expect(result.error.message).toContain('ECONNREFUSED');
  });

  test('includes auth metadata in response', async () => {
    vi.stubEnv('MPKIT_URL', '');
    vi.stubEnv('MPKIT_EMAIL', '');
    vi.stubEnv('MPKIT_TOKEN', '');

    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ id: '1', test_name: 'liquid_test_meta', status: 'pending' })
    });

    const result = await runTool(testsRunAsyncTool, 
      { env: 'staging' },
      { request: mockRequest }
    );

    vi.unstubAllEnvs();

    expect(result.ok).toBe(true);
    expect(result.meta.auth).toBeDefined();
    expect(result.meta.auth.url).toContain('staging');
    expect(result.meta.auth.token).toMatch(/^tes\.\.\.789$/);
    expect(result.meta.startedAt).toBeDefined();
    expect(result.meta.finishedAt).toBeDefined();
  });

  test('builds result_url from id when not in response', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ id: '77', test_name: 'liquid_test_nurl', status: 'pending' })
    });

    const result = await runTool(testsRunAsyncTool, 
      { env: 'staging' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(true);
    expect(result.data.result_url).toBe('/_tests/results/77');
  });
});
