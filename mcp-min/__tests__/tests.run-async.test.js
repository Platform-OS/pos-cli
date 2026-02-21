import { vi, describe, test, expect, beforeAll } from 'vitest';

vi.mock('../../lib/files', () => ({
  default: { getConfig: () => ({ staging: { url: 'https://staging.example.com', token: 'test-token', email: 'test@example.com' } }) },
  getConfig: () => ({ staging: { url: 'https://staging.example.com', token: 'test-token', email: 'test@example.com' } })
}));

vi.mock('../../lib/settings', () => ({
  default: { fetchSettings: (env) => ({ url: `https://${env}.example.com`, token: 'test-token', email: 'test@example.com' }) },
  fetchSettings: (env) => ({ url: `https://${env}.example.com`, token: 'test-token', email: 'test@example.com' })
}));

describe('tests-run-async tool', () => {
  let testsRunAsyncTool;

  beforeAll(async () => {
    const module = await import('../tests/run-async.js');
    testsRunAsyncTool = module.default;
  });

  test('has correct description and inputSchema', () => {
    expect(testsRunAsyncTool.description).toContain('run_async');
    expect(testsRunAsyncTool.description).toContain('tests-run-async-result');
    expect(testsRunAsyncTool.inputSchema.properties).toHaveProperty('env');
    expect(testsRunAsyncTool.inputSchema.properties).not.toHaveProperty('intervalMs');
    expect(testsRunAsyncTool.inputSchema.properties).not.toHaveProperty('maxWaitMs');
  });

  test('triggers run_async and returns immediately with run id', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ id: '42', test_name: 'liquid_test_abc', status: 'pending', result_url: '/_tests/results/42' })
    });

    const result = await testsRunAsyncTool.handler(
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

    const result = await testsRunAsyncTool.handler(
      { env: 'staging' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('HTTP_ERROR');
    expect(result.error.statusCode).toBe(500);
  });

  test('returns error when response is not JSON', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: '<html>not json</html>'
    });

    const result = await testsRunAsyncTool.handler(
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

    const result = await testsRunAsyncTool.handler(
      { env: 'staging' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('MISSING_ID');
  });

  test('returns error on network failure', async () => {
    const mockRequest = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await testsRunAsyncTool.handler(
      { env: 'staging' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('TESTS_RUN_ASYNC_ERROR');
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

    const result = await testsRunAsyncTool.handler(
      { env: 'staging' },
      { request: mockRequest }
    );

    vi.unstubAllEnvs();

    expect(result.ok).toBe(true);
    expect(result.meta.auth).toBeDefined();
    expect(result.meta.auth.url).toContain('staging');
    expect(result.meta.auth.token).toMatch(/^tes\.\.\.ken$/);
    expect(result.meta.startedAt).toBeDefined();
    expect(result.meta.finishedAt).toBeDefined();
  });

  test('builds result_url from id when not in response', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ id: '77', test_name: 'liquid_test_nurl', status: 'pending' })
    });

    const result = await testsRunAsyncTool.handler(
      { env: 'staging' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(true);
    expect(result.data.result_url).toBe('/_tests/results/77');
  });
});

describe('tests-run-async-result tool', () => {
  let testsRunAsyncResultTool;

  beforeAll(async () => {
    const module = await import('../tests/run-async-result.js');
    testsRunAsyncResultTool = module.default;
  });

  test('has correct description and inputSchema', () => {
    expect(testsRunAsyncResultTool.description).toContain('results');
    expect(testsRunAsyncResultTool.inputSchema.properties).toHaveProperty('id');
    expect(testsRunAsyncResultTool.inputSchema.required).toContain('id');
  });

  test('returns pending status', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        id: '42', test_name: 'liquid_test_abc', status: 'pending',
        total_assertions: '', total_errors: '', total_duration: '', error_message: '', tests: []
      })
    });

    const result = await testsRunAsyncResultTool.handler(
      { env: 'staging', id: '42' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(true);
    expect(result.data.status).toBe('pending');
    expect(result.data.pending).toBe(true);
    expect(result.data.done).toBe(false);
    expect(result.data.passed).toBe(false);
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      uri: expect.stringContaining('/_tests/results/42')
    }));
  });

  test('returns success status with parsed numbers', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        id: '42', test_name: 'liquid_test_abc', status: 'success',
        total_assertions: '10', total_errors: '0', total_duration: '18', error_message: '',
        tests: [{ errors: {}, success: true, total: 10, test_path: 'modules/core/tests/helpers/url_for_test' }]
      })
    });

    const result = await testsRunAsyncResultTool.handler(
      { env: 'staging', id: '42' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(true);
    expect(result.data.status).toBe('success');
    expect(result.data.passed).toBe(true);
    expect(result.data.done).toBe(true);
    expect(result.data.pending).toBe(false);
    expect(result.data.total_assertions).toBe(10);
    expect(result.data.total_errors).toBe(0);
    expect(result.data.total_duration).toBe(18);
    expect(result.data.tests).toHaveLength(1);
  });

  test('returns failed status', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        id: '10', status: 'failed', total_assertions: '8', total_errors: '2',
        total_duration: '50', error_message: '',
        tests: [{ errors: { msg: 'expected true' }, success: false, total: 8, test_path: 'tests/example' }]
      })
    });

    const result = await testsRunAsyncResultTool.handler(
      { env: 'staging', id: '10' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(true);
    expect(result.data.status).toBe('failed');
    expect(result.data.passed).toBe(false);
    expect(result.data.done).toBe(true);
    expect(result.data.total_errors).toBe(2);
  });

  test('returns error status when runner crashed', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({
        status: 'error', error_message: 'Liquid syntax error: unexpected tag', tests: []
      })
    });

    const result = await testsRunAsyncResultTool.handler(
      { env: 'staging', id: '5' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(true);
    expect(result.data.status).toBe('error');
    expect(result.data.done).toBe(true);
    expect(result.data.error_message).toContain('Liquid syntax error');
  });

  test('returns NOT_FOUND error', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ error: 'not_found' })
    });

    const result = await testsRunAsyncResultTool.handler(
      { env: 'staging', id: '999' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('NOT_FOUND');
  });

  test('returns error on HTTP failure', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 502, body: 'Bad Gateway'
    });

    const result = await testsRunAsyncResultTool.handler(
      { env: 'staging', id: '7' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('HTTP_ERROR');
    expect(result.error.statusCode).toBe(502);
  });

  test('returns error on invalid JSON response', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200, body: 'not json'
    });

    const result = await testsRunAsyncResultTool.handler(
      { env: 'staging', id: '8' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('INVALID_RESPONSE');
  });

  test('returns error on network failure', async () => {
    const mockRequest = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await testsRunAsyncResultTool.handler(
      { env: 'staging', id: '1' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('TESTS_RESULT_ERROR');
    expect(result.error.message).toContain('ECONNREFUSED');
  });

  test('includes auth metadata in response', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ id: '1', status: 'pending', tests: [] })
    });

    const result = await testsRunAsyncResultTool.handler(
      { env: 'staging', id: '1' },
      { request: mockRequest }
    );

    expect(result.ok).toBe(true);
    expect(result.meta.auth.url).toContain('staging');
    expect(result.meta.auth.token).toMatch(/^.{3}\.\.\..{3}$/);
    expect(result.meta.url).toContain('/_tests/results/1');
  });
});
