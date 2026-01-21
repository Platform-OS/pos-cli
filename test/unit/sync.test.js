import { describe, test, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('#lib/logger.js', () => ({
  default: {
    Debug: vi.fn(),
    Warn: vi.fn(),
    Error: vi.fn(),
    Info: vi.fn()
  }
}));

vi.mock('#lib/utils/valid-file-path.js', () => ({
  default: vi.fn((filePath) => {
    const invalidChars = /[<>:"|?*]/;
    return !invalidChars.test(filePath);
  })
}));

// Helper to create platform-native paths for testing
const nativePath = (...parts) => parts.join(path.sep);

const setupMocks = () => {
  fs.readFileSync = vi.fn((filePath) => {
    if (filePath.includes('empty.yml')) {
      return Buffer.from('');
    }
    return Buffer.from('content');
  });
};

describe('shouldBeSynced - unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  test('syncs files with valid extensions', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced('app/views/pages/index.liquid', []);
    expect(result).toBe(true);
  });

  test('syncs GraphQL files', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced('app/graphql/users/get.graphql', []);
    expect(result).toBe(true);
  });

  test('syncs YAML files', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced('app/schema/user.yml', []);
    expect(result).toBe(true);
  });

  test('syncs Liquid partials', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced('app/views/partials/header.liquid', []);
    expect(result).toBe(true);
  });

  test('syncs JavaScript files', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced('app/assets/app.js', []);
    expect(result).toBe(true);
  });

  test('syncs CSS files', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced('app/assets/styles.css', []);
    expect(result).toBe(true);
  });

  test('does not sync empty YML files', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const { default: logger } = await import('#lib/logger.js');
    const result = shouldBeSynced('app/schema/empty.yml', []);

    expect(result).toBe(false);
    expect(logger.Warn).toHaveBeenCalledWith(
      expect.stringContaining('Detected empty YML file')
    );
  });

  test('syncs non-empty YML files', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced('app/schema/user.yml', []);
    expect(result).toBe(true);
  });

  test('syncs files in modules/public directory', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced(nativePath('modules', 'mymodule', 'public', 'views', 'index.liquid'), []);
    expect(result).toBe(true);
  });

  test('syncs files in modules/private directory', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced(nativePath('modules', 'mymodule', 'private', 'config.yml'), []);
    expect(result).toBe(true);
  });

  test('does not sync module template-values.json', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced(nativePath('modules', 'mymodule', 'template-values.json'), []);
    expect(result).toBe(false);
  });

  test('does not sync files outside public/private in modules', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced(nativePath('modules', 'mymodule', 'README.md'), []);
    expect(result).toBe(false);
  });

  test('does not sync files in ignore list', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced('app/views/pages/index.liquid', ['**/*.liquid']);
    expect(result).toBe(false);
  });

  test('syncs files not in ignore list', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced('app/views/pages/index.liquid', ['**/*.yml']);
    expect(result).toBe(true);
  });

  test('respects .gitignore-style patterns', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced('app/tmp/file.txt', ['app/tmp/*']);
    expect(result).toBe(false);
  });

  test('warns about invalid characters but still syncs files', async () => {
    const { default: isValidFilePath } = await import('#lib/utils/valid-file-path.js');
    const { default: logger } = await import('#lib/logger.js');
    const mockIsValidFilePath = vi.mocked(isValidFilePath);
    mockIsValidFilePath.mockReturnValue(false);

    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced('app/views/invalid|file.liquid', []);

    expect(result).toBe(true);
    expect(logger.Warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid characters in file path')
    );
  });

  test('syncs files with valid characters', async () => {
    const { default: isValidFilePath } = await import('#lib/utils/valid-file-path.js');
    const mockIsValidFilePath = vi.mocked(isValidFilePath);
    mockIsValidFilePath.mockReturnValue(true);

    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced('app/views/pages/index.liquid', []);
    expect(result).toBe(true);
  });

  test('all conditions must be true for sync', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced('app/views/pages/index.liquid', []);
    expect(result).toBe(true);
  });

  test('one false condition prevents sync - ignore list', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced('app/views/pages/index.liquid', ['**/*.liquid']);
    expect(result).toBe(false);
  });

  test('one false condition prevents sync - invalid module file', async () => {
    const { default: shouldBeSynced } = await import('#lib/shouldBeSynced.js');
    const result = shouldBeSynced(nativePath('modules', 'mymodule', 'README.md'), []);
    expect(result).toBe(false);
  });
});
