import EventEmitter from 'events';
import Gateway from '../proxy.js';
import logger from '../logger.js';
import { transformTestResponse } from './formatters.js';

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
    } catch {
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

    const cleanMessage = fullMessage.replace(/\n$/, '');
    const hasTestPath = /app\/lib\/test\/|modules\/.*\/test\/|\.liquid/.test(cleanMessage);

    if (this.testName) {
      if (logType === this.testName && (fullMessage.includes('Starting unit tests') || fullMessage.includes('Starting test run')) && !this.testStarted) {
        this.testStarted = true;
        this.emit('testStarted');
        return;
      }

      if (!this.completed && logType === summaryType && this.isValidTestSummaryJson(fullMessage)) {
        const testResults = this.parseJsonSummary(fullMessage);
        if (testResults) {
          this.completed = true;
          this.emit('testCompleted', testResults);
          this.stop();
          return;
        }
      }

      if (this.testStarted && !this.completed) {
        this.emit('testLog', row, logType === this.testName);
      }

      if (!this.testStarted && !this.completed && logType === this.testName && hasTestPath) {
        this.testStarted = true;
        this.emit('testStarted');
        this.emit('testLog', row, true);
      }
    } else {
      if (fullMessage.includes('Starting unit tests') && !this.testStarted) {
        this.testStarted = true;
        this.emit('testStarted');
      }

      if (!this.completed && this.isValidTestSummaryJson(fullMessage)) {
        const testResults = this.parseJsonSummary(fullMessage);
        if (testResults) {
          this.completed = true;
          this.emit('testCompleted', testResults);
          this.stop();
          return;
        }
      }

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

export { TestLogStream, DEFAULT_TIMEOUT_MS, POLL_INTERVAL_MS };
