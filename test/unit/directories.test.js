/**
 * Unit tests for directories module
 * Tests directory constants and methods
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn()
  },
  existsSync: vi.fn()
}));

import fs from 'fs';
import dir from '#lib/directories.js';

describe('directories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constants', () => {
    test('APP is app', () => {
      expect(dir.APP).toBe('app');
    });

    test('LEGACY_APP is marketplace_builder', () => {
      expect(dir.LEGACY_APP).toBe('marketplace_builder');
    });

    test('MODULES is modules', () => {
      expect(dir.MODULES).toBe('modules');
    });

    test('TMP is .tmp', () => {
      expect(dir.TMP).toBe('.tmp');
    });

    test('ALLOWED contains all three directories', () => {
      expect(dir.ALLOWED).toEqual(['app', 'marketplace_builder', 'modules']);
    });
  });

  describe('toWatch', () => {
    test('returns all directories when all exist', () => {
      fs.existsSync.mockReturnValue(true);

      const result = dir.toWatch();

      expect(result).toEqual(['app', 'marketplace_builder', 'modules']);
    });

    test('returns only existing directories', () => {
      fs.existsSync.mockImplementation(path => {
        return path === 'app' || path === 'modules';
      });

      const result = dir.toWatch();

      expect(result).toEqual(['app', 'modules']);
    });

    test('returns empty array when no directories exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = dir.toWatch();

      expect(result).toEqual([]);
    });

    test('returns only app when only app exists', () => {
      fs.existsSync.mockImplementation(path => path === 'app');

      const result = dir.toWatch();

      expect(result).toEqual(['app']);
    });
  });

  describe('currentApp', () => {
    test('returns app when app directory exists', () => {
      fs.existsSync.mockImplementation(path => path === 'app');

      const result = dir.currentApp();

      expect(result).toBe('app');
    });

    test('returns marketplace_builder when only legacy exists', () => {
      fs.existsSync.mockImplementation(path => path === 'marketplace_builder');

      const result = dir.currentApp();

      expect(result).toBe('marketplace_builder');
    });

    test('prefers app over marketplace_builder when both exist', () => {
      fs.existsSync.mockReturnValue(true);

      const result = dir.currentApp();

      expect(result).toBe('app');
    });

    test('returns undefined when neither app directory exists', () => {
      fs.existsSync.mockReturnValue(false);

      const result = dir.currentApp();

      expect(result).toBeUndefined();
    });
  });

  describe('available', () => {
    test('returns all directories when all exist', () => {
      fs.existsSync.mockReturnValue(true);

      const result = dir.available();

      expect(result).toEqual(['app', 'marketplace_builder', 'modules']);
    });

    test('returns only app and modules when legacy does not exist', () => {
      fs.existsSync.mockImplementation(path => {
        return path === 'app' || path === 'modules';
      });

      const result = dir.available();

      expect(result).toEqual(['app', 'modules']);
    });

    test('returns empty array when no directories exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = dir.available();

      expect(result).toEqual([]);
    });

    test('returns only modules when only modules exists', () => {
      fs.existsSync.mockImplementation(path => path === 'modules');

      const result = dir.available();

      expect(result).toEqual(['modules']);
    });
  });
});
