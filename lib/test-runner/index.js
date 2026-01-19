import Gateway from '../proxy.js';
import ServerError from '../ServerError.js';
import logger from '../logger.js';
import { TestLogStream } from './logStream.js';
import { formatTestLog, transformTestResponse, printTestResults } from './formatters.js';

const ASYNC_TEST_TIMEOUT_MS = 180000;

const runSingleTest = async (gateway, name) => {
  const startTime = Date.now();

  try {
    const response = await gateway.test(name);
    const duration = Date.now() - startTime;

    if (!response) {
      logger.Error('No response received from test endpoint', { exit: false });
      return false;
    }

    if (response.error && !response.tests) {
      logger.Error(`Test error: ${response.error}`, { exit: false });
      return false;
    }

    if (typeof response === 'object') {
      const transformedResults = transformTestResponse(response);
      return printTestResults(transformedResults, transformedResults.duration || duration);
    }

    logger.Print(JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    const errorMessage = error.message || '';
    const jsonMatch = errorMessage.match(/^(\d+)\s*-\s*(\{.+\})$/);

    if (jsonMatch) {
      try {
        const response = JSON.parse(jsonMatch[2]);
        if (response.tests && Array.isArray(response.tests)) {
          const transformedResults = transformTestResponse(response);
          return printTestResults(transformedResults, transformedResults.duration);
        }
      } catch {
        // JSON parse failed, continue with regular error handling
      }
    }

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

    stream = new TestLogStream(authData, ASYNC_TEST_TIMEOUT_MS, null);

    stream.on('testStarted', () => {
      logger.Info('Test execution started', { hideTimestamp: true });
    });

    stream.on('testLog', (logRow, isTestLog) => {
      const message = logRow.message || '';
      const logType = logRow.error_type || '';
      const fullMessage = typeof message === 'string' ? message : JSON.stringify(message);
      const summaryType = stream.testName ? `${stream.testName} SUMMARY` : null;

      const isSummaryLog = summaryType && logType === summaryType && stream.isValidTestSummaryJson(fullMessage);
      if (isSummaryLog) {
        return;
      }

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

    stream.start();

    gateway.testRunAsync()
      .then(testRunResponse => {
        if (!testRunResponse) {
          logger.Error('No response received from test endpoint', { exit: false });
          finish(false);
          return;
        }

        if (testRunResponse.error) {
          logger.Error(`Test error: ${testRunResponse.error}`, { exit: false });
          finish(false);
          return;
        }

        testName = testRunResponse.test_name;

        logger.Debug(`Test run started with test_name: ${testName}`);

        stream.testName = testName;
      })
      .catch(error => {
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

export { run, runSingleTest, runAllTests, checkTestsModule, ASYNC_TEST_TIMEOUT_MS };
