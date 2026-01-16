jest.mock('../lib/apiRequest', () => ({
  apiRequest: jest.fn()
}));

const Gateway = require('../lib/proxy');

describe('Gateway liquid method', () => {
  const { apiRequest } = require('../lib/apiRequest');

  beforeEach(() => {
    jest.clearAllMocks();
  });

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
  const path = require('path');
  const fs = require('fs');
  const os = require('os');

  // Use spread operator to avoid mutating global process.env
  const env = {
    ...process.env,
    CI: 'true',
    MPKIT_URL: 'http://example.com',
    MPKIT_TOKEN: '1234',
    MPKIT_EMAIL: 'foo@example.com'
  };

  const CLI_TIMEOUT = 10000;

  describe('argument validation', () => {
    test('requires code argument', async () => {
      const { code, stderr } = await exec(`${cliPath} exec liquid staging`, { env, timeout: CLI_TIMEOUT });

      expect(code).toBe(1);
      expect(stderr).toMatch("error: missing required argument 'code'");
    });

    test('requires environment argument', async () => {
      const { code, stderr } = await exec(`${cliPath} exec liquid`, { env, timeout: CLI_TIMEOUT });

      expect(code).toBe(1);
      expect(stderr).toMatch("error: missing required argument 'environment'");
    });
  });

  describe('production environment confirmation', () => {
    // Detailed production environment detection tests are in productionEnvironment.test.js
    // These tests verify the CLI integration with the production environment helper

    test('prompts for confirmation on production environment and cancels when user declines', async () => {
      const { code, stdout } = await exec(`echo "n" | ${cliPath} exec liquid production "{{ 'hello' | upcase }}"`, { env, timeout: CLI_TIMEOUT });

      expect(code).toBe(0);
      expect(stdout).toMatch('Execution cancelled.');
    });

    test('proceeds with execution on production environment when user confirms', async () => {
      const { stdout, stderr } = await exec(`echo "y" | ${cliPath} exec liquid production "{{ 'hello' | upcase }}"`, { env, timeout: CLI_TIMEOUT });

      // This will fail because the mock API isn't set up, but we want to check it doesn't cancel
      expect(stdout).not.toMatch('Execution cancelled.');
      expect(stderr).not.toMatch('Execution cancelled.');
    });

    test('does not prompt for non-production environments', async () => {
      const { stdout, stderr } = await exec(`${cliPath} exec liquid staging "{{ 'hello' | upcase }}"`, { env, timeout: CLI_TIMEOUT });

      // Should not show warning or cancellation message
      expect(stdout).not.toMatch('Execution cancelled.');
      expect(stderr).not.toMatch('WARNING');
    });
  });

  describe('file flag handling', () => {
    test('accepts --file flag and reads content from file', async () => {
      const fixturePath = path.resolve(__dirname, 'fixtures/test-liquid.liquid');
      const { stderr } = await exec(`${cliPath} exec liquid staging --file "${fixturePath}"`, { env, timeout: CLI_TIMEOUT });

      // Command will fail due to mock API but should not complain about missing code argument
      expect(stderr).not.toMatch("error: missing required argument 'code'");
    });

    test('accepts -f shorthand flag and reads content from file', async () => {
      const fixturePath = path.resolve(__dirname, 'fixtures/test-liquid.liquid');
      const { stderr } = await exec(`${cliPath} exec liquid staging -f "${fixturePath}"`, { env, timeout: CLI_TIMEOUT });

      // Command will fail due to mock API but should not complain about missing code argument
      expect(stderr).not.toMatch("error: missing required argument 'code'");
    });

    test('shows error when file does not exist', async () => {
      const { code, stderr } = await exec(`${cliPath} exec liquid staging --file "/nonexistent/path/to/file.liquid"`, { env, timeout: CLI_TIMEOUT });

      expect(code).toBe(1);
      expect(stderr).toMatch('File not found');
      expect(stderr).toMatch('/nonexistent/path/to/file.liquid');
    });

    test('handles empty file as missing code', async () => {
      const emptyFile = path.join(os.tmpdir(), `empty-liquid-${Date.now()}.liquid`);
      fs.writeFileSync(emptyFile, '');

      try {
        const { code, stderr } = await exec(`${cliPath} exec liquid staging -f "${emptyFile}"`, { env, timeout: CLI_TIMEOUT });

        expect(code).toBe(1);
        expect(stderr).toMatch("error: missing required argument 'code'");
      } finally {
        fs.unlinkSync(emptyFile);
      }
    });

    test('handles file with only whitespace as valid code', async () => {
      const whitespaceFile = path.join(os.tmpdir(), `whitespace-liquid-${Date.now()}.liquid`);
      fs.writeFileSync(whitespaceFile, '   \n\t\n   ');

      try {
        const { stderr } = await exec(`${cliPath} exec liquid staging -f "${whitespaceFile}"`, { env, timeout: CLI_TIMEOUT });

        // Whitespace-only content is truthy, so it passes the !code check
        // This documents current behavior - whitespace is accepted as valid code
        expect(stderr).not.toMatch("error: missing required argument 'code'");
      } finally {
        fs.unlinkSync(whitespaceFile);
      }
    });

    test('reads file with liquid comments', async () => {
      const commentFile = path.join(os.tmpdir(), `comment-liquid-${Date.now()}.liquid`);
      fs.writeFileSync(commentFile, "{% comment %}This is a comment{% endcomment %}{{ 'hello' | upcase }}");

      try {
        const { stderr } = await exec(`${cliPath} exec liquid staging -f "${commentFile}"`, { env, timeout: CLI_TIMEOUT });

        expect(stderr).not.toMatch("error: missing required argument 'code'");
      } finally {
        fs.unlinkSync(commentFile);
      }
    });
  });

  describe('error handling', () => {
    test('handles connection refused error', async () => {
      const badEnv = {
        ...process.env,
        CI: 'true',
        MPKIT_URL: 'http://localhost:1',
        MPKIT_TOKEN: 'test-token',
        MPKIT_EMAIL: 'test@example.com'
      };

      const { code, stderr } = await exec(`${cliPath} exec liquid staging "{{ 'hello' | upcase }}"`, { env: badEnv, timeout: CLI_TIMEOUT });

      expect(code).toBe(1);
      expect(stderr).toMatch(/Failed to execute liquid|ECONNREFUSED|connect ECONNREFUSED/);
    });

    test('handles invalid URL format', async () => {
      const badEnv = {
        ...process.env,
        CI: 'true',
        MPKIT_URL: 'not-a-valid-url',
        MPKIT_TOKEN: 'test-token',
        MPKIT_EMAIL: 'test@example.com'
      };

      const { code } = await exec(`${cliPath} exec liquid staging "{{ 'test' }}"`, { env: badEnv, timeout: CLI_TIMEOUT });

      expect(code).toBe(1);
    });
  });

  describe('code edge cases', () => {
    test('handles code with unicode characters', async () => {
      const { stderr } = await exec(`${cliPath} exec liquid staging "{{ '日本語' | upcase }}"`, { env, timeout: CLI_TIMEOUT });

      // Should not fail on argument parsing
      expect(stderr).not.toMatch("error: missing required argument 'code'");
    });

    test('handles code with special liquid tags', async () => {
      const { stderr } = await exec(`${cliPath} exec liquid staging "{% assign x = 'hello' %}{{ x }}"`, { env, timeout: CLI_TIMEOUT });

      // Should accept liquid tags as valid code
      expect(stderr).not.toMatch("error: missing required argument 'code'");
    });
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

    expect(code).toBe(0);
    expect(stdout).toMatch('HELLO');
    expect(stderr).toBe('');
  }, 30000);

  (hasRealCredentials ? test : test.skip)('handles liquid syntax error on real instance', async () => {
    const { stderr, code } = await exec(`${cliPath} exec liquid dev "{{ 'hello' | invalid_filter }}"`, {
      env: process.env,
      timeout: 30000
    });

    expect(code).toBe(1);
    expect(stderr).toMatch('Liquid execution error');
  }, 30000);

  (hasRealCredentials ? test : test.skip)('executes {{ \'now\' | to_time }} and returns current time', async () => {
    const beforeTime = new Date();
    const { stdout, stderr, code } = await exec(`${cliPath} exec liquid dev "{{ 'now' | to_time }}"`, {
      env: process.env,
      timeout: 30000
    });
    const afterTime = new Date();

    expect(code).toBe(0);
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
    const { stderr, code } = await exec(`${cliPath} exec liquid dev "{% hello %}"`, {
      env: process.env,
      timeout: 30000
    });

    expect(code).toBe(1);
    expect(stderr).toMatch('Liquid execution error: Liquid syntax error: Unknown tag \'hello\'');
  }, 30000);
});
