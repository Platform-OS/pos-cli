/* global jest */

const exec = require('./utils/exec');
const cliPath = require('./utils/cliPath');

require('dotenv').config();

const cwd = name => `${process.cwd()}/test/fixtures/test/${name}`;

const run = (fixtureName, options) => exec(`${cliPath} test run ${options || ''}`, { cwd: cwd(fixtureName), env: process.env });
const deploy = (fixtureName) => exec(`${cliPath} deploy staging`, { cwd: cwd(fixtureName), env: process.env });

jest.setTimeout(200000); // Test run can take a while due to log polling

describe('Test run command', () => {
  // Deploy the test fixtures before running any tests
  beforeAll(async () => {
    const { stdout, stderr } = await deploy('with-tests-module');
    if (!stdout.includes('Deploy succeeded')) {
      console.error('Deploy failed:', stderr);
      throw new Error('Failed to deploy test fixtures');
    }
  });

  test('displays instance URL when running tests', async () => {
    const { stdout, stderr } = await run('with-tests-module', 'staging');

    expect(stdout).toMatch(`Running tests on: ${process.env.MPKIT_URL}`);
  });

  // Note: This test requires a staging instance WITHOUT the tests module installed.
  // Since integration tests require the tests module to be deployed, this test
  // is skipped when run against the same instance.
  test.skip('shows error when tests module is not installed', async () => {
    const { stderr } = await run('without-tests-module', 'staging');

    expect(stderr).toMatch('Tests module not found');
  });

  test('runs all tests and shows results when no test name provided', async () => {
    const { stdout, stderr, code } = await run('with-tests-module', 'staging');

    // Verify test execution started
    expect(stdout).toMatch('Starting test run...');

    // Verify test results are actually displayed (not just hanging)
    // The output should include either test results summary or individual test status
    const hasTestResults = stdout.includes('passed') ||
                          stdout.includes('failed') ||
                          stdout.includes('Test Results:') ||
                          stdout.includes('total)');

    expect(hasTestResults).toBe(true);
  });

  test('runs a single passing test by name and shows success', async () => {
    const { stdout, stderr, code } = await run('with-tests-module', 'staging example_test');

    // Verify test results are displayed
    expect(stdout).toMatch('Test Results:');

    // Verify the passing test is shown as passed (with checkmark)
    expect(stdout).toMatch(/✓.*example_test/);

    // Verify summary shows 1 passed
    expect(stdout).toMatch('1 passed');

    // Exit code should be 0 for passing test
    expect(code).toBe(0);
  });

  test('runs a single failing test by name and shows failure', async () => {
    const { stdout, stderr, code } = await run('with-tests-module', 'staging failing_test');

    // Verify test results are displayed
    expect(stdout + stderr).toMatch('Test Results:');

    // Verify the failing test is shown as failed (with X mark)
    expect(stdout + stderr).toMatch(/✗.*failing_test/);

    // Verify summary shows 1 failed
    expect(stdout + stderr).toMatch('1 failed');

    // Exit code should be 1 for failing test
    expect(code).toBe(1);
  });
});