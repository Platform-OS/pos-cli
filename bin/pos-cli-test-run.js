#!/usr/bin/env node

const EventEmitter = require('events');
const { program } = require('commander');
const chalk = require('chalk');
const Gateway = require('../lib/proxy');
const fetchAuthData = require('../lib/settings').fetchSettings;
const logger = require('../lib/logger');

const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(2);
  return `${minutes}m ${seconds}s`;
};

class TestLogStream extends EventEmitter {
  constructor(authData, timeout = 30000, testRunId = null, testName = null) {
    super();
    this.authData = authData;
    this.gateway = new Gateway(authData);
    this.timeout = timeout;
    this.testRunId = testRunId;
    this.testName = testName; // The test_name from run_async.js (e.g., "liquid_test_xxxxx")
    this.startTime = Date.now();
    this.testStarted = false;
    this.completed = false;
    this.messageBuffer = ''; // Buffer for multi-line messages
    this.lastMessageTime = 0;
    this.liquidTestSeen = false;
    this.liquidTestTime = 0;
    }

  isValidTestSummaryJson(message) {
    try {
      // Parse as JSON
      const obj = JSON.parse(message);

      // Check if it has test summary structure
      const hasTestsArray = Array.isArray(obj.tests);
      const hasSuccessField = typeof obj.success === 'boolean';
      const hasTotalField = typeof obj.total_tests === 'number' || typeof obj.total === 'number';
      const hasDurationField = typeof obj.duration_ms === 'number' || typeof obj.duration === 'number';

      // If we have a testRunId, check that it matches
      if (this.testRunId && obj.test_run_id !== this.testRunId) {
        return false;
      }

      return hasTestsArray && hasSuccessField && (hasTotalField || hasDurationField);
    } catch (e) {
      return false;
    }
  }

  start() {
    this.intervalId = setInterval(() => this.fetchLogs(), 2000);
    this.timeoutId = setTimeout(() => {
      this.emit('timeout');
      this.stop();
    }, this.timeout);

    logger.Debug('Starting test log streaming...');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  fetchLogs() {
    this.gateway.logs({ lastId: this.lastId || 0 })
      .then((response) => {
        const logs = response && response.logs;
        if (!logs) return;

        for (let k in logs) {
          const row = logs[k];

          if (this.lastId && row.id <= this.lastId) continue;
          this.lastId = row.id;

          logger.Debug(`[DEBUG] Processing log entry: ${JSON.stringify(row)}`);
          this.processLogMessage(row);
        }
      })
      .catch(error => {
        logger.Debug(`Error fetching logs: ${error.message}`);
      });
  }

  processLogMessage(row) {
    const message = row.message || '';
    const logType = row.error_type || '';
    const fullMessage = typeof message === 'string' ? message : JSON.stringify(message);
    const summaryType = this.testName ? `${this.testName} SUMMARY` : null;

    // Only process logs that are related to our test run
    // If we have a testName, filter by it
    if (this.testName) {
      // Check for test start - look for "Starting unit tests" or "Starting test run" with matching type
      if (logType === this.testName && (fullMessage.includes('Starting unit tests') || fullMessage.includes('Starting test run')) && !this.testStarted) {
        this.testStarted = true;
        this.emit('testStarted');
        return; // Don't emit this as a log
      }

      // Check for test completion - look for log with type "<test_name> SUMMARY"
      if (!this.completed && logType === summaryType && this.isValidTestSummaryJson(fullMessage)) {
        if (!this.liquidTestSeen) {
          this.liquidTestSeen = true;
          this.liquidTestTime = Date.now();
        }

        // Parse as JSON summary
        const testResults = this.parseJsonSummary(fullMessage);
        if (testResults) {
          this.completed = true;
          this.emit('testCompleted', testResults);
          this.stop();
          return;
        }
      }

      // Only show logs after test started and before completion
      if (this.testStarted && !this.completed) {
        // Determine if this is a test log (type matches test_name) or debug log (any other type)
        const isTestLog = logType === this.testName;
        this.emit('testLog', row, isTestLog);
      }
    } else {
      // Legacy behavior when testName is not available
      // Check for test start
      if (fullMessage.includes('Starting unit tests') && !this.testStarted) {
        this.testStarted = true;
        this.emit('testStarted');
      }

      // Check for test completion - look for the JSON summary format (tests module 1.1.1+)
      if (!this.completed && this.isValidTestSummaryJson(fullMessage)) {
        if (!this.liquidTestSeen) {
          this.liquidTestSeen = true;
          this.liquidTestTime = Date.now();
        }

        // Parse as JSON summary
        const testResults = this.parseJsonSummary(fullMessage);
        if (testResults) {
          this.completed = true;
          this.emit('testCompleted', testResults);
          this.stop();
          return;
        }
      }

      // Also show individual test logs
      if (this.testStarted && !this.completed) {
        this.emit('testLog', row, true);
      }
    }
  }

  parseJsonSummary(message) {
    try {
      // Parse JSON (already validated as valid by isValidTestSummaryJson)
      const summary = JSON.parse(message);
      
      // Map fields from tests module format to our internal format
      const total = summary.total_tests || summary.total || 0;
      const assertions = summary.total_assertions || summary.assertions || 0;
      const duration = summary.duration_ms || summary.duration || 0;
      
      // Calculate passed/failed from success flag
      let passed = 0;
      let failed = 0;
      
      if (summary.success === true) {
        passed = total;
        failed = summary.total_errors || 0;
      } else if (summary.success === false) {
        failed = summary.total_errors || 0;
        passed = Math.max(0, total - failed);
      }
      
      // Map individual tests
      const tests = [];
      if (summary.tests && Array.isArray(summary.tests)) {
        summary.tests.forEach(test => {
          const testItem = {
            name: test.name || 'Unknown test',
            status: test.success ? 'passed' : 'failed',
            passed: test.success,
            assertions: test.assertions
          };
          
          // Handle errors - could be object with error details or array
          // Check for array first since arrays are also objects in JavaScript
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
      
      return {
        total,
        passed,
        failed,
        assertions,
        tests,
        duration
      };
    } catch (error) {
      logger.Debug(`[DEBUG] Failed to parse JSON summary: ${error.message}`);
      return null;
    }
  }

  
}

const printTestResults = (results, duration) => {
  const { passed = 0, failed = 0, total = 0, tests = [] } = results;

  if (tests && tests.length > 0) {
    logger.Info('\nTest Results:', { hideTimestamp: true });
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

const transformTestResponse = (response) => {
  // Transform API response format to the format expected by printTestResults
  // API returns: { success, total_tests, total_assertions, total_errors, duration_ms, tests: [{name, success, assertions, errors}] }
  // printTestResults expects: { passed, failed, total, tests: [{name, status, passed, error}], duration }

  const total = response.total_tests || response.total || 0;
  const totalErrors = response.total_errors || 0;

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
        if (typeof test.errors === 'object' && Object.keys(test.errors).length > 0) {
          testItem.error = JSON.stringify(test.errors);
        } else if (Array.isArray(test.errors) && test.errors.length > 0) {
          testItem.errors = test.errors;
        }
      }

      tests.push(testItem);
    });
  }

  return {
    total,
    passed,
    failed,
    assertions: response.total_assertions || 0,
    tests,
    duration: response.duration_ms || response.duration || 0
  };
};

const runSingleTest = async (gateway, name) => {
  const startTime = Date.now();

  try {
    const response = await gateway.test(name);
    const duration = Date.now() - startTime;

    if (!response) {
      logger.Error('No response received from test endpoint');
      return false;
    }

    // Handle error response (not test failure, but actual error)
    if (response.error && !response.tests) {
      logger.Error(`Test error: ${response.error}`);
      return false;
    }

    // Handle the JSON response from /_tests/run.js
    if (typeof response === 'object') {
      const transformedResults = transformTestResponse(response);
      return printTestResults(transformedResults, transformedResults.duration || duration);
    }

    // Fallback for unexpected response format
    logger.Print(JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    // Handle HTTP 500 errors that contain valid test results
    // The test endpoint returns 500 when tests fail, but includes results in the body
    const errorMessage = error.message || '';
    const jsonMatch = errorMessage.match(/^(\d+)\s*-\s*(\{.+\})$/);

    if (jsonMatch) {
      try {
        const response = JSON.parse(jsonMatch[2]);
        if (response.tests && Array.isArray(response.tests)) {
          const transformedResults = transformTestResponse(response);
          return printTestResults(transformedResults, transformedResults.duration);
        }
      } catch (parseError) {
        // Fall through to generic error handling
      }
    }

    logger.Error(`Failed to execute test: ${error.message}`);
    return false;
  }
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
    return chalk.cyan.bold(`▶ ${cleanMessage}`);
  } else if (isTestLog) {
    // Test log without path - normal display
    return chalk.white(`  ${cleanMessage}`);
  } else {
    // Debug log (type != test_name) - dim display
    return chalk.dim(`  [debug:${logType}] ${cleanMessage}`);
  }
};

const runAllTests = async (gateway, authData) => {
  return new Promise((resolve, reject) => {
    let resolved = false;

    // Start the test run and get the test_run_id and test_name
    logger.Info('Starting test run...');
    gateway.testRunAsync().then(testRunResponse => {
      const testRunId = testRunResponse && testRunResponse.test_run_id;
      const testName = testRunResponse && testRunResponse.test_name;

      logger.Debug(`Test run started with test_name: ${testName}`);

      const stream = new TestLogStream(authData, 180000, testRunId, testName); // 3 minute timeout for async tests

    const finish = (result) => {
      if (resolved) return; // Prevent multiple resolutions
      resolved = true;
      stream.stop();
      resolve(result);
    };

    stream.on('testStarted', () => {
      logger.Info('Test execution started...', { hideTimestamp: true });
    });

    stream.on('testLog', (logRow, isTestLog) => {
      // Display individual test logs with syntax highlighting
      const message = logRow.message || '';
      const fullMessage = typeof message === 'string' ? message : JSON.stringify(message);

      // Don't show JSON summary messages as logs - they will be processed as completion signals
      if (stream.isValidTestSummaryJson(fullMessage)) {
        return;
      }

      // Format and display the log with appropriate highlighting
      const formattedLog = formatTestLog(logRow, isTestLog);
      console.log(formattedLog);
    });

    stream.on('testCompleted', (results) => {
      logger.Info('Test execution completed, processing results...', { hideTimestamp: true });
      const success = printTestResults(results, results.duration);
      finish(success);
    });

    stream.on('timeout', () => {
      logger.Error('Test execution timed out - no completion message received within 3 minutes');
      finish(false);
    });

      // Start listening for logs
      stream.start();
    }).catch(error => {
      logger.Error(`Failed to start test execution: ${error.message}`);
      resolve(false);
    });
  });
};

program
  .name('pos-cli test run')
  .argument('<environment>', 'name of environment. Example: staging')
  .argument('[name]', 'name of the test to execute (runs all tests if not provided)')
  .action(async (environment, name) => {
    const authData = fetchAuthData(environment, program);
    const gateway = new Gateway(authData);

    try {
      // Display the instance URL for clarity
      logger.Info(`Running tests on: ${authData.url}`, { hideTimestamp: true });
      // First check if tests module is installed
      const modules = await gateway.listModules();
      const hasTestsModule = modules.data && modules.data.some(module => module === 'tests');

      if (!hasTestsModule) {
        logger.Error(`Tests module not found. Please install the tests module:
  pos-cli modules install tests
  pos-cli deploy ${environment}
Then re-run the command.`);
        process.exit(1);
      }

      let success;
      if (name) {
        // Run single test with .js format
        success = await runSingleTest(gateway, name);
      } else {
        // Run all tests via run_async with log streaming
        success = await runAllTests(gateway, authData);
      }

      process.exit(success ? 0 : 1);
    } catch (error) {
      logger.Error(`Failed to execute test: ${error.message}`);
      process.exit(1);
    }
  });

// Only parse arguments if this file is run directly, not when required for testing
if (require.main === module) {
  program.parse(process.argv);
}

// Export for testing
module.exports = {
  TestLogStream,
  formatDuration,
  formatTestLog,
  printTestResults,
  runAllTests
};
