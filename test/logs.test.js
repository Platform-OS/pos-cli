import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import Gateway from '../lib/proxy.js';
import { fetchSettings } from '../lib/settings.js';
import { hasRealCredentials, requireRealCredentials } from './utils/credentials';

vi.setConfig({ testTimeout: 20000 });

const generateUniqueId = () => `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const startLogsProcess = (options = []) => {
  const args = [
    path.join(process.cwd(), 'bin', 'pos-cli.js'),
    'logs',
    '--interval', '500',
    ...options
  ];

  const logsProcess = spawn('node', args, {
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let output = '';

  logsProcess.stdout.on('data', (data) => {
    output += data.toString();
  });

  logsProcess.stderr.on('data', (data) => {
    output += data.toString();
  });

  return {
    process: logsProcess,
    getOutput: () => output,
    kill: () => {
      logsProcess.stdout.destroy();
      logsProcess.stderr.destroy();
      logsProcess.kill();
    }
  };
};

const waitForLog = async (getOutput, uniqueId, maxWaitTime = 8000) => {
  const checkInterval = 100;
  let waited = 0;

  while (waited < maxWaitTime) {
    if (getOutput().includes(uniqueId)) {
      return true;
    }
    await sleep(checkInterval);
    waited += checkInterval;
  }
  return false;
};

const execLiquidLog = async (message, type) => {
  const liquidCode = type
    ? `{% log '${message}', type: '${type}' %}`
    : `{% log '${message}' %}`;

  const authData = fetchSettings();
  const gateway = new Gateway(authData);
  return gateway.liquid({ content: liquidCode });
};

describe('pos-cli logs integration', () => {
  beforeAll(() => {
    requireRealCredentials();
  });

  test('displays log messages with and without type', { retry: 2 }, async () => {
    const testId = generateUniqueId();
    const logWithType = { message: `With type: ${testId}`, type: 'pos-cli-test' };
    const logWithoutType = { message: `Default type: ${testId}` };

    const logs = startLogsProcess();
    try {
      const [result1, result2] = await Promise.all([
        execLiquidLog(logWithType.message, logWithType.type),
        execLiquidLog(logWithoutType.message)
      ]);

      expect(result1.error).toBeNull();
      expect(result2.error).toBeNull();

      const [found1, found2] = await Promise.all([
        waitForLog(logs.getOutput, logWithType.message),
        waitForLog(logs.getOutput, logWithoutType.message)
      ]);

      expect(found1).toBe(true);
      expect(found2).toBe(true);
      expect(logs.getOutput()).toContain(logWithType.type);
      expect(logs.getOutput()).toContain(logWithType.message);
      expect(logs.getOutput()).toContain(logWithoutType.message);
    } finally {
      logs.kill();
    }
  });

  test('filters logs to show only matching type', { retry: 2 }, async () => {
    const testId = generateUniqueId();
    const matchingLog = { message: `Matching: ${testId}`, type: 'filter-test-type' };
    const nonMatchingLog = { message: `Non-matching: ${testId}`, type: 'other-type' };

    const logs = startLogsProcess(['--filter', matchingLog.type]);
    try {
      const [result1, result2] = await Promise.all([
        execLiquidLog(nonMatchingLog.message, nonMatchingLog.type),
        execLiquidLog(matchingLog.message, matchingLog.type)
      ]);

      expect(result1.error).toBeNull();
      expect(result2.error).toBeNull();

      const foundMatching = await waitForLog(logs.getOutput, matchingLog.message);
      expect(foundMatching).toBe(true);

      expect(logs.getOutput()).toContain(matchingLog.message);
      expect(logs.getOutput()).not.toContain(nonMatchingLog.message);
    } finally {
      logs.kill();
    }
  });
});
