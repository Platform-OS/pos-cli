jest.mock('../lib/apiRequest', () => ({
  apiRequest: jest.fn()
}));

const Gateway = require('../lib/proxy');

describe('Gateway liquid method', () => {
  const { apiRequest } = require('../lib/apiRequest');

  test('calls apiRequest with correct parameters', async () => {
    apiRequest.mockResolvedValue({ result: 'HELLO WORLD', error: null });

    const gateway = new Gateway({ url: 'http://example.com', token: '1234', email: 'test@example.com' });
    const result = await gateway.liquid({ content: "{{ 'hello world' | upcase }}" });

    expect(apiRequest).toHaveBeenCalledWith({
      method: 'POST',
      uri: 'http://example.com/api/app_builder/liquid_exec',
      json: { content: "{{ 'hello world' | upcase }}" },
      forever: true,
      request: expect.any(Function)
    });
    expect(result).toEqual({ result: 'HELLO WORLD', error: null });
  });

  test('handles liquid execution error', async () => {
    apiRequest.mockResolvedValue({ result: null, error: 'Liquid syntax error' });

    const gateway = new Gateway({ url: 'http://example.com', token: '1234', email: 'test@example.com' });
    const result = await gateway.liquid({ content: "{{ 'hello world' | invalid_filter }}" });

    expect(result).toEqual({ result: null, error: 'Liquid syntax error' });
  });
});

describe('exec liquid CLI', () => {
  const exec = require('./utils/exec');
  const cliPath = require('./utils/cliPath');

  const env = Object.assign(process.env, {
    CI: true,
    MPKIT_URL: 'http://example.com',
    MPKIT_TOKEN: '1234',
    MPKIT_EMAIL: 'foo@example.com'
  });

  test('requires code argument', async () => {
    const { code, stderr } = await exec(`${cliPath} exec liquid staging`, { env });

    expect(code).toEqual(1);
    expect(stderr).toMatch("error: missing required argument 'code'");
  });

  test('cancels execution on production environment when user says no', async () => {
    const { code, stdout, stderr } = await exec(`echo "n" | ${cliPath} exec liquid production "{{ 'hello' | upcase }}"`, { env });

    expect(code).toEqual(0);
    expect(stdout).toMatch('Execution cancelled.');
  });

  test('proceeds with execution on production environment when user confirms', async () => {
    const { code, stdout, stderr } = await exec(`echo "y" | ${cliPath} exec liquid production "{{ 'hello' | upcase }}"`, { env });

    // This will fail because the mock API isn't set up, but we want to check it doesn't cancel
    expect(stdout).not.toMatch('Execution cancelled.');
    expect(stderr).not.toMatch('Execution cancelled.');
  });

  test('does not prompt for non-production environments', async () => {
    const { code, stdout, stderr } = await exec(`${cliPath} exec liquid staging "{{ 'hello' | upcase }}"`, { env });

    expect(stdout).not.toMatch('WARNING: You are executing liquid code on a production environment');
    expect(stdout).not.toMatch('Execution cancelled.');
  });
});

// Integration test - requires real platformOS instance
describe('exec liquid integration', () => {
  const exec = require('./utils/exec');
  const cliPath = require('./utils/cliPath');

  // Only run if real credentials are available
  const hasRealCredentials = process.env.MPKIT_URL &&
                            process.env.MPKIT_TOKEN &&
                            !process.env.MPKIT_URL.includes('example.com');

  (hasRealCredentials ? test : test.skip)('executes liquid code on real instance', async () => {
    const { stdout, stderr, code } = await exec(`${cliPath} exec liquid dev "{{ 'hello' | upcase }}"`, {
      env: process.env,
      timeout: 30000
    });

    expect(code).toEqual(0);
    expect(stdout).toMatch('HELLO');
    expect(stderr).toBe('');
  }, 30000);

  (hasRealCredentials ? test : test.skip)('handles liquid syntax error on real instance', async () => {
    const { stdout, stderr, code } = await exec(`${cliPath} exec liquid dev "{{ 'hello' | invalid_filter }}"`, {
      env: process.env,
      timeout: 30000
    });

    expect(code).toEqual(1);
    expect(stderr).toMatch('Liquid execution error');
  }, 30000);

  (hasRealCredentials ? test : test.skip)('executes {{ \'now\' | to_time }} and returns current time', async () => {
    const beforeTime = new Date();
    const { stdout, stderr, code } = await exec(`${cliPath} exec liquid dev "{{ 'now' | to_time }}"`, {
      env: process.env,
      timeout: 30000
    });
    const afterTime = new Date();

    expect(code).toEqual(0);
    expect(stderr).toBe('');

    // Parse the returned time - liquid to_time returns ISO format like "2023-01-01 12:00:00 +0000"
    const returnedTimeStr = stdout.trim();
    const returnedTime = new Date(returnedTimeStr);

    // Check that the returned time is within 1 second of the current time
    const timeDiff = Math.abs(returnedTime.getTime() - beforeTime.getTime());
    expect(timeDiff).toBeLessThanOrEqual(1000); // 1 second in milliseconds

    // Also check it's not in the future beyond our test window
    const futureDiff = afterTime.getTime() - returnedTime.getTime();
    expect(futureDiff).toBeGreaterThanOrEqual(0);
    expect(futureDiff).toBeLessThanOrEqual(1000);
  }, 30000);

  (hasRealCredentials ? test : test.skip)('handles unknown tag error', async () => {
    const { stdout, stderr, code } = await exec(`${cliPath} exec liquid dev "{% hello %}"`, {
      env: process.env,
      timeout: 30000
    });

    expect(code).toEqual(1);
    expect(stderr).toMatch('Liquid execution error: Liquid syntax error: Unknown tag \'hello\'');
  }, 30000);
});
