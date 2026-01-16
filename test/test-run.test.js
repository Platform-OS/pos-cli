/* global jest */

jest.mock('../lib/apiRequest', () => ({
  apiRequest: jest.fn()
}));

require('dotenv').config();

const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');
const Gateway = require('../lib/proxy');

// Import test-runner modules
const { TestLogStream } = require('../lib/test-runner/logStream');
const { formatDuration, formatTestLog } = require('../lib/test-runner/formatters');

const cwd = name => `${process.cwd()}/test/fixtures/test/${name}`;
const run = (fixtureName, options) => exec(`${cliPath} test run ${options || ''}`, { cwd: cwd(fixtureName), env: process.env });
const deploy = (fixtureName) => exec(`${cliPath} deploy staging`, { cwd: cwd(fixtureName), env: process.env });

jest.setTimeout(200000);

describe('pos-cli test run', () => {
  describe('Unit tests', () => {
    const { apiRequest } = require('../lib/apiRequest');

    beforeEach(() => {
      apiRequest.mockReset();
    });

    describe('Gateway.test(name)', () => {
      test('calls apiRequest with correct URL for single test (JS format)', async () => {
        apiRequest.mockResolvedValue({ passed: 1, failed: 0, total: 1, tests: [] });

        const gateway = new Gateway({ url: 'http://example.com', token: '1234', email: 'test@example.com' });
        const result = await gateway.test('example_test');

        expect(apiRequest).toHaveBeenCalledWith({
          method: 'GET',
          uri: 'http://example.com/_tests/run.js?name=example_test',
          formData: undefined,
          json: true,
          forever: undefined,
          request: expect.any(Function)
        });
        expect(result).toEqual({ passed: 1, failed: 0, total: 1, tests: [] });
      });

      test('handles test with path in name', async () => {
        apiRequest.mockResolvedValue({ passed: 1, failed: 0, total: 1 });

        const gateway = new Gateway({ url: 'http://example.com', token: '1234', email: 'test@example.com' });
        await gateway.test('test/examples/assertions_test');

        expect(apiRequest).toHaveBeenCalledWith(expect.objectContaining({
          uri: 'http://example.com/_tests/run.js?name=test/examples/assertions_test'
        }));
      });
    });

    describe('Gateway.testRunAsync()', () => {
      test('calls apiRequest with run_async endpoint (no .js extension for v1.1.0+)', async () => {
        apiRequest.mockResolvedValue({ test_name: 'liquid_test_abc123' });

        const gateway = new Gateway({ url: 'http://example.com', token: '1234', email: 'test@example.com' });
        const result = await gateway.testRunAsync();

        expect(apiRequest).toHaveBeenCalledWith({
          method: 'GET',
          uri: 'http://example.com/_tests/run_async',
          formData: undefined,
          json: true,
          forever: undefined,
          request: expect.any(Function)
        });
        expect(result).toEqual({ test_name: 'liquid_test_abc123' });
      });

      test('handles error response', async () => {
        apiRequest.mockResolvedValue({ error: 'Tests module not found' });

        const gateway = new Gateway({ url: 'http://example.com', token: '1234', email: 'test@example.com' });
        const result = await gateway.testRunAsync();

        expect(result).toEqual({ error: 'Tests module not found' });
      });
    });

    describe('formatTestLog', () => {
      test('highlights test log with test path (new test indicator)', () => {
        const logRow = {
          message: '{"path": "app/lib/test/example_test.liquid"}',
          error_type: 'liquid_test_abc123'
        };

        const result = formatTestLog(logRow, true);

        expect(result).toContain('▶');
        expect(result).toContain('app/lib/test/example_test.liquid');
      });

      test('displays test log without path normally', () => {
        const logRow = {
          message: 'Test assertion passed',
          error_type: 'liquid_test_abc123'
        };

        const result = formatTestLog(logRow, true);

        expect(result).not.toContain('▶');
        expect(result).toContain('Test assertion passed');
      });

      test('dims debug logs (type != test_name)', () => {
        const logRow = {
          message: 'Debug: checking variable value',
          error_type: 'debug'
        };

        const result = formatTestLog(logRow, false);

        expect(result).toContain('[debug:debug]');
        expect(result).toContain('Debug: checking variable value');
      });

      test('shows debug type in dimmed log output', () => {
        const logRow = {
          message: 'Custom debug message from test',
          error_type: 'custom_debug'
        };

        const result = formatTestLog(logRow, false);

        expect(result).toContain('[debug:custom_debug]');
        expect(result).toContain('Custom debug message from test');
      });

      test('highlights test path in modules directory', () => {
        const logRow = {
          message: '{"path": "modules/my_module/test/unit_test.liquid"}',
          error_type: 'liquid_test_xyz789'
        };

        const result = formatTestLog(logRow, true);

        expect(result).toContain('▶');
        expect(result).toContain('modules/my_module/test/unit_test.liquid');
      });

      test('handles message with trailing newline', () => {
        const logRow = {
          message: 'Test message with newline\n',
          error_type: 'liquid_test_abc123'
        };

        const result = formatTestLog(logRow, true);

        expect(result).not.toMatch(/\n$/);
        expect(result).toContain('Test message with newline');
      });

      test('handles non-string message by converting to JSON', () => {
        const logRow = {
          message: { key: 'value', nested: { data: true } },
          error_type: 'liquid_test_abc123'
        };

        const result = formatTestLog(logRow, true);

        expect(result).toContain('key');
        expect(result).toContain('value');
      });
    });

    describe('formatDuration', () => {
      test('formats milliseconds under 1 second', () => {
        expect(formatDuration(0)).toBe('0ms');
        expect(formatDuration(1)).toBe('1ms');
        expect(formatDuration(500)).toBe('500ms');
        expect(formatDuration(999)).toBe('999ms');
      });

      test('formats seconds under 1 minute', () => {
        expect(formatDuration(1000)).toBe('1.00s');
        expect(formatDuration(1500)).toBe('1.50s');
        expect(formatDuration(2345)).toBe('2.35s');
        expect(formatDuration(59999)).toBe('60.00s');
      });

      test('formats minutes and seconds', () => {
        expect(formatDuration(60000)).toBe('1m 0.00s');
        expect(formatDuration(65000)).toBe('1m 5.00s');
        expect(formatDuration(90000)).toBe('1m 30.00s');
        expect(formatDuration(125500)).toBe('2m 5.50s');
      });

      test('formats large durations', () => {
        expect(formatDuration(300000)).toBe('5m 0.00s');
        expect(formatDuration(3600000)).toBe('60m 0.00s');
      });
    });

    describe('TestLogStream', () => {
      describe('parseJsonSummary', () => {
        test('parses successful test completion JSON from tests module 1.1.1+', () => {
          const stream = new TestLogStream({});

          const message = JSON.stringify({
            success: true,
            total_tests: 5,
            total_assertions: 16,
            total_errors: 0,
            duration_ms: 26,
            tests: [
              { name: "test/array_test", success: true, assertions: 2, errors: {} },
              { name: "test/examples/assertions_test", success: true, assertions: 4, errors: {} },
              { name: "test/example_test", success: true, assertions: 5, errors: {} },
              { name: "test/object_test", success: true, assertions: 3, errors: {} },
              { name: "test/string_test", success: true, assertions: 2, errors: {} }
            ]
          });

          const result = stream.parseJsonSummary(message);

          expect(result).toEqual({
            total: 5,
            passed: 5,
            failed: 0,
            assertions: 16,
            tests: [
              { name: "test/array_test", status: "passed", passed: true, assertions: 2 },
              { name: "test/examples/assertions_test", status: "passed", passed: true, assertions: 4 },
              { name: "test/example_test", status: "passed", passed: true, assertions: 5 },
              { name: "test/object_test", status: "passed", passed: true, assertions: 3 },
              { name: "test/string_test", status: "passed", passed: true, assertions: 2 }
            ],
            duration: 26
          });
        });

        test('parses failed test completion JSON with error details', () => {
          const stream = new TestLogStream({});

          const message = JSON.stringify({
            success: false,
            total_tests: 3,
            total_assertions: 10,
            total_errors: 1,
            duration_ms: 45,
            tests: [
              { name: "test/passing_test", success: true, assertions: 3, errors: {} },
              { name: "test/failing_test", success: false, assertions: 2, errors: { expected: "field to be 2", actual: "field is 1" } },
              { name: "test/another_passing_test", success: true, assertions: 5, errors: {} }
            ]
          });

          const result = stream.parseJsonSummary(message);

          expect(result).toEqual({
            total: 3,
            passed: 2,
            failed: 1,
            assertions: 10,
            tests: [
              { name: "test/passing_test", status: "passed", passed: true, assertions: 3 },
              { name: "test/failing_test", status: "failed", passed: false, assertions: 2, error: "{\"expected\":\"field to be 2\",\"actual\":\"field is 1\"}" },
              { name: "test/another_passing_test", status: "passed", passed: true, assertions: 5 }
            ],
            duration: 45
          });
        });

        test('handles alternative field names (total instead of total_tests)', () => {
          const stream = new TestLogStream({});

          const message = JSON.stringify({
            success: true,
            total: 4,
            assertions: 8,
            duration: 30,
            tests: [
              { name: "test1", success: true, assertions: 2, errors: {} },
              { name: "test2", success: true, assertions: 2, errors: {} },
              { name: "test3", success: true, assertions: 2, errors: {} },
              { name: "test4", success: true, assertions: 2, errors: {} }
            ]
          });

          const result = stream.parseJsonSummary(message);

          expect(result).toEqual({
            total: 4,
            passed: 4,
            failed: 0,
            assertions: 8,
            tests: [
              { name: "test1", status: "passed", passed: true, assertions: 2 },
              { name: "test2", status: "passed", passed: true, assertions: 2 },
              { name: "test3", status: "passed", passed: true, assertions: 2 },
              { name: "test4", status: "passed", passed: true, assertions: 2 }
            ],
            duration: 30
          });
        });

        test('returns null for invalid JSON', () => {
          const stream = new TestLogStream({});
          const invalidJson = '{ "invalid": json }';
          const result = stream.parseJsonSummary(invalidJson);
          expect(result).toBeNull();
        });

        test('handles empty tests array in summary', () => {
          const stream = new TestLogStream({});

          const message = JSON.stringify({
            success: true,
            total_tests: 0,
            total_assertions: 0,
            duration_ms: 5,
            tests: []
          });

          const result = stream.parseJsonSummary(message);

          expect(result).toEqual({
            total: 0,
            passed: 0,
            failed: 0,
            assertions: 0,
            tests: [],
            duration: 5
          });
        });

        test('handles test with no assertions', () => {
          const stream = new TestLogStream({});

          const message = JSON.stringify({
            success: true,
            total_tests: 1,
            total_assertions: 0,
            duration_ms: 10,
            tests: [
              { name: "test/empty_test", success: true, assertions: 0, errors: {} }
            ]
          });

          const result = stream.parseJsonSummary(message);

          expect(result.tests[0].assertions).toBe(0);
          expect(result.assertions).toBe(0);
        });

        test('handles test with array of errors', () => {
          const stream = new TestLogStream({});

          const message = JSON.stringify({
            success: false,
            total_tests: 1,
            total_errors: 1,
            duration_ms: 15,
            tests: [
              {
                name: "test/multi_error_test",
                success: false,
                assertions: 3,
                errors: ["Error 1", "Error 2", "Error 3"]
              }
            ]
          });

          const result = stream.parseJsonSummary(message);

          expect(result.tests[0].errors).toEqual(["Error 1", "Error 2", "Error 3"]);
        });

        test('handles missing test name gracefully', () => {
          const stream = new TestLogStream({});

          const message = JSON.stringify({
            success: true,
            total_tests: 1,
            duration_ms: 10,
            tests: [
              { success: true, assertions: 1, errors: {} }
            ]
          });

          const result = stream.parseJsonSummary(message);

          expect(result.tests[0].name).toBe('Unknown test');
        });
      });

      describe('isValidTestSummaryJson', () => {
        test('identifies valid test summary JSON', () => {
          const stream = new TestLogStream({});

          const validMessage = JSON.stringify({
            success: true,
            total_tests: 5,
            total_assertions: 16,
            duration_ms: 26,
            tests: []
          });

          expect(stream.isValidTestSummaryJson(validMessage)).toBe(true);
        });

        test('rejects JSON without tests array', () => {
          const stream = new TestLogStream({});

          const invalidMessage = JSON.stringify({
            success: true,
            total_tests: 5,
            duration_ms: 26
          });

          expect(stream.isValidTestSummaryJson(invalidMessage)).toBe(false);
        });

        test('rejects JSON without success field', () => {
          const stream = new TestLogStream({});

          const invalidMessage = JSON.stringify({
            total_tests: 5,
            duration_ms: 26,
            tests: []
          });

          expect(stream.isValidTestSummaryJson(invalidMessage)).toBe(false);
        });

        test('rejects non-test JSON', () => {
          const stream = new TestLogStream({});

          const invalidMessage = JSON.stringify({
            path: "test/array_test"
          });

          expect(stream.isValidTestSummaryJson(invalidMessage)).toBe(false);
        });
      });

      describe('testCompleted event emission', () => {
        test('emits testCompleted only once even when duplicate JSON summaries are received', () => {
          const stream = new TestLogStream({});
          const mockEmit = jest.fn();
          stream.emit = mockEmit;

          const testSummaryJson = JSON.stringify({
            success: true,
            total_tests: 5,
            total_assertions: 16,
            duration_ms: 26,
            tests: [
              { name: "test/array_test", success: true, assertions: 2, errors: {} },
              { name: "test/examples/assertions_test", success: true, assertions: 4, errors: {} },
              { name: "test/example_test", success: true, assertions: 5, errors: {} },
              { name: "test/object_test", success: true, assertions: 3, errors: {} },
              { name: "test/string_test", success: true, assertions: 2, errors: {} }
            ]
          });

          const logRow1 = { id: 1, message: testSummaryJson, error_type: '' };
          const logRow2 = { id: 2, message: testSummaryJson, error_type: '' };
          const logRow3 = { id: 3, message: testSummaryJson, error_type: '' };

          stream.processLogMessage(logRow1);
          stream.processLogMessage(logRow2);
          stream.processLogMessage(logRow3);

          expect(mockEmit).toHaveBeenCalledTimes(1);
          expect(mockEmit).toHaveBeenCalledWith('testCompleted', expect.any(Object));

          const emittedResults = mockEmit.mock.calls[0][1];
          expect(emittedResults.total).toBe(5);
          expect(emittedResults.passed).toBe(5);
          expect(emittedResults.failed).toBe(0);
        });

      });

      describe('testName filtering', () => {
        test('detects test start with matching testName type', () => {
          const stream = new TestLogStream({}, 30000, 'liquid_test_abc123');
          const mockEmit = jest.fn();
          stream.emit = mockEmit;

          const startLog = {
            id: 1,
            message: 'Starting unit tests',
            error_type: 'liquid_test_abc123'
          };

          stream.processLogMessage(startLog);

          expect(mockEmit).toHaveBeenCalledWith('testStarted');
          expect(stream.testStarted).toBe(true);
        });

        test('ignores test start with non-matching testName type', () => {
          const stream = new TestLogStream({}, 30000, 'liquid_test_abc123');
          const mockEmit = jest.fn();
          stream.emit = mockEmit;

          const startLog = {
            id: 1,
            message: 'Starting unit tests',
            error_type: 'liquid_test_different'
          };

          stream.processLogMessage(startLog);

          expect(mockEmit).not.toHaveBeenCalled();
          expect(stream.testStarted).toBe(false);
        });

        test('detects test completion with testName SUMMARY type', () => {
          const stream = new TestLogStream({}, 30000, 'liquid_test_abc123');
          stream.testStarted = true;
          const mockEmit = jest.fn();
          stream.emit = mockEmit;

          const summaryJson = JSON.stringify({
            success: true,
            total_tests: 2,
            tests: [
              { name: "test1", success: true, assertions: 1, errors: {} },
              { name: "test2", success: true, assertions: 1, errors: {} }
            ]
          });

          const summaryLog = {
            id: 2,
            message: summaryJson,
            error_type: 'liquid_test_abc123 SUMMARY'
          };

          stream.processLogMessage(summaryLog);

          expect(mockEmit).toHaveBeenCalledWith('testCompleted', expect.any(Object));
          expect(stream.completed).toBe(true);
        });

        test('ignores summary with non-matching testName SUMMARY type', () => {
          const stream = new TestLogStream({}, 30000, 'liquid_test_abc123');
          stream.testStarted = true;
          const mockEmit = jest.fn();
          stream.emit = mockEmit;

          const summaryJson = JSON.stringify({
            success: true,
            total_tests: 2,
            tests: [
              { name: "test1", success: true, assertions: 1, errors: {} },
              { name: "test2", success: true, assertions: 1, errors: {} }
            ]
          });

          const summaryLog = {
            id: 2,
            message: summaryJson,
            error_type: 'liquid_test_different SUMMARY'
          };

          stream.processLogMessage(summaryLog);

          expect(mockEmit).toHaveBeenCalledWith('testLog', expect.any(Object), false);
          expect(stream.completed).toBe(false);
        });

        test('emits testLog with isTestLog=true for logs with matching testName type', () => {
          const stream = new TestLogStream({}, 30000, 'liquid_test_abc123');
          stream.testStarted = true;
          const mockEmit = jest.fn();
          stream.emit = mockEmit;

          const testLog = {
            id: 2,
            message: '{"path": "app/lib/test/example_test.liquid"}',
            error_type: 'liquid_test_abc123'
          };

          stream.processLogMessage(testLog);

          expect(mockEmit).toHaveBeenCalledWith('testLog', testLog, true);
        });

        test('emits testLog with isTestLog=false for logs with different type (debug logs)', () => {
          const stream = new TestLogStream({}, 30000, 'liquid_test_abc123');
          stream.testStarted = true;
          const mockEmit = jest.fn();
          stream.emit = mockEmit;

          const debugLog = {
            id: 2,
            message: 'Debug: checking variable value',
            error_type: 'debug'
          };

          stream.processLogMessage(debugLog);

          expect(mockEmit).toHaveBeenCalledWith('testLog', debugLog, false);
        });

        test('does not emit logs before test started', () => {
          const stream = new TestLogStream({}, 30000, 'liquid_test_abc123');
          const mockEmit = jest.fn();
          stream.emit = mockEmit;

          const earlyLog = {
            id: 1,
            message: 'Some early log from previous test run',
            error_type: 'liquid_test_abc123'
          };

          stream.processLogMessage(earlyLog);

          expect(mockEmit).not.toHaveBeenCalled();
        });

        test('does not emit logs after test completed', () => {
          const stream = new TestLogStream({}, 30000, 'liquid_test_abc123');
          stream.testStarted = true;
          stream.completed = true;
          const mockEmit = jest.fn();
          stream.emit = mockEmit;

          const lateLog = {
            id: 3,
            message: 'Some late log',
            error_type: 'liquid_test_abc123'
          };

          stream.processLogMessage(lateLog);

          expect(mockEmit).not.toHaveBeenCalled();
        });

        test('filters noise from past test runs by only processing logs with matching testName', () => {
          const stream = new TestLogStream({}, 30000, 'liquid_test_current');
          stream.testStarted = true;
          const mockEmit = jest.fn();
          stream.emit = mockEmit;

          const pastLog = {
            id: 1,
            message: 'Some past test log',
            error_type: 'liquid_test_past'
          };

          const currentLog = {
            id: 2,
            message: 'Current test log',
            error_type: 'liquid_test_current'
          };

          stream.processLogMessage(pastLog);
          stream.processLogMessage(currentLog);

          expect(mockEmit).toHaveBeenCalledTimes(2);
          expect(mockEmit).toHaveBeenNthCalledWith(1, 'testLog', pastLog, false);
          expect(mockEmit).toHaveBeenNthCalledWith(2, 'testLog', currentLog, true);
        });
      });
    });
  });

  describe('CLI argument validation', () => {
    const env = {
      ...process.env,
      CI: 'true',
      MPKIT_URL: 'http://example.com',
      MPKIT_TOKEN: '1234',
      MPKIT_EMAIL: 'foo@example.com'
    };

    const CLI_TIMEOUT = 10000;

    test('requires environment argument', async () => {
      const { code, stderr } = await exec(`${cliPath} test run`, { env, timeout: CLI_TIMEOUT });

      expect(code).toBe(1);
      expect(stderr).toMatch("error: missing required argument 'environment'");
    });

    test('accepts test name argument', async () => {
      const { stderr } = await exec(`${cliPath} test run staging my_test_name`, { env, timeout: CLI_TIMEOUT });

      expect(stderr).not.toMatch("error: missing required argument");
    });

    test('accepts test name with path', async () => {
      const { stderr } = await exec(`${cliPath} test run staging test/examples/assertions_test`, { env, timeout: CLI_TIMEOUT });

      expect(stderr).not.toMatch("error: missing required argument");
    });

    test('handles connection refused error', async () => {
      const badEnv = {
        ...process.env,
        CI: 'true',
        MPKIT_URL: 'http://localhost:1',
        MPKIT_TOKEN: 'test-token',
        MPKIT_EMAIL: 'test@example.com'
      };

      const { code, stderr } = await exec(`${cliPath} test run staging`, { env: badEnv, timeout: CLI_TIMEOUT });

      expect(code).toBe(1);
      expect(stderr).toMatch(/ECONNREFUSED|Failed to execute test|connect ECONNREFUSED/);
    });

    test('handles invalid URL format', async () => {
      const badEnv = {
        ...process.env,
        CI: 'true',
        MPKIT_URL: 'not-a-valid-url',
        MPKIT_TOKEN: 'test-token',
        MPKIT_EMAIL: 'test@example.com'
      };

      const { code } = await exec(`${cliPath} test run staging`, { env: badEnv, timeout: CLI_TIMEOUT });

      expect(code).toBe(1);
    });
  });

  describe('Integration tests', () => {
    describe('with mixed tests (passing and failing)', () => {
      beforeAll(async () => {
        const { stdout, stderr } = await deploy('with-tests-module');
        if (!stdout.includes('Deploy succeeded')) {
          console.error('Deploy failed:', stderr);
          throw new Error('Failed to deploy test fixtures');
        }
      });

      test.skip('shows error when tests module is not installed', async () => {
        const { stderr } = await run('without-tests-module', 'staging');

        expect(stderr).toMatch('Tests module not found');
      });

      test('runs all tests, displays URL and results, exits with code 1 when at least one fails', async () => {
        const { stdout, stderr, code } = await run('with-tests-module', 'staging');
        const output = stdout + stderr;

        expect(stdout).toMatch(`Running tests on: ${process.env.MPKIT_URL}`);
        expect(stdout).toMatch('Starting test run...');

        const hasTestResults = output.includes('passed') ||
                              output.includes('failed') ||
                              output.includes('Test Results:') ||
                              output.includes('total)');
        expect(hasTestResults).toBe(true);

        expect(output).toMatch(/\d+ passed/);
        expect(output).toMatch(/\d+ failed/);

        expect(code).toBe(1);
      });

      test('runs a single passing test by name and shows success', async () => {
        const { stdout, stderr, code } = await run('with-tests-module', 'staging example_test');

        expect(stdout).toMatch('Test Results:');
        expect(stdout).toMatch(/✓.*example_test/);
        expect(stdout).toMatch('1 passed');

        expect(code).toBe(0);
      });

      test('runs a single failing test by name and shows failure', async () => {
        const { stdout, stderr, code } = await run('with-tests-module', 'staging failing_test');

        expect(stdout + stderr).toMatch('Test Results:');
        expect(stdout + stderr).toMatch(/✗.*failing_test/);
        expect(stdout + stderr).toMatch('1 failed');

        expect(code).toBe(1);
      });
    });

    describe('with only passing tests', () => {
      beforeAll(async () => {
        const { stdout, stderr } = await deploy('with-passing-tests');
        if (!stdout.includes('Deploy succeeded')) {
          console.error('Deploy failed:', stderr);
          throw new Error('Failed to deploy test fixtures');
        }
      });

      test('exits with code 0 when running all tests and all pass', async () => {
        const { stdout, stderr, code } = await run('with-passing-tests', 'staging');

        expect(stdout).toMatch('Starting test run...');

        const output = stdout + stderr;
        expect(output).toMatch(/\d+ passed/);
        expect(output).not.toMatch(/[1-9]\d* failed/);

        expect(code).toBe(0);
      });
    });
  });
});
