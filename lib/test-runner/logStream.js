import EventEmitter from 'events';
import Gateway from '../proxy.js';
import logger from '../logger.js';
import { transformTestResponse } from './formatters.js';
import { newerOf } from '../logRowId.js';

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
    // A row id is a microsecond epoch at the edge of what a double holds, so it is never parsed:
    // `seen` decides what has been handled, and the cursor only goes back to the instance.
    this.lastId = '0';
    this.seen = new Set();
    this.intervalId = null;
    this.timeoutId = null;
    this.abortController = null;
  }

  isValidTestSummaryJson(message) {
    try {
      const obj = JSON.parse(message.trim());

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
    this.abortController = new AbortController();
    this.intervalId = setInterval(() => this.fetchLogs(), POLL_INTERVAL_MS);
    this.timeoutId = setTimeout(() => {
      this.emit('timeout');
      this.stop();
    }, this.timeout);

    logger.Debug('Starting test log streaming...');
  }

  stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
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
    if (!this.abortController) return;

    try {
      const response = await this.gateway.logs({ lastId: this.lastId }, { signal: this.abortController.signal });
      const logs = response && response.logs;
      if (!logs) return;

      for (let k in logs) {
        const row = logs[k];

        if (this.seen.has(row.id)) continue;
        this.seen.add(row.id);
        this.lastId = newerOf(this.lastId, row.id);

        logger.Debug(`[DEBUG] Processing log entry: ${JSON.stringify(row)}`);
        this.processLogMessage(row);
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      logger.Debug(`Error fetching logs: ${error.message}`);
    }
  }

  processLogMessage(row) {
    const message = row.message || '';
    const logType = row.error_type || '';
    const fullMessage = typeof message === 'string' ? message : JSON.stringify(message);
    const summaryType = this.testName ? `${this.testName} SUMMARY` : null;

    const cleanMessage = fullMessage.replace(/\r?\n$/, '');
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
      const summary = JSON.parse(message.trim());
      return transformTestResponse(summary);
    } catch (error) {
      logger.Debug(`[DEBUG] Failed to parse JSON summary: ${error.message}`);
      return null;
    }
  }
}

export { TestLogStream, DEFAULT_TIMEOUT_MS, POLL_INTERVAL_MS };
