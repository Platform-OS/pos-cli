// platformos.tests.run - execute tests via /_tests/run?formatter=text
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { DEBUG, debugLog } from '../config.js';

const files = require('../../lib/files');
const settings = require('../../lib/settings');
const requestPromise = require('request-promise');

function maskToken(token) {
  if (!token) return token;
  return token.slice(0, 3) + '...' + token.slice(-3);
}

function resolveAuth(params) {
  if (params?.url && params?.email && params?.token) {
    return { url: params.url, email: params.email, token: params.token, source: 'params' };
  }
  const { MPKIT_URL, MPKIT_EMAIL, MPKIT_TOKEN } = process.env;
  if (MPKIT_URL && MPKIT_EMAIL && MPKIT_TOKEN) {
    return { url: MPKIT_URL, email: MPKIT_EMAIL, token: MPKIT_TOKEN, source: 'env' };
  }
  if (params?.env) {
    const found = settings.fetchSettings(params.env);
    if (found) return { ...found, source: `.pos(${params.env})` };
  }
  const conf = files.getConfig();
  const firstEnv = conf && Object.keys(conf)[0];
  if (firstEnv) {
    const found = conf[firstEnv];
    if (found) return { ...found, source: `.pos(${firstEnv})` };
  }
  throw new Error('AUTH_MISSING: Provide url,email,token or configure .pos / MPKIT_* env vars');
}

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
          // Invalid JSON, skip
          DEBUG && debugLog('Failed to parse JSON object', { jsonStr, error: e.message });
        }
        start = -1;
      }
    }
  }

  return objects;
}

const testsRunTool = {
  description: 'Run platformOS tests via /_tests/run endpoint. Returns parsed test results with assertions count, failures, and timing.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      env: { type: 'string', description: 'Environment name from .pos config' },
      url: { type: 'string', description: 'Instance URL (alternative to env)' },
      email: { type: 'string', description: 'Account email (alternative to env)' },
      token: { type: 'string', description: 'API token (alternative to env)' },
      path: { type: 'string', description: 'Optional test path filter (e.g., "tests/users")' },
      name: { type: 'string', description: 'Optional test name filter' }
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();
    DEBUG && debugLog('tool:unit-tests-run invoked', { env: params?.env, path: params?.path });

    try {
      const auth = resolveAuth(params);

      // Build the URL with query parameters
      let testUrl = `${auth.url}/_tests/run?formatter=text`;
      if (params?.path) {
        testUrl += `&path=${encodeURIComponent(params.path)}`;
      }
      if (params?.name) {
        testUrl += `&name=${encodeURIComponent(params.name)}`;
      }

      DEBUG && debugLog('Requesting tests', { url: testUrl });

      // Make the request - use the request-promise library directly
      const requestFn = ctx.request || requestPromise;
      const response = await requestFn({
        method: 'GET',
        uri: testUrl,
        headers: {
          'Authorization': `Token ${auth.token}`,
          'UserTemporaryToken': auth.token
        },
        simple: false,
        resolveWithFullResponse: true
      });

      const statusCode = response.statusCode;
      const body = response.body;

      if (statusCode >= 400) {
        return {
          ok: false,
          error: {
            code: 'HTTP_ERROR',
            message: `Request failed with status ${statusCode}`,
            statusCode,
            body
          },
          meta: {
            url: testUrl,
            startedAt,
            finishedAt: new Date().toISOString(),
            auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source }
          }
        };
      }

      // Parse the response
      const parsed = parseTestResponse(body);

      return {
        ok: true,
        data: {
          tests: parsed.tests,
          summary: parsed.summary,
          passed: parsed.summary.failed === 0,
          totalTests: parsed.tests.length
        },
        raw: body,
        meta: {
          url: testUrl,
          startedAt,
          finishedAt: new Date().toISOString(),
          auth: { url: auth.url, email: auth.email, token: maskToken(auth.token), source: auth.source }
        }
      };
    } catch (e) {
      DEBUG && debugLog('tool:unit-tests-run error', { error: String(e) });
      return {
        ok: false,
        error: { code: 'TESTS_RUN_ERROR', message: String(e.message || e) }
      };
    }
  }
};

export default testsRunTool;
export { parseTestResponse, extractJsonObjects };
