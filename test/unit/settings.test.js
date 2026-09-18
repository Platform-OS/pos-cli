import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('#lib/logger.js', () => ({
  default: {
    Debug: vi.fn(),
    Warn: vi.fn(),
    Error: vi.fn(),
    Info: vi.fn(),
    Success: vi.fn()
  }
}));

vi.mock('#lib/files.js', () => ({
  default: {
    readJSON: vi.fn(),
    getConfig: vi.fn()
  }
}));

vi.mock('#lib/modules.js', () => ({
  moduleConfigFileName: 'template-values.json',
  moduleManifestFileName: 'pos-module.json'
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn()
    },
    existsSync: vi.fn()
  };
});

import { fetchSettings, loadSettingsFileForModule, settingsFromDotPos } from '#lib/settings.js';
import logger from '#lib/logger.js';
import files from '#lib/files.js';
import fs from 'fs';

describe('settings', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MPKIT_URL;
    delete process.env.MPKIT_EMAIL;
    delete process.env.MPKIT_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('fetchSettings', () => {
    test('returns settings from environment variables when all are set', async () => {
      process.env.MPKIT_URL = 'https://test.platformos.com';
      process.env.MPKIT_EMAIL = 'test@example.com';
      process.env.MPKIT_TOKEN = 'test-token-123';

      const settings = await fetchSettings('staging');

      expect(settings).toEqual({
        url: 'https://test.platformos.com',
        email: 'test@example.com',
        token: 'test-token-123'
      });
    });

    test('returns settings from .pos config when env vars not set', async () => {
      files.getConfig.mockReturnValue({
        staging: {
          url: 'https://staging.example.com',
          email: 'staging@example.com',
          token: 'staging-token'
        }
      });

      const settings = await fetchSettings('staging');

      expect(settings).toEqual({
        url: 'https://staging.example.com',
        email: 'staging@example.com',
        token: 'staging-token'
      });
    });

    test('prefers environment variables over .pos config', async () => {
      process.env.MPKIT_URL = 'https://env.platformos.com';
      process.env.MPKIT_EMAIL = 'env@example.com';
      process.env.MPKIT_TOKEN = 'env-token';

      files.getConfig.mockReturnValue({
        staging: {
          url: 'https://staging.example.com',
          email: 'staging@example.com',
          token: 'staging-token'
        }
      });

      const settings = await fetchSettings('staging');

      expect(settings).toEqual({
        url: 'https://env.platformos.com',
        email: 'env@example.com',
        token: 'env-token'
      });
    });

    test('logs error when environment not found in config', async () => {
      files.getConfig.mockReturnValue({});

      await expect(fetchSettings('nonexistent')).rejects.toThrow();

      expect(logger.Error).toHaveBeenCalledWith(
        'No settings for nonexistent environment, please see pos-cli env add'
      );
    });

    test('logs error when no environment specified and no env vars', async () => {
      files.getConfig.mockReturnValue({});

      await expect(fetchSettings()).rejects.toThrow();

      expect(logger.Error).toHaveBeenCalledWith(
        'No environment specified, please pass environment for a command `pos-cli <command> [environment]`'
      );
    });

    test('returns undefined when partial env vars are set', async () => {
      process.env.MPKIT_URL = 'https://test.platformos.com';
      // Missing MPKIT_EMAIL and MPKIT_TOKEN

      files.getConfig.mockReturnValue({});

      await expect(fetchSettings('staging')).rejects.toThrow();

      expect(logger.Error).toHaveBeenCalled();
    });

    test('returns undefined when only URL and email are set', async () => {
      process.env.MPKIT_URL = 'https://test.platformos.com';
      process.env.MPKIT_EMAIL = 'test@example.com';
      // Missing MPKIT_TOKEN

      files.getConfig.mockReturnValue({});

      await expect(fetchSettings('staging')).rejects.toThrow();

      expect(logger.Error).toHaveBeenCalled();
    });
  });

  describe('settingsFromDotPos', () => {
    test('returns settings for specified environment', () => {
      files.getConfig.mockReturnValue({
        production: {
          url: 'https://prod.example.com',
          email: 'prod@example.com',
          token: 'prod-token'
        },
        staging: {
          url: 'https://staging.example.com',
          email: 'staging@example.com',
          token: 'staging-token'
        }
      });

      const settings = settingsFromDotPos('production');

      expect(settings).toEqual({
        url: 'https://prod.example.com',
        email: 'prod@example.com',
        token: 'prod-token'
      });
    });

    test('returns undefined for non-existent environment', () => {
      files.getConfig.mockReturnValue({
        staging: {
          url: 'https://staging.example.com',
          email: 'staging@example.com',
          token: 'staging-token'
        }
      });

      const settings = settingsFromDotPos('production');

      expect(settings).toBeUndefined();
    });

    // The name reaches here from a command-line argument and, through the MCP server, from a
    // model. A plain property read would answer `constructor` with a function.
    test.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])(
      'returns undefined for %s, which is on Object.prototype rather than in .pos',
      (name) => {
        files.getConfig.mockReturnValue({ staging: { url: 'https://staging.example.com' } });

        expect(settingsFromDotPos(name)).toBeUndefined();
      }
    );

    test('an environment genuinely named like a prototype member still resolves', () => {
      files.getConfig.mockReturnValue({ toString: { url: 'https://odd.example.com', token: 't' } });

      expect(settingsFromDotPos('toString')).toMatchObject({ url: 'https://odd.example.com' });
    });

    test('returns undefined when config is empty', () => {
      files.getConfig.mockReturnValue({});

      const settings = settingsFromDotPos('staging');

      expect(settings).toBeUndefined();
    });
  });

  describe('loadSettingsFileForModule', () => {
    test('returns module settings when template-values.json exists', () => {
      fs.existsSync.mockReturnValue(true);
      files.readJSON.mockReturnValue({
        machine_name: 'test-module',
        version: '1.0.0',
        dependencies: ['core']
      });

      const settings = loadSettingsFileForModule('test-module');

      expect(settings).toEqual({
        machine_name: 'test-module',
        version: '1.0.0',
        dependencies: ['core']
      });
      expect(files.readJSON).toHaveBeenCalledWith(
        expect.stringContaining('test-module/template-values.json'),
        { exit: false }
      );
    });

    test('returns empty object when template-values.json does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const settings = loadSettingsFileForModule('nonexistent-module');

      expect(settings).toEqual({});
      expect(files.readJSON).not.toHaveBeenCalled();
    });

    test('checks correct path for module config', () => {
      fs.existsSync.mockReturnValue(false);

      loadSettingsFileForModule('my-module');

      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('modules/my-module/template-values.json')
      );
    });
  });
});
