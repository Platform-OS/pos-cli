#!/usr/bin/env node

const { program } = require('commander');
const fetchAuthData = require('../lib/settings').fetchSettings;
const testRunner = require('../lib/test-runner');

program
  .name('pos-cli test run')
  .argument('<environment>', 'name of environment. Example: staging')
  .argument('[name]', 'name of the test to execute (runs all tests if not provided)')
  .action(async (environment, name) => {
    const authData = fetchAuthData(environment, program);
    const success = await testRunner.run(authData, environment, name);
    process.exit(success ? 0 : 1);
  });

// Only parse arguments if this file is run directly, not when required for testing
if (require.main === module) {
  program.parse(process.argv);
}

// Export for testing - re-export from lib modules
const { TestLogStream } = require('../lib/test-runner/logStream');
const { formatDuration, formatTestLog, printTestResults } = require('../lib/test-runner/formatters');
const { runAllTests } = require('../lib/test-runner');

module.exports = {
  TestLogStream,
  formatDuration,
  formatTestLog,
  printTestResults,
  runAllTests
};
