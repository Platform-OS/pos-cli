import { describe, test, expect, vi, beforeEach } from 'vitest';

// --- module mocks (hoisted by vitest before any import) ------------------

vi.mock('#lib/logger.js', () => ({
  default: {
    Debug: vi.fn(),
    Warn: vi.fn(),
    // logger.Error is async in the real implementation
    Error: vi.fn().mockResolvedValue(undefined),
    Info: vi.fn(),
    Success: vi.fn()
  }
}));

// watch.js imports ServerError from './ServerError.js' (same lib/ directory).
// Vitest resolves both './ServerError.js' (relative from watch.js) and
// '#lib/ServerError.js' to the same absolute path, so one mock covers both.
vi.mock('#lib/ServerError.js', () => ({
  default: {
    handler: vi.fn().mockResolvedValue(undefined),
    isNetworkError: vi.fn().mockReturnValue(false)
  }
}));

// Stub modules used only inside start() / sendAsset(), not pushFile/deleteFile.
// chokidar.watch() returns a real EventEmitter so the .on('error', ...) wiring in
// start() is genuinely exercised — emitting 'error' on a real emitter with no
// listener would throw (this is exactly how EMFILE crashed pos-cli before the fix).
vi.mock('chokidar', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    default: {
      watch: vi.fn(() => {
        const watcher = new EventEmitter();
        watcher.close = vi.fn().mockResolvedValue(undefined);
        return watcher;
      })
    }
  };
});
vi.mock('livereload', () => ({ default: { createServer: vi.fn() } }));
vi.mock('async', () => ({ default: { queue: vi.fn() } }));
vi.mock('#lib/proxy.js', () => ({ default: vi.fn() }));
vi.mock('#lib/files.js', () => ({ default: { getIgnoreList: vi.fn().mockReturnValue([]) } }));
vi.mock('#lib/directories.js', () => ({
  default: { APP: 'app', LEGACY_APP: 'marketplace_builder', toWatch: vi.fn().mockReturnValue([]) }
}));
vi.mock('#lib/watch-files-extensions.js', () => ({ default: ['liquid', 'yml'] }));
vi.mock('#lib/assets/manifest.js', () => ({ manifestGenerateForAssets: vi.fn() }));
// uploadError stays real so the tests build upload failures in exactly the shape
// the 403 retry keys on.
vi.mock('#lib/s3UploadFile.js', async () => ({
  ...(await vi.importActual('#lib/s3UploadFile.js')),
  uploadFileFormData: vi.fn()
}));
vi.mock('#lib/presignUrl.js', async () => ({
  ...(await vi.importActual('#lib/presignUrl.js')),
  presignDirectory: vi.fn()
}));
vi.mock('#lib/shouldBeSynced.js', () => ({ default: vi.fn() }));
vi.mock('#lib/settings.js', () => ({ loadSettingsFileForModule: vi.fn().mockReturnValue({}) }));
vi.mock('#lib/templates.js', () => ({ fillInTemplateValues: vi.fn().mockReturnValue('') }));

import fs from 'fs';
import logger from '#lib/logger.js';
import ServerError from '#lib/ServerError.js';
import { pushFile } from '#lib/watch.js';

// A missing scope holds for every file, not the one being saved, so watch mode ends the
// run on the first refusal instead of reporting it once per save. Its own file: the latch
// that makes it "once" is module state shared with the expired-session case.
describe('sync with a token missing code:write', () => {
  const insufficient = () =>
    Object.assign(new Error('This token does not have the code:write scope needed for this on shop.example.com.'), {
      name: 'StatusCodeError',
      statusCode: 403,
      options: { uri: 'https://shop.example.com/api/app_builder/marketplace_releases/sync' },
      response: { statusCode: 403, body: { error: 'insufficient_scope', required_scopes: ['code:write'] } }
    });

  beforeEach(() => vi.clearAllMocks());

  test('ends the run once with the scope explanation', async () => {
    vi.spyOn(fs, 'createReadStream').mockReturnValue('mock-stream');
    const gateway = { sync: vi.fn().mockRejectedValue(insufficient()) };

    await expect(pushFile(gateway, 'app/views/pages/a.liquid')).resolves.toBeUndefined();

    expect(logger.Error).toHaveBeenCalledWith(
      expect.stringContaining('code:write'),
      expect.objectContaining({ hideTimestamp: true, exit: true })
    );
    expect(ServerError.handler).not.toHaveBeenCalled();

    logger.Error.mockClear();
    await pushFile(gateway, 'app/views/pages/b.liquid');
    expect(logger.Error).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
