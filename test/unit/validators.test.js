/**
 * Unit tests for validators
 * Tests email, url, existence, directoryExists, and directoryEmpty validators
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

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn()
  },
  existsSync: vi.fn()
}));

// Mock shelljs
vi.mock('shelljs', () => ({
  default: {
    ls: vi.fn()
  }
}));

import logger from '#lib/logger.js';
import fs from 'fs';
import shell from 'shelljs';

describe('validators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('email validator', () => {
    test('accepts valid email addresses', async () => {
      const validateEmail = (await import('#lib/validators/email.js')).default;

      validateEmail('test@example.com');

      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('accepts email with subdomain', async () => {
      const validateEmail = (await import('#lib/validators/email.js')).default;

      validateEmail('user@mail.example.com');

      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('accepts email with plus sign', async () => {
      const validateEmail = (await import('#lib/validators/email.js')).default;

      validateEmail('user+tag@example.com');

      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('rejects invalid email without @', async () => {
      const validateEmail = (await import('#lib/validators/email.js')).default;

      validateEmail('invalid-email');

      expect(logger.Error).toHaveBeenCalledWith(
        'Please provide valid email',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('rejects invalid email without domain', async () => {
      const validateEmail = (await import('#lib/validators/email.js')).default;

      validateEmail('user@');

      expect(logger.Error).toHaveBeenCalledWith(
        'Please provide valid email',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('rejects empty string', async () => {
      const validateEmail = (await import('#lib/validators/email.js')).default;

      validateEmail('');

      expect(logger.Error).toHaveBeenCalled();
    });
  });

  describe('url validator', () => {
    test('accepts valid https URL', async () => {
      const validateUrl = (await import('#lib/validators/url.js')).default;

      const result = validateUrl('https://example.com');

      expect(result).toBe(true);
      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('accepts valid http URL', async () => {
      const validateUrl = (await import('#lib/validators/url.js')).default;

      const result = validateUrl('http://example.com');

      expect(result).toBe(true);
      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('accepts URL with path', async () => {
      const validateUrl = (await import('#lib/validators/url.js')).default;

      const result = validateUrl('https://example.com/path/to/resource');

      expect(result).toBe(true);
      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('accepts URL with query parameters', async () => {
      const validateUrl = (await import('#lib/validators/url.js')).default;

      const result = validateUrl('https://example.com?foo=bar&baz=qux');

      expect(result).toBe(true);
      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('accepts URL with port', async () => {
      const validateUrl = (await import('#lib/validators/url.js')).default;

      const result = validateUrl('https://example.com:8080');

      expect(result).toBe(true);
      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('rejects invalid URL without protocol', async () => {
      const validateUrl = (await import('#lib/validators/url.js')).default;

      const result = validateUrl('example.com');

      expect(result).toBe(false);
      expect(logger.Error).toHaveBeenCalledWith(
        'Please provide valid URL',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('rejects empty string', async () => {
      const validateUrl = (await import('#lib/validators/url.js')).default;

      const result = validateUrl('');

      expect(result).toBe(false);
      expect(logger.Error).toHaveBeenCalled();
    });

    test('rejects malformed URL', async () => {
      const validateUrl = (await import('#lib/validators/url.js')).default;

      const result = validateUrl('not a url at all');

      expect(result).toBe(false);
      expect(logger.Error).toHaveBeenCalled();
    });
  });

  describe('existence validator', () => {
    test('does not log error when argument value is defined', async () => {
      const existence = (await import('#lib/validators/existence.js')).default;

      existence({ argumentName: 'email', argumentValue: 'test@example.com' });

      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('does not log error for empty string (defined value)', async () => {
      const existence = (await import('#lib/validators/existence.js')).default;

      existence({ argumentName: 'name', argumentValue: '' });

      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('does not log error for null (defined value)', async () => {
      const existence = (await import('#lib/validators/existence.js')).default;

      existence({ argumentName: 'data', argumentValue: null });

      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('does not log error for zero (defined value)', async () => {
      const existence = (await import('#lib/validators/existence.js')).default;

      existence({ argumentName: 'count', argumentValue: 0 });

      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('does not log error for false (defined value)', async () => {
      const existence = (await import('#lib/validators/existence.js')).default;

      existence({ argumentName: 'flag', argumentValue: false });

      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('logs error when argument value is undefined', async () => {
      const existence = (await import('#lib/validators/existence.js')).default;

      existence({ argumentName: 'email', argumentValue: undefined });

      expect(logger.Error).toHaveBeenCalledWith(
        'Please provide email',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('logs error with default message when argumentName not provided', async () => {
      const existence = (await import('#lib/validators/existence.js')).default;

      existence({ argumentValue: undefined });

      expect(logger.Error).toHaveBeenCalledWith(
        'Please provide all required arguments',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('calls fail callback when argument is undefined', async () => {
      const existence = (await import('#lib/validators/existence.js')).default;
      const failCallback = vi.fn();

      existence({ argumentName: 'token', argumentValue: undefined, fail: failCallback });

      expect(failCallback).toHaveBeenCalled();
    });

    test('does not call fail callback when argument is defined', async () => {
      const existence = (await import('#lib/validators/existence.js')).default;
      const failCallback = vi.fn();

      existence({ argumentName: 'token', argumentValue: 'abc123', fail: failCallback });

      expect(failCallback).not.toHaveBeenCalled();
    });
  });

  describe('directoryExists validator', () => {
    test('does not log error when directory exists', async () => {
      fs.existsSync.mockReturnValue(true);
      const directoryExists = (await import('#lib/validators/directoryExists.js')).default;

      directoryExists({ path: '/existing/path' });

      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('logs error when directory does not exist', async () => {
      fs.existsSync.mockReturnValue(false);
      const directoryExists = (await import('#lib/validators/directoryExists.js')).default;

      directoryExists({ path: '/nonexistent/path' });

      expect(logger.Error).toHaveBeenCalledWith(
        "Directory doesn't exist.",
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('logs custom message when directory does not exist', async () => {
      fs.existsSync.mockReturnValue(false);
      const directoryExists = (await import('#lib/validators/directoryExists.js')).default;

      directoryExists({
        path: '/nonexistent/path',
        message: 'App directory not found'
      });

      expect(logger.Error).toHaveBeenCalledWith(
        'App directory not found',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('calls fail callback when directory does not exist', async () => {
      fs.existsSync.mockReturnValue(false);
      const directoryExists = (await import('#lib/validators/directoryExists.js')).default;
      const failCallback = vi.fn();

      directoryExists({ path: '/nonexistent/path', fail: failCallback });

      expect(failCallback).toHaveBeenCalled();
    });

    test('does not call fail callback when directory exists', async () => {
      fs.existsSync.mockReturnValue(true);
      const directoryExists = (await import('#lib/validators/directoryExists.js')).default;
      const failCallback = vi.fn();

      directoryExists({ path: '/existing/path', fail: failCallback });

      expect(failCallback).not.toHaveBeenCalled();
    });
  });

  describe('directoryEmpty validator', () => {
    test('does not log error when directory is not empty', async () => {
      shell.ls.mockReturnValue(['file1.js', 'file2.js']);
      const directoryEmpty = (await import('#lib/validators/directoryEmpty.js')).default;

      directoryEmpty({ path: '/path/with/files' });

      expect(logger.Error).not.toHaveBeenCalled();
    });

    test('logs error when directory is empty', async () => {
      shell.ls.mockReturnValue([]);
      const directoryEmpty = (await import('#lib/validators/directoryEmpty.js')).default;

      directoryEmpty({ path: '/empty/path' });

      expect(logger.Error).toHaveBeenCalledWith(
        'Directory is empty.',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('logs custom message when directory is empty', async () => {
      shell.ls.mockReturnValue([]);
      const directoryEmpty = (await import('#lib/validators/directoryEmpty.js')).default;

      directoryEmpty({
        path: '/empty/path',
        message: 'No files found in app directory'
      });

      expect(logger.Error).toHaveBeenCalledWith(
        'No files found in app directory',
        expect.objectContaining({ hideTimestamp: true })
      );
    });

    test('calls fail callback when directory is empty', async () => {
      shell.ls.mockReturnValue([]);
      const directoryEmpty = (await import('#lib/validators/directoryEmpty.js')).default;
      const failCallback = vi.fn();

      directoryEmpty({ path: '/empty/path', fail: failCallback });

      expect(failCallback).toHaveBeenCalled();
    });

    test('does not call fail callback when directory has files', async () => {
      shell.ls.mockReturnValue(['file.js']);
      const directoryEmpty = (await import('#lib/validators/directoryEmpty.js')).default;
      const failCallback = vi.fn();

      directoryEmpty({ path: '/path/with/files', fail: failCallback });

      expect(failCallback).not.toHaveBeenCalled();
    });
  });
});
