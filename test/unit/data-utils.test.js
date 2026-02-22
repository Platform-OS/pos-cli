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
