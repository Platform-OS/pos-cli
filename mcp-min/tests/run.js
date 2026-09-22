// platformos.tests.run - execute tests via /_tests/run?formatter=text
import log from '../log.js';
import { resolveAuth } from '../auth.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError, kindForStatus } from '../tool-error.js';
import makeRequest, { testAuthHeaders, testsUrl } from './request.js';
import { missingTestsModule } from './module-check.js';

/**
 * Parse the text response from /_tests/run?formatter=text
 *
 * Supports two formats:
 *
 * Format 1 (JSON):
 * {"path":"tests/example_test"}{"class_name":"...","message":"..."}
 * ------------------------
 * Assertions: 5. Failed: 1. Time: 123ms
 *
 * Format 2 (Text/Indented):
 * ------------------------
 * commands/questions/create_test
 *   build_valid should be valid:
 *   errors_populated translation missing: en.test.should.be_true
 * ------------------------
 * Failed_
 *   Total errors: 4
 * Assertions: 11. Failed: 4. Time: 267ms
 */
function parseTestResponse(text) {
  const lines = text.split('\n');
  const tests = [];
  let summary = { assertions: 0, failed: 0, timeMs: 0, totalErrors: 0 };

  let currentTestPath = null;
  let currentTestCases = [];
  let inFailedSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // Skip separator lines
    if (/^-+$/.test(trimmed)) {
      // If we have a current test, save it before moving on
      if (currentTestPath) {
        tests.push({
          path: currentTestPath,
          cases: currentTestCases,
          passed: currentTestCases.every(c => c.passed)
        });
        currentTestPath = null;
        currentTestCases = [];
      }
      continue;
    }

    // Check for summary line: "Assertions: X. Failed: Y. Time: Zms"
    const summaryMatch = trimmed.match(/Assertions:\s*(\d+)\.\s*Failed:\s*(\d+)\.\s*Time:\s*(\d+)ms/i);
    if (summaryMatch) {
      summary.assertions = parseInt(summaryMatch[1], 10);
      summary.failed = parseInt(summaryMatch[2], 10);
      summary.timeMs = parseInt(summaryMatch[3], 10);
      continue;
    }

    // Check for "Total errors: X" line
    const totalErrorsMatch = trimmed.match(/Total errors:\s*(\d+)/i);
    if (totalErrorsMatch) {
      summary.totalErrors = parseInt(totalErrorsMatch[1], 10);
      continue;
    }

    // Check for "Failed_" section marker
    if (trimmed === 'Failed_') {
      inFailedSection = true;
      continue;
    }

    // Skip lines in Failed_ section (we already have the info)
    if (inFailedSection) {
      continue;
    }

    // Check for "SYNTAX ERROR:" prefix - strip it and parse JSON
    let lineToParse = trimmed;
    let isSyntaxError = false;
    if (trimmed.startsWith('SYNTAX ERROR:')) {
      lineToParse = trimmed.slice('SYNTAX ERROR:'.length);
      isSyntaxError = true;
    }

    // Try to parse JSON objects from the line (Format 1)
    const jsonObjects = extractJsonObjects(lineToParse);
    if (jsonObjects.length > 0) {
      const testResult = { raw: jsonObjects };

      if (isSyntaxError) {
        testResult.syntaxError = true;
      }

      for (const obj of jsonObjects) {
        if (obj.path) {
          testResult.path = obj.path;
        }
        if (obj.class_name) {
          testResult.error = {
            className: obj.class_name,
            message: obj.message || ''
          };
        }
        if (obj.status) testResult.status = obj.status;
        if (obj.name) testResult.name = obj.name;
        if (obj.assertions !== undefined) testResult.assertions = obj.assertions;
        if (obj.failures !== undefined) testResult.failures = obj.failures;
      }

      tests.push(testResult);
      continue;
    }

    // Format 2: Check if this is an indented test case (starts with spaces)
    if (line.startsWith('  ') && currentTestPath) {
      // This is a test case line
      // Formats:
      // - "  build_valid should be valid:" - pass (ends with colon, describing expected state)
      // - "  result.results should not be blank" - pass (assertion description, no error)
      // - "  errors_populated translation missing: en.test..." - fail (has error message)

      const caseMatch = trimmed.match(/^(\S+)\s+(.*)$/);
      if (caseMatch) {
        const caseName = caseMatch[1];
        const rest = caseMatch[2];

        // Check for failure patterns - error messages typically contain these patterns
        const failurePatterns = [
          /translation missing:/i,
          /error:/i,
          /failed:/i,
          /exception:/i,
          /undefined method/i,
          /cannot find/i,
          /not found/i
        ];

        const isFailure = failurePatterns.some(pattern => pattern.test(rest));

        if (isFailure) {
          // Has error content - this is a failure
          currentTestCases.push({
            name: caseName,
            passed: false,
            error: rest
          });
        } else if (rest.match(/^[^:]+:$/)) {
          // Ends with ":" and nothing after - this is a pass with description
          // e.g., "should be valid:"
          const description = rest.slice(0, -1).trim();
          currentTestCases.push({
            name: caseName,
            description,
            passed: true
          });
        } else {
          // No error pattern and doesn't end with colon - treat as pass
          // e.g., "should not be blank"
          currentTestCases.push({
            name: caseName,
            description: rest,
            passed: true
          });
        }
      }
      continue;
    }

    // Format 2: Non-indented line that's not a separator or summary - likely a test path
    if (!line.startsWith(' ') && !trimmed.startsWith('{')) {
      // Save previous test if exists
      if (currentTestPath) {
        tests.push({
          path: currentTestPath,
          cases: currentTestCases,
          passed: currentTestCases.every(c => c.passed)
        });
      }
      currentTestPath = trimmed;
      currentTestCases = [];
    }
  }

  // Don't forget the last test if we ended without a separator
  if (currentTestPath) {
    tests.push({
      path: currentTestPath,
      cases: currentTestCases,
      passed: currentTestCases.every(c => c.passed)
    });
  }

  return { tests, summary };
}

/**
 * Extract JSON objects from a string that may contain multiple concatenated JSON objects
 */
function extractJsonObjects(str) {
  const objects = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === '{') {
      if (depth === 0) {
        start = i;
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const jsonStr = str.slice(start, i + 1);
        try {
          const parsed = JSON.parse(jsonStr);
          objects.push(parsed);
        } catch (e) {
          // Not the blob: it is the instance's response body, not ours to publish.
          log.debug('Failed to parse JSON object', { bytes: jsonStr.length, error: e.message });
        }
        start = -1;
      }
    }
  }

  return objects;
}

const testsRunTool = {
  description: 'Run tests on an instance and wait for the result. name is required because running every test times out; to run the whole suite, use tests-run-async.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...authProperties,
      // tests@1.3.5 filters on `name` alone (a `contains` match) and ignores `path` — TASK-51.
      path: { type: 'string', description: 'Ignored by the current tests module; narrow a run with name instead.' },
      name: { type: 'string', description: 'Any part of a test path, matched as a substring, e.g. create_user_test or users/. Test files live under app/lib and their path must end with _test; a deploy silently discards app/tests.' }
    },
    // `env` is not required: resolveAuth also accepts url+email+token, MPKIT_* env
    // vars, or falls back to the first .pos environment.
    required: ['name']
  },
  handler: async (params, ctx = {}) => {
    log.debug('tool:unit-tests-run invoked', { env: params?.env, path: params?.path });

    const auth = await resolveAuth(params, ctx);

    // Build the URL with query parameters
    let testUrl = testsUrl(auth.url, '/_tests/run?formatter=text');
    if (params?.path) {
      testUrl += `&path=${encodeURIComponent(params.path)}`;
    }
    if (params?.name) {
      testUrl += `&name=${encodeURIComponent(params.name)}`;
    }

    log.debug('Requesting tests', { url: testUrl });

    // Make the request
    const requestFn = ctx.request || makeRequest;
    const response = await requestFn({ method: 'GET', uri: testUrl, headers: testAuthHeaders(auth.token) });

    const statusCode = response.statusCode;
    const body = response.body;

    // The test endpoints answer with a status rather than throwing, so nothing reaches the
    // invoker to classify: the kind is decided here from the same status it would have read.
    if (statusCode >= 400) {
      throw (await missingTestsModule(statusCode, auth, ctx))
        ?? new ToolError(kindForStatus(statusCode), 'HTTP_ERROR', `Request failed with status ${statusCode}`, { statusCode, body });
    }

    // A run whose assertions failed is a run that happened: the failures are the answer, not an
    // error. Only a run that could not be made fails the call.
    const parsed = parseTestResponse(body);

    return {
      tests: parsed.tests,
      summary: parsed.summary,
      passed: parsed.summary.failed === 0,
      totalTests: parsed.tests.length,
      raw: body,
      url: testUrl
    };
  }
};

export default testsRunTool;
export { parseTestResponse, extractJsonObjects };
