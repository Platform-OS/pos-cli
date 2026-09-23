/**
 * Unit tests for data utility functions
 * Tests isValidJSON and waitForStatus
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('#lib/logger.js', () => ({
  default: {
    Debug: vi.fn(),
    Warn: vi.fn(),
    Error: vi.fn(),
    Info: vi.fn(),
    Success: vi.fn()
  }
}));

import isValidJSON from '#lib/data/isValidJSON.js';
import waitForStatus from '#lib/data/waitForStatus.js';
import logger from '#lib/logger.js';

describe('isValidJSON', () => {
  test('returns true for valid JSON object', () => {
    expect(isValidJSON('{"name": "test"}')).toBe(true);
  });

  test('returns true for valid JSON array', () => {
    expect(isValidJSON('[1, 2, 3]')).toBe(true);
  });

  test('returns true for valid JSON string', () => {
    expect(isValidJSON('"hello"')).toBe(true);
  });

  test('returns true for valid JSON number', () => {
    expect(isValidJSON('42')).toBe(true);
  });

  test('returns true for valid JSON boolean', () => {
    expect(isValidJSON('true')).toBe(true);
    expect(isValidJSON('false')).toBe(true);
  });

  test('returns true for valid JSON null', () => {
    expect(isValidJSON('null')).toBe(true);
  });

  test('returns true for complex nested JSON', () => {
    const json = JSON.stringify({
      users: [
        { id: 1, name: 'Alice', roles: ['admin'] },
        { id: 2, name: 'Bob', roles: ['user'] }
      ],
      meta: { total: 2, page: 1 }
    });
    expect(isValidJSON(json)).toBe(true);
  });

  test('returns true for empty JSON object', () => {
    expect(isValidJSON('{}')).toBe(true);
  });

  test('returns true for empty JSON array', () => {
    expect(isValidJSON('[]')).toBe(true);
  });

  test('returns false for invalid JSON - missing quotes', () => {
    expect(isValidJSON('{name: "test"}')).toBe(false);
  });

  test('returns false for invalid JSON - trailing comma', () => {
    expect(isValidJSON('{"name": "test",}')).toBe(false);
  });

  test('returns false for invalid JSON - single quotes', () => {
    expect(isValidJSON("{'name': 'test'}")).toBe(false);
  });

  test('returns false for plain text', () => {
    expect(isValidJSON('hello world')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isValidJSON('')).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(isValidJSON(undefined)).toBe(false);
  });

  test('returns false for JavaScript object literal', () => {
    expect(isValidJSON('{ name: "test" }')).toBe(false);
  });
});

describe('waitForStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('resolves immediately when status is success', async () => {
    const statusCheck = vi.fn().mockResolvedValue({ status: 'done' });
    const pendingStatus = ['pending', 'processing'];
    const successStatus = 'done';

    const promise = waitForStatus(statusCheck, pendingStatus, successStatus, 1000);

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ status: 'done' });
    expect(statusCheck).toHaveBeenCalledTimes(1);
  });

  test('polls until success status is reached', async () => {
    const statusCheck = vi.fn()
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'processing' })
      .mockResolvedValueOnce({ status: 'done' });

    const pendingStatus = ['pending', 'processing'];
    const successStatus = 'done';

    const promise = waitForStatus(statusCheck, pendingStatus, successStatus, 1000);

    // First call - pending
    await vi.advanceTimersByTimeAsync(0);
    expect(statusCheck).toHaveBeenCalledTimes(1);

    // Second call - processing
    await vi.advanceTimersByTimeAsync(1000);
    expect(statusCheck).toHaveBeenCalledTimes(2);

    // Third call - done
    await vi.advanceTimersByTimeAsync(1000);
    expect(statusCheck).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toEqual({ status: 'done' });
  });

  test('rejects when status is failed', async () => {
    const statusCheck = vi.fn()
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'failed' });

    const pendingStatus = ['pending'];
    const successStatus = 'done';

    const promise = waitForStatus(statusCheck, pendingStatus, successStatus, 1000);

    // Immediately catch to prevent unhandled rejection
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).rejects.toEqual({ status: 'failed' });
  });

  test('calls callback on each status check', async () => {
    const statusCheck = vi.fn()
      .mockResolvedValueOnce({ status: 'pending', progress: 50 })
      .mockResolvedValueOnce({ status: 'done', progress: 100 });

    const callback = vi.fn();
    const pendingStatus = ['pending'];
    const successStatus = 'done';

    const promise = waitForStatus(statusCheck, pendingStatus, successStatus, 1000, callback);

    await vi.advanceTimersByTimeAsync(0);
    expect(callback).toHaveBeenCalledWith({ status: 'pending', progress: 50 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).toHaveBeenCalledWith({ status: 'done', progress: 100 });

    await promise;
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('handles status as object with name property', async () => {
    const statusCheck = vi.fn().mockResolvedValue({ status: { name: 'done' } });
    const pendingStatus = ['pending'];
    const successStatus = 'done';

    const promise = waitForStatus(statusCheck, pendingStatus, successStatus, 1000);

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ status: { name: 'done' } });
  });

  test('rejects when statusCheck throws error', async () => {
    const error = new Error('Network error');
    const statusCheck = vi.fn().mockRejectedValue(error);
    const pendingStatus = ['pending'];
    const successStatus = 'done';

    const promise = waitForStatus(statusCheck, pendingStatus, successStatus, 1000);

    // Immediately catch to prevent unhandled rejection
    promise.catch(() => {});

    await vi.runAllTimersAsync();

    await expect(promise).rejects.toEqual(error);
    expect(logger.Debug).toHaveBeenCalledWith(
      '[waitForStatus] Poll error',
      error
    );
  });

  test('rejects on a failure status the caller named', async () => {
    // The portal's module pipeline ends on `rejected`, which is not `failed` and never
    // becomes `accepted`. Left unnamed it took the "unknown status" branch below and was
    // polled forever.
    const statusCheck = vi.fn()
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValue({ status: 'rejected', error_message: 'archive structure is wrong' });

    const promise = waitForStatus(statusCheck, ['pending'], 'done', 1000, null, { failureStatus: ['rejected'] });
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).rejects.toEqual({ status: 'rejected', error_message: 'archive structure is wrong' });
    expect(statusCheck).toHaveBeenCalledTimes(2);
  });

  test('rejects once the timeout elapses and stops polling', async () => {
    const statusCheck = vi.fn().mockResolvedValue({ status: 'pending' });

    const promise = waitForStatus(statusCheck, ['pending'], 'done', 1000, null, { timeout: 5000 });
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).rejects.toThrow(/Timed out after 5s.*last status: pending/);

    const pollsWhenTimedOut = statusCheck.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(statusCheck).toHaveBeenCalledTimes(pollsWhenTimedOut);
  });

  test('uses the caller\'s timeout message when given one', async () => {
    const statusCheck = vi.fn().mockResolvedValue({ status: 'pending' });

    const promise = waitForStatus(statusCheck, ['pending'], 'done', 1000, null, {
      timeout: 2000,
      timeoutMessage: 'The portal never finished processing this release.'
    });
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(2000);
    await expect(promise).rejects.toThrow('The portal never finished processing this release.');
  });

  test('does not time out a poll that succeeds in time', async () => {
    const statusCheck = vi.fn()
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValue({ status: 'done' });

    const promise = waitForStatus(statusCheck, ['pending'], 'done', 1000, null, { timeout: 60000 });

    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toEqual({ status: 'done' });
  });

  // A failed check is not a verdict: 504 is a proxy saying it gave up waiting for the
  // server, and the work being polled for is very likely still running behind it.
  const gatewayTimeout = () => Object.assign(new Error('Request failed with status 504'), {
    name: 'StatusCodeError',
    statusCode: 504
  });

  const isServerSideFailure = (error) => error?.statusCode >= 500;

  test('keeps polling through a failed check the caller calls transient', async () => {
    const statusCheck = vi.fn()
      .mockRejectedValueOnce(gatewayTimeout())
      .mockResolvedValue({ status: 'done' });

    const promise = waitForStatus(statusCheck, ['pending'], 'done', 1000, null, { isTransient: isServerSideFailure });

    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toEqual({ status: 'done' });
    expect(statusCheck).toHaveBeenCalledTimes(2);
    // Once, however long the outage lasts -- a line per poll would bury the one that mattered.
    expect(logger.Warn).toHaveBeenCalledTimes(1);
    expect(logger.Warn).toHaveBeenCalledWith(expect.stringContaining('HTTP 504'));
  });

  test('still fails on a check the caller does not call transient', async () => {
    const unauthorized = Object.assign(new Error('Request failed with status 401'), {
      name: 'StatusCodeError',
      statusCode: 401
    });
    const statusCheck = vi.fn().mockRejectedValue(unauthorized);

    const promise = waitForStatus(statusCheck, ['pending'], 'done', 1000, null, { isTransient: isServerSideFailure });
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(0);

    await expect(promise).rejects.toBe(unauthorized);
    expect(statusCheck).toHaveBeenCalledTimes(1);
  });

  test('names the last failed check when the deadline passes', async () => {
    const statusCheck = vi.fn().mockRejectedValue(gatewayTimeout());

    const promise = waitForStatus(statusCheck, ['pending'], 'done', 1000, null, {
      timeout: 5000,
      isTransient: isServerSideFailure
    });
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(5000);

    await expect(promise).rejects.toThrow(/last check failed with.*504/s);
  });

  test('continues polling for unknown status', async () => {
    const statusCheck = vi.fn()
      .mockResolvedValueOnce({ status: 'unknown' })
      .mockResolvedValueOnce({ status: 'done' });

    const pendingStatus = ['pending'];
    const successStatus = 'done';

    const promise = waitForStatus(statusCheck, pendingStatus, successStatus, 1000);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result).toEqual({ status: 'done' });
    expect(statusCheck).toHaveBeenCalledTimes(2);
  });
});
