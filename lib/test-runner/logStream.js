const EventEmitter = require('events');
const Gateway = require('../proxy');
const logger = require('../logger');
const { transformTestResponse } = require('./formatters');

// Constants
const DEFAULT_TIMEOUT_MS = 30000;
const POLL_INTERVAL_MS = 2000;

class TestLogStream extends EventEmitter {
  constructor(authData, timeout = DEFAULT_TIMEOUT_MS, testName = null) {
    super();
    this.authData = authData;
    this.gateway = new Gateway(authData);
    this.timeout = timeout;
    this.testName = testName;
    this.startTime = Date.now();
    this.testStarted = false;
    this.completed = false;
    this.lastId = 0;
    this.intervalId = null;
    this.timeoutId = null;
  }

  isValidTestSummaryJson(message) {
    try {
      const obj = JSON.parse(message);

      const hasTestsArray = Array.isArray(obj.tests);
      const hasSuccessField = typeof obj.success === 'boolean';
      const hasTotalField = typeof obj.total_tests === 'number' || typeof obj.total === 'number';
      const hasDurationField = typeof obj.duration_ms === 'number' || typeof obj.duration === 'number';

      return hasTestsArray && hasSuccessField && (hasTotalField || hasDurationField);
    } catch (e) {
      return false;
    }
  }

  start() {
    this.intervalId = setInterval(() => this.fetchLogs(), POLL_INTERVAL_MS);
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

  async fetchLogs() {
    try {
      const response = await this.gateway.logs({ lastId: this.lastId || 0 });
      const logs = response && response.logs;
      if (!logs) return;

      for (let k in logs) {
        const row = logs[k];

        if (this.lastId && row.id <= this.lastId) continue;
        this.lastId = row.id;

        logger.Debug(`[DEBUG] Processing log entry: ${JSON.stringify(row)}`);
        this.processLogMessage(row);
      }
    } catch (error) {
      logger.Debug(`Error fetching logs: ${error.message}`);
    }
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
        return;
      }

      // Check for test completion - look for log with type "<test_name> SUMMARY"
      if (!this.completed && logType === summaryType && this.isValidTestSummaryJson(fullMessage)) {
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
        const isTestLog = logType === this.testName;
        this.emit('testLog', row, isTestLog);
      }
    } else {
      // Legacy behavior when testName is not available
      if (fullMessage.includes('Starting unit tests') && !this.testStarted) {
        this.testStarted = true;
        this.emit('testStarted');
      }

      // Check for test completion - look for the JSON summary format (tests module 1.1.1+)
      if (!this.completed && this.isValidTestSummaryJson(fullMessage)) {
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
      const summary = JSON.parse(message);
      return transformTestResponse(summary);
    } catch (error) {
      logger.Debug(`[DEBUG] Failed to parse JSON summary: ${error.message}`);
      return null;
    }
  }
}

module.exports = {
  TestLogStream,
  DEFAULT_TIMEOUT_MS,
  POLL_INTERVAL_MS
};
