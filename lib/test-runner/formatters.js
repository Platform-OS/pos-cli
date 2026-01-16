const chalk = require('chalk');
const logger = require('../logger');

const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(2);
  return `${minutes}m ${seconds}s`;
};

const formatTestLog = (logRow, isTestLog) => {
  const message = logRow.message || '';
  const logType = logRow.error_type || '';
  const fullMessage = typeof message === 'string' ? message : JSON.stringify(message);
  const cleanMessage = fullMessage.replace(/\n$/, '');

  // Check if this message contains a path to a test file
  const hasTestPath = /app\/lib\/test\/|modules\/.*\/test\/|\.liquid/.test(cleanMessage);

  if (isTestLog && hasTestPath) {
    // Test log with path - highlight it (new test indicator)
    return chalk.cyan.bold(`▶ ${cleanMessage}\n`);
  } else if (isTestLog) {
    // Test log without path - normal display
    return chalk.white(`  ${cleanMessage}\n`);
  } else {
    // Debug log (type != test_name) - dim display
    return chalk.white(`  ${logType}: ${cleanMessage}\n`);
  }
};

/**
 * Transform API response format to internal format for printTestResults
 * API returns: { success, total_tests, total_assertions, total_errors, duration_ms, tests: [{name, success, assertions, errors}] }
 * Internal format: { passed, failed, total, tests: [{name, status, passed, error}], duration }
 */
const transformTestResponse = (response) => {
  const total = response.total_tests || response.total || 0;
  const totalErrors = response.total_errors || 0;
  const assertions = response.total_assertions || response.assertions || 0;
  const duration = response.duration_ms || response.duration || 0;

  let passed = 0;
  let failed = 0;

  if (response.success === true) {
    passed = total;
    failed = totalErrors;
  } else {
    failed = totalErrors || (total > 0 ? 1 : 0);
    passed = Math.max(0, total - failed);
  }

  const tests = [];
  if (response.tests && Array.isArray(response.tests)) {
    response.tests.forEach(test => {
      const testItem = {
        name: test.name || 'Unknown test',
        status: test.success ? 'passed' : 'failed',
        passed: test.success,
        assertions: test.assertions
      };

      // Handle errors - could be object with error details or array
      if (test.errors) {
        if (Array.isArray(test.errors) && test.errors.length > 0) {
          testItem.errors = test.errors;
        } else if (typeof test.errors === 'object' && Object.keys(test.errors).length > 0) {
          testItem.error = JSON.stringify(test.errors);
        }
      }

      tests.push(testItem);
    });
  }

  return { total, passed, failed, assertions, tests, duration };
};

const printTestResults = (results, duration) => {
  const { passed = 0, failed = 0, total = 0, tests = [] } = results;

  if (tests && tests.length > 0) {
    logger.Info('─'.repeat(60), { hideTimestamp: true });

    tests.forEach(test => {
      const status = test.status || (test.passed ? 'passed' : 'failed');
      const icon = status === 'passed' ? '✓' : '✗';
      const name = test.name || test.test_name || 'Unknown test';

      if (status === 'passed') {
        logger.Success(`  ${icon} ${name}`, { hideTimestamp: true });
      } else {
        logger.Error(`  ${icon} ${name}`, { hideTimestamp: true, exit: false, notify: false });
        if (test.error || test.message) {
          logger.Error(`    Error: ${test.error || test.message}`, { hideTimestamp: true, exit: false, notify: false });
        }
        if (test.errors && Array.isArray(test.errors)) {
          test.errors.forEach(err => {
            logger.Error(`    - ${err.message || err}`, { hideTimestamp: true, exit: false, notify: false });
          });
        }
      }
    });

    logger.Info('─'.repeat(60), { hideTimestamp: true });
  }

  // Print summary
  const totalTests = total || (passed + failed);
  const summary = [];
  if (passed > 0) summary.push(`${passed} passed`);
  if (failed > 0) summary.push(`${failed} failed`);

  const summaryText = summary.length > 0 ? summary.join(', ') : 'No tests executed';
  const durationText = duration ? ` in ${formatDuration(duration)}` : '';

  if (failed > 0) {
    logger.Error(`\n${summaryText} (${totalTests} total)${durationText}`, { hideTimestamp: true, exit: false, notify: false });
  } else if (passed > 0) {
    logger.Success(`\n${summaryText} (${totalTests} total)${durationText}`, { hideTimestamp: true });
  } else {
    logger.Warn(`\n${summaryText}${durationText}`, { hideTimestamp: true });
  }

  return failed === 0;
};

module.exports = {
  formatDuration,
  formatTestLog,
  transformTestResponse,
  printTestResults
};
