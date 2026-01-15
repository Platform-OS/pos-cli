jest.mock('../lib/apiRequest', () => ({
  apiRequest: jest.fn()
}));

require('dotenv').config();

const Gateway = require('../lib/proxy');

describe('Gateway test methods', () => {
  const { apiRequest } = require('../lib/apiRequest');

  beforeEach(() => {
    apiRequest.mockReset();
  });

  describe('test(name)', () => {
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

  describe('testRunAsync()', () => {
    test('calls apiRequest with run_async endpoint (no .js extension for v1.1.0+)', async () => {
      apiRequest.mockResolvedValue({ test_run_id: 'test-run-123' });

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
      expect(result).toEqual({ test_run_id: 'test-run-123' });
    });

    test('handles error response', async () => {
      apiRequest.mockResolvedValue({ error: 'Tests module not found' });

      const gateway = new Gateway({ url: 'http://example.com', token: '1234', email: 'test@example.com' });
      const result = await gateway.testRunAsync();

      expect(result).toEqual({ error: 'Tests module not found' });
    });
  });

  describe('formatTestLog', () => {
    let formatTestLog;

    beforeEach(() => {
      const testRunModule = require('../bin/pos-cli-test-run');
      formatTestLog = testRunModule.formatTestLog;
    });

    test('highlights test log with test path (new test indicator)', () => {
      const logRow = {
        message: '{"path": "app/lib/test/example_test.liquid"}',
        type: 'liquid_test_abc123'
      };

      const result = formatTestLog(logRow, true);

      // Should contain the arrow indicator and path
      expect(result).toContain('▶');
      expect(result).toContain('app/lib/test/example_test.liquid');
    });

    test('displays test log without path normally', () => {
      const logRow = {
        message: 'Test assertion passed',
        type: 'liquid_test_abc123'
      };

      const result = formatTestLog(logRow, true);

      // Should not contain the arrow indicator
      expect(result).not.toContain('▶');
      expect(result).toContain('Test assertion passed');
    });

    test('dims debug logs (type != test_name)', () => {
      const logRow = {
        message: 'Debug: checking variable value',
        type: 'debug'
      };

      const result = formatTestLog(logRow, false);

      // Should contain the debug prefix with type
      expect(result).toContain('[debug:debug]');
      expect(result).toContain('Debug: checking variable value');
    });

    test('shows debug type in dimmed log output', () => {
      const logRow = {
        message: 'Custom debug message from test',
        type: 'custom_debug'
      };

      const result = formatTestLog(logRow, false);

      expect(result).toContain('[debug:custom_debug]');
      expect(result).toContain('Custom debug message from test');
    });

    test('highlights test path in modules directory', () => {
      const logRow = {
        message: '{"path": "modules/my_module/test/unit_test.liquid"}',
        type: 'liquid_test_xyz789'
      };

      const result = formatTestLog(logRow, true);

      expect(result).toContain('▶');
      expect(result).toContain('modules/my_module/test/unit_test.liquid');
    });
  });

  describe('TestLogStream', () => {
    let TestLogStream;

    beforeEach(() => {
      const testRunModule = require('../bin/pos-cli-test-run');
      TestLogStream = testRunModule.TestLogStream;
    });

    describe('parseJsonSummary', () => {
      test('parses successful test completion JSON from tests module 1.1.1+', () => {
        const stream = new TestLogStream({});

        const message = JSON.stringify({
          success: true,
          total_tests: 5,
          total_assertions: 16,
          total_errors: 0,
          duration_ms: 26,
          test_run_id: 'test-run-123',
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
          test_run_id: 'test-run-123',
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
          test_run_id: 'test-run-123',
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
    });

    describe('isValidTestSummaryJson', () => {
      test('identifies valid test summary JSON', () => {
        const stream = new TestLogStream({});

        const validMessage = JSON.stringify({
          success: true,
          total_tests: 5,
          total_assertions: 16,
          duration_ms: 26,
          test_run_id: 'test-run-123',
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
          test_run_id: 'test-run-123',
          tests: [
            { name: "test/array_test", success: true, assertions: 2, errors: {} },
            { name: "test/examples/assertions_test", success: true, assertions: 4, errors: {} },
            { name: "test/example_test", success: true, assertions: 5, errors: {} },
            { name: "test/object_test", success: true, assertions: 3, errors: {} },
            { name: "test/string_test", success: true, assertions: 2, errors: {} }
          ]
        });

        // Simulate receiving the same JSON summary multiple times
        const logRow1 = { id: 1, message: testSummaryJson };
        const logRow2 = { id: 2, message: testSummaryJson };
        const logRow3 = { id: 3, message: testSummaryJson };

        // Process first occurrence
        stream.processLogMessage(logRow1);
        // Process second occurrence (duplicate)
        stream.processLogMessage(logRow2);
        // Process third occurrence (duplicate)
        stream.processLogMessage(logRow3);

        // Should emit testCompleted only once
        expect(mockEmit).toHaveBeenCalledTimes(1);
        expect(mockEmit).toHaveBeenCalledWith('testCompleted', expect.any(Object));

        // Verify the emitted results are correct
        const emittedResults = mockEmit.mock.calls[0][1];
        expect(emittedResults.total).toBe(5);
        expect(emittedResults.passed).toBe(5);
        expect(emittedResults.failed).toBe(0);
      });

      test('only processes JSON summaries that match the testRunId', () => {
        const stream = new TestLogStream({}, 30000, 'test-run-123');
        const mockEmit = jest.fn();
        stream.emit = mockEmit;

        const matchingSummaryJson = JSON.stringify({
          success: false,
          total_tests: 2,
          total_errors: 2,
          test_run_id: 'test-run-123',
          tests: [
            { name: "test1", success: false, assertions: 1, errors: { message: "failed" } },
            { name: "test2", success: false, assertions: 1, errors: { message: "failed" } }
          ]
        });

        const nonMatchingSummaryJson = JSON.stringify({
          success: true,
          total_tests: 2,
          test_run_id: 'test-run-456',
          tests: [
            { name: "test1", success: true, assertions: 1, errors: {} },
            { name: "test2", success: true, assertions: 1, errors: {} }
          ]
        });

        // Process non-matching summary first (should be ignored)
        stream.processLogMessage({ id: 1, message: nonMatchingSummaryJson });
        // Process matching summary (should be processed)
        stream.processLogMessage({ id: 2, message: matchingSummaryJson });

        // Should emit testCompleted only once for the matching summary
        expect(mockEmit).toHaveBeenCalledTimes(1);
        expect(mockEmit).toHaveBeenCalledWith('testCompleted', expect.any(Object));

        // Verify the emitted results are from the matching (failing) summary
        const emittedResults = mockEmit.mock.calls[0][1];
        expect(emittedResults.total).toBe(2);
        expect(emittedResults.passed).toBe(0);
        expect(emittedResults.failed).toBe(2);
      });

      test('ignores JSON summaries when no testRunId is set (backward compatibility)', () => {
        const stream = new TestLogStream({}); // No testRunId
        const mockEmit = jest.fn();
        stream.emit = mockEmit;

        const summaryWithIdJson = JSON.stringify({
          success: true,
          total_tests: 1,
          test_run_id: 'test-run-123',
          tests: [{ name: "test1", success: true, assertions: 1, errors: {} }]
        });

        // Should still process summaries even with test_run_id when no filter is set
        stream.processLogMessage({ id: 1, message: summaryWithIdJson });

        expect(mockEmit).toHaveBeenCalledTimes(1);
        expect(mockEmit).toHaveBeenCalledWith('testCompleted', expect.any(Object));
      });
    });

    describe('testName filtering', () => {
      test('detects test start with matching testName type', () => {
        const stream = new TestLogStream({}, 30000, null, 'liquid_test_abc123');
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
        const stream = new TestLogStream({}, 30000, null, 'liquid_test_abc123');
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
        const stream = new TestLogStream({}, 30000, null, 'liquid_test_abc123');
        stream.testStarted = true; // Simulate test already started
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
        const stream = new TestLogStream({}, 30000, null, 'liquid_test_abc123');
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

        // Should emit testLog instead since it's during the test run
        expect(mockEmit).toHaveBeenCalledWith('testLog', expect.any(Object), false);
        expect(stream.completed).toBe(false);
      });

      test('emits testLog with isTestLog=true for logs with matching testName type', () => {
        const stream = new TestLogStream({}, 30000, null, 'liquid_test_abc123');
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
        const stream = new TestLogStream({}, 30000, null, 'liquid_test_abc123');
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
        const stream = new TestLogStream({}, 30000, null, 'liquid_test_abc123');
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
        const stream = new TestLogStream({}, 30000, null, 'liquid_test_abc123');
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
        const stream = new TestLogStream({}, 30000, null, 'liquid_test_current');
        stream.testStarted = true;
        const mockEmit = jest.fn();
        stream.emit = mockEmit;

        // Log from a past test run with different testName
        const pastLog = {
          id: 1,
          message: 'Some past test log',
          error_type: 'liquid_test_past'
        };

        // Log from current test run
        const currentLog = {
          id: 2,
          message: 'Current test log',
          error_type: 'liquid_test_current'
        };

        stream.processLogMessage(pastLog);
        stream.processLogMessage(currentLog);

        // Should emit both logs, but with different isTestLog values
        expect(mockEmit).toHaveBeenCalledTimes(2);
        expect(mockEmit).toHaveBeenNthCalledWith(1, 'testLog', pastLog, false); // non-matching type = debug
        expect(mockEmit).toHaveBeenNthCalledWith(2, 'testLog', currentLog, true); // matching type = test log
      });
    });
  });
});