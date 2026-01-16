const Gateway = require('../proxy');
const ServerError = require('../ServerError');
const logger = require('../logger');
const { TestLogStream } = require('./logStream');
const { formatTestLog, transformTestResponse, printTestResults } = require('./formatters');

// Constants
const ASYNC_TEST_TIMEOUT_MS = 180000; // 3 minutes for async tests

const runSingleTest = async (gateway, name) => {
  const startTime = Date.now();

  try {
    const response = await gateway.test(name);
    const duration = Date.now() - startTime;

    if (!response) {
      logger.Error('No response received from test endpoint', { exit: false });
      return false;
    }

    // Handle error response (not test failure, but actual error)
    if (response.error && !response.tests) {
      logger.Error(`Test error: ${response.error}`, { exit: false });
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

    // Use ServerError for network errors
    if (ServerError.isNetworkError(error)) {
      ServerError.handler(error);
      return false;
    }

    logger.Error(`Failed to execute test: ${error.message}`, { exit: false });
    return false;
  }
};

const runAllTests = async (gateway, authData) => {
  return new Promise((resolve) => {
    let resolved = false;
    let stream = null;
    let testName = null;

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      if (stream) {
        stream.stop();
      }
      resolve(result);
    };

    // Create stream first so we don't miss any logs
    stream = new TestLogStream(authData, ASYNC_TEST_TIMEOUT_MS, null);

    stream.on('testStarted', () => {
      logger.Info('Test execution started', { hideTimestamp: true });
    });

    stream.on('testLog', (logRow, isTestLog) => {
      const message = logRow.message || '';
      const logType = logRow.error_type || '';
      const fullMessage = typeof message === 'string' ? message : JSON.stringify(message);
      // Use stream.testName to handle logs that arrive before testRunAsync completes
      const summaryType = stream.testName ? `${stream.testName} SUMMARY` : null;

      // Don't show JSON summary messages as logs - they will be processed as completion signals
      // Only skip if error_type matches expected summary type to avoid filtering user logs
      const isSummaryLog = summaryType && logType === summaryType && stream.isValidTestSummaryJson(fullMessage);
      if (isSummaryLog) {
        return;
      }

      // Format and display the log with appropriate highlighting
      const formattedLog = formatTestLog(logRow, isTestLog);
      logger.Print(formattedLog);
    });

    stream.on('testCompleted', (results) => {
      logger.Info('Test execution completed.', { hideTimestamp: true });
      const success = printTestResults(results, results.duration);
      finish(success);
    });

    stream.on('timeout', () => {
      logger.Error('Test execution timed out - no completion message received within 3 minutes', { exit: false });
      finish(false);
    });

    // Start listening for logs before starting the test
    stream.start();

    gateway.testRunAsync()
      .then(testRunResponse => {
        if (!testRunResponse) {
          logger.Error('No response received from test endpoint', { exit: false });
          finish(false);
          return;
        }

        // Handle error response from testRunAsync
        if (testRunResponse.error) {
          logger.Error(`Test error: ${testRunResponse.error}`, { exit: false });
          finish(false);
          return;
        }

        testName = testRunResponse.test_name;

        logger.Debug(`Test run started with test_name: ${testName}`);

        // Update stream with the test name for filtering
        stream.testName = testName;
      })
      .catch(error => {
        // Use ServerError for network errors
        if (ServerError.isNetworkError(error)) {
          ServerError.handler(error);
        } else {
          logger.Error(`Failed to start test execution: ${error.message}`, { exit: false });
        }
        finish(false);
      });
  });
};

const checkTestsModule = async (gateway, environment) => {
  try {
    const modules = await gateway.listModules();
    const hasTestsModule = modules && modules.data && modules.data.some(module => module === 'tests');

    if (!hasTestsModule) {
      logger.Error(`Tests module not found. Please install the tests module:
  pos-cli modules install tests
  pos-cli deploy ${environment}
Then re-run the command.`, { exit: false });
      return false;
    }
    return true;
  } catch (error) {
    if (ServerError.isNetworkError(error)) {
      ServerError.handler(error);
    } else {
      logger.Error(`Failed to check installed modules: ${error.message}`, { exit: false });
    }
    return false;
  }
};

const run = async (authData, environment, testName) => {
  const gateway = new Gateway(authData);

  logger.Info(`Running tests on: ${authData.url}`, { hideTimestamp: true });

  // First check if tests module is installed
  const hasModule = await checkTestsModule(gateway, environment);
  if (!hasModule) {
    return false;
  }

  if (testName) {
    return runSingleTest(gateway, testName);
  } else {
    return runAllTests(gateway, authData);
  }
};

module.exports = {
  run,
  runSingleTest,
  runAllTests,
  checkTestsModule,
  ASYNC_TEST_TIMEOUT_MS
};
