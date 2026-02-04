import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Mock the pos-cli libs before importing tools
vi.mock('../../lib/files', () => ({
  default: { getConfig: () => ({ staging: { url: 'https://staging.example.com', token: 'test-token', email: 'test@example.com' } }) },
  getConfig: () => ({ staging: { url: 'https://staging.example.com', token: 'test-token', email: 'test@example.com' } })
}));

vi.mock('../../lib/settings', () => ({
  default: { fetchSettings: (env) => ({ url: `https://${env}.example.com`, token: 'test-token', email: 'test@example.com' }) },
  fetchSettings: (env) => ({ url: `https://${env}.example.com`, token: 'test-token', email: 'test@example.com' })
}));

vi.mock('request-promise', () => ({
  default: vi.fn()
}));

describe('unit-tests-run tool', () => {
  let testsRunTool;
  let parseTestResponse;
  let extractJsonObjects;

  beforeAll(async () => {
    const module = await import('../tests/run.js');
    testsRunTool = module.default;
    parseTestResponse = module.parseTestResponse;
    extractJsonObjects = module.extractJsonObjects;
  });

  describe('parseTestResponse', () => {
    describe('JSON format', () => {
      test('parses simple passing test response', () => {
        const response = `{"path":"tests/example_test"}
------------------------
Assertions: 5. Failed: 0. Time: 50ms`;

        const result = parseTestResponse(response);

        expect(result.summary.assertions).toBe(5);
        expect(result.summary.failed).toBe(0);
        expect(result.summary.timeMs).toBe(50);
        expect(result.tests).toHaveLength(1);
        expect(result.tests[0].path).toBe('tests/example_test');
      });

      test('parses test response with error', () => {
        const response = `{"path":"tests/timezones/list_test"}{"class_name":"Liquid::Error","message":"Liquid error: can't find partial"}
------------------------
Assertions: 0. Failed: 0. Time: 31ms`;

        const result = parseTestResponse(response);

        expect(result.summary.assertions).toBe(0);
        expect(result.summary.timeMs).toBe(31);
        expect(result.tests).toHaveLength(1);
        expect(result.tests[0].path).toBe('tests/timezones/list_test');
        expect(result.tests[0].error.className).toBe('Liquid::Error');
        expect(result.tests[0].error.message).toContain("can't find partial");
      });

      test('parses multiple tests', () => {
        const response = `{"path":"tests/test1"}
------------------------
{"path":"tests/test2"}
------------------------
{"path":"tests/test3"}{"class_name":"Error","message":"failed"}
------------------------
Assertions: 10. Failed: 1. Time: 200ms`;

        const result = parseTestResponse(response);

        expect(result.tests).toHaveLength(3);
        expect(result.tests[0].path).toBe('tests/test1');
        expect(result.tests[1].path).toBe('tests/test2');
        expect(result.tests[2].path).toBe('tests/test3');
        expect(result.tests[2].error).toBeDefined();
        expect(result.summary.assertions).toBe(10);
        expect(result.summary.failed).toBe(1);
      });
    });

    describe('Text/Indented format', () => {
      test('parses indented test format with passing and failing tests', () => {
        const response = `------------------------

commands/questions/create_test

  build_valid should be valid:

  errors_populated translation missing: en.test.should.be_true


commands/questions/update_test

  build_valid should be valid:


simple_test

  simple_valid should be valid:


------------------------


Failed_

  Total errors: 4



Assertions: 11. Failed: 4. Time: 267ms`;

        const result = parseTestResponse(response);

        expect(result.summary.assertions).toBe(11);
        expect(result.summary.failed).toBe(4);
        expect(result.summary.timeMs).toBe(267);
        expect(result.summary.totalErrors).toBe(4);

        expect(result.tests).toHaveLength(3);

        // First test with one pass and one fail
        expect(result.tests[0].path).toBe('commands/questions/create_test');
        expect(result.tests[0].cases).toHaveLength(2);
        expect(result.tests[0].cases[0].name).toBe('build_valid');
        expect(result.tests[0].cases[0].passed).toBe(true);
        expect(result.tests[0].cases[0].description).toBe('should be valid');
        expect(result.tests[0].cases[1].name).toBe('errors_populated');
        expect(result.tests[0].cases[1].passed).toBe(false);
        expect(result.tests[0].cases[1].error).toContain('translation missing');
        expect(result.tests[0].cases[1].error).toContain('en.test.should.be_true');

        // Second test - all passing
        expect(result.tests[1].path).toBe('commands/questions/update_test');
        expect(result.tests[1].passed).toBe(true);

        // Third test - all passing
        expect(result.tests[2].path).toBe('simple_test');
        expect(result.tests[2].passed).toBe(true);
      });

      test('parses test with only passing cases', () => {
        const response = `------------------------
my_test

  case_one should work:

  case_two should also work:

------------------------
Assertions: 2. Failed: 0. Time: 50ms`;

        const result = parseTestResponse(response);

        expect(result.tests).toHaveLength(1);
        expect(result.tests[0].path).toBe('my_test');
        expect(result.tests[0].passed).toBe(true);
        expect(result.tests[0].cases).toHaveLength(2);
        expect(result.tests[0].cases.every(c => c.passed)).toBe(true);
      });

      test('parses mixed format with SYNTAX ERROR and indented tests', () => {
        const response = `SYNTAX ERROR:{"path":"tests/timezones/convert_test"}{"class_name":"LiquidArgumentError","message":"Liquid error: hash_merge filter - first argument must be a hash"}
------------------------

tests/timezones/list_test

  result.results should not be blank

  has_results translation missing: en.test.should.be_true

  first.region should not be blank

  first.name should not be blank

  au_sorted translation missing: en.test.should.be_true


------------------------


Failed_

  Total errors: 5



Assertions: 5. Failed: 5. Time: 123ms`;

        const result = parseTestResponse(response);

        expect(result.summary.assertions).toBe(5);
        expect(result.summary.failed).toBe(5);
        expect(result.summary.timeMs).toBe(123);
        expect(result.summary.totalErrors).toBe(5);

        expect(result.tests).toHaveLength(2);

        // First test - syntax error from JSON
        expect(result.tests[0].path).toBe('tests/timezones/convert_test');
        expect(result.tests[0].syntaxError).toBe(true);
        expect(result.tests[0].error.className).toBe('LiquidArgumentError');
        expect(result.tests[0].error.message).toContain('hash_merge filter');

        // Second test - indented format with failures
        expect(result.tests[1].path).toBe('tests/timezones/list_test');
        expect(result.tests[1].cases).toHaveLength(5);
        expect(result.tests[1].cases[0].passed).toBe(true); // should not be blank
        expect(result.tests[1].cases[1].passed).toBe(false); // translation missing
        expect(result.tests[1].cases[1].error).toContain('translation missing');
        expect(result.tests[1].passed).toBe(false);
      });
    });

    test('handles empty response', () => {
      const response = `Assertions: 0. Failed: 0. Time: 5ms`;

      const result = parseTestResponse(response);

      expect(result.tests).toHaveLength(0);
      expect(result.summary.assertions).toBe(0);
    });
  });

  describe('extractJsonObjects', () => {
    test('extracts single JSON object', () => {
      const str = '{"path":"test"}';
      const result = extractJsonObjects(str);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('test');
    });

    test('extracts multiple concatenated JSON objects', () => {
      const str = '{"path":"test"}{"error":"failed"}';
      const result = extractJsonObjects(str);

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('test');
      expect(result[1].error).toBe('failed');
    });

    test('handles nested objects', () => {
      const str = '{"path":"test","meta":{"count":5}}';
      const result = extractJsonObjects(str);

      expect(result).toHaveLength(1);
      expect(result[0].meta.count).toBe(5);
    });

    test('returns empty array for non-JSON string', () => {
      const str = 'not json at all';
      const result = extractJsonObjects(str);

      expect(result).toHaveLength(0);
    });
  });

  describe('testsRunTool', () => {
    test('has correct description and inputSchema', () => {
      expect(testsRunTool.description).toContain('tests');
      expect(testsRunTool.inputSchema.properties).toHaveProperty('env');
      expect(testsRunTool.inputSchema.properties).toHaveProperty('path');
      expect(testsRunTool.inputSchema.properties).toHaveProperty('name');
    });

    test('returns parsed test results on success', async () => {
      const mockRequest = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: `{"path":"tests/example"}
------------------------
Assertions: 3. Failed: 0. Time: 100ms`
      });

      const result = await testsRunTool.handler(
        { env: 'staging' },
        { request: mockRequest }
      );

      expect(result.ok).toBe(true);
      expect(result.data.summary.assertions).toBe(3);
      expect(result.data.summary.failed).toBe(0);
      expect(result.data.passed).toBe(true);
      expect(result.data.tests).toHaveLength(1);
      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
        uri: expect.stringContaining('/_tests/run?formatter=text')
      }));
    });

    test('includes path filter in URL when provided', async () => {
      const mockRequest = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: 'Assertions: 0. Failed: 0. Time: 10ms'
      });

      await testsRunTool.handler(
        { env: 'staging', path: 'tests/users' },
        { request: mockRequest }
      );

      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
        uri: expect.stringContaining('path=tests%2Fusers')
      }));
    });

    test('includes name filter in URL when provided', async () => {
      const mockRequest = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: 'Assertions: 0. Failed: 0. Time: 10ms'
      });

      await testsRunTool.handler(
        { env: 'staging', name: 'create_user_test' },
        { request: mockRequest }
      );

      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
        uri: expect.stringContaining('name=create_user_test')
      }));
    });

    test('includes both path and name filters in URL when provided', async () => {
      const mockRequest = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: 'Assertions: 0. Failed: 0. Time: 10ms'
      });

      await testsRunTool.handler(
        { env: 'staging', path: 'tests/users', name: 'create_user_test' },
        { request: mockRequest }
      );

      const callUri = mockRequest.mock.calls[0][0].uri;
      expect(callUri).toContain('path=tests%2Fusers');
      expect(callUri).toContain('name=create_user_test');
    });

    test('returns error on HTTP failure', async () => {
      const mockRequest = vi.fn().mockResolvedValue({
        statusCode: 500,
        body: 'Internal Server Error'
      });

      const result = await testsRunTool.handler(
        { env: 'staging' },
        { request: mockRequest }
      );

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('HTTP_ERROR');
      expect(result.error.statusCode).toBe(500);
    });

    test('returns error on network failure', async () => {
      const mockRequest = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await testsRunTool.handler(
        { env: 'staging' },
        { request: mockRequest }
      );

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe('TESTS_RUN_ERROR');
      expect(result.error.message).toContain('Network error');
    });

    test('correctly identifies failed tests', async () => {
      const mockRequest = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: `{"path":"tests/failing"}{"class_name":"AssertionError","message":"Expected true"}
------------------------
Assertions: 5. Failed: 2. Time: 150ms`
      });

      const result = await testsRunTool.handler(
        { env: 'staging' },
        { request: mockRequest }
      );

      expect(result.ok).toBe(true);
      expect(result.data.passed).toBe(false);
      expect(result.data.summary.failed).toBe(2);
    });
  });
});
