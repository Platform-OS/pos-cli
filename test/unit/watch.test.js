/**
 * Unit tests for watch.js pushFile / deleteFile.
 *
 * The deleteFile 422 path was previously unhandled — the function used a bare
 * .then() chain with no .catch(), so a 422 from the server caused an unhandled
 * rejection and the queue callback was never called, hanging pos-cli.
 *
 * These tests lock in the correct behaviour: a 422 response must log a
 * human-readable error message and throw so the queue can continue.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

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
vi.mock('#lib/presignUrl.js', () => ({ presignDirectory: vi.fn() }));
vi.mock('#lib/shouldBeSynced.js', () => ({ default: vi.fn() }));
vi.mock('#lib/settings.js', () => ({ loadSettingsFileForModule: vi.fn().mockReturnValue({}) }));
vi.mock('#lib/templates.js', () => ({ fillInTemplateValues: vi.fn().mockReturnValue('') }));

// --- static imports (resolved after mocks) --------------------------------

import fs from 'fs';
import logger from '#lib/logger.js';
import ServerError from '#lib/ServerError.js';
import Gateway from '#lib/proxy.js';
import { uploadError, uploadFileFormData } from '#lib/s3UploadFile.js';
import { presignDirectory } from '#lib/presignUrl.js';
import { manifestGenerateForAssets } from '#lib/assets/manifest.js';
import { pushFile, deleteFile, sendFile, start, watchIgnored, handleWatcherError } from '#lib/watch.js';

// --- test helpers ---------------------------------------------------------

const make422 = (error) =>
  Object.assign(new Error('Unprocessable Entity'), {
    name: 'StatusCodeError',
    statusCode: 422,
    response: { body: { error } }
  });

const make422WithErrors = (errors) =>
  Object.assign(new Error('Unprocessable Entity'), {
    name: 'StatusCodeError',
    statusCode: 422,
    response: { body: { errors } }
  });

// --- pushFile tests -------------------------------------------------------

describe('pushFile', () => {
  let gateway;

  beforeEach(() => {
    vi.clearAllMocks();
    // fs.createReadStream opens a file asynchronously even if the stream is never read.
    // vi.spyOn modifies the live module object so watch.js's already-imported fs reference
    // is patched — unlike a vi.mock() factory which returns a new object.
    vi.spyOn(fs, 'createReadStream').mockReturnValue('mock-stream');
    gateway = { sync: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('logs success when the server accepts the file', async () => {
    gateway.sync.mockResolvedValue({ refresh_index: false });

    await pushFile(gateway, 'app/views/pages/index.liquid');

    expect(logger.Success).toHaveBeenCalledWith('[Sync] Synced: views/pages/index.liquid');
  });

  test('strips app/ prefix from the logged path', async () => {
    gateway.sync.mockResolvedValue({});

    await pushFile(gateway, 'app/form_configurations/contact.liquid');

    expect(logger.Success).toHaveBeenCalledWith('[Sync] Synced: form_configurations/contact.liquid');
  });

  test('logs a friendly error and throws on a 422 validation failure', async () => {
    gateway.sync.mockRejectedValue(make422('Body syntax is invalid'));

    await expect(pushFile(gateway, 'app/views/pages/broken.liquid')).rejects.toThrow();

    expect(logger.Error).toHaveBeenCalledWith(
      '[Sync] Failed to sync: views/pages/broken.liquid\nBody syntax is invalid',
      { exit: false, notify: false }
    );
    // ServerError.handler must NOT be called — we already logged the error ourselves.
    expect(ServerError.handler).not.toHaveBeenCalled();
  });

  test('delegates non-422 StatusCodeErrors to ServerError.handler', async () => {
    const err = Object.assign(new Error('Internal Server Error'), {
      name: 'StatusCodeError',
      statusCode: 500
    });
    gateway.sync.mockRejectedValue(err);

    await pushFile(gateway, 'app/views/pages/index.liquid');

    expect(ServerError.handler).toHaveBeenCalledWith(err);
    expect(logger.Error).not.toHaveBeenCalled();
  });

  test('logs without exiting on network error (RequestError) so sync stays alive', async () => {
    const err = Object.assign(new Error('ECONNREFUSED'), { name: 'RequestError' });
    gateway.sync.mockRejectedValue(err);

    await expect(pushFile(gateway, 'app/views/pages/index.liquid')).rejects.toThrow();

    expect(logger.Error).toHaveBeenCalledWith(
      '[Sync] Failed to sync: views/pages/index.liquid',
      { exit: false, notify: false }
    );
    expect(ServerError.handler).not.toHaveBeenCalled();
  });

  test('logs without exiting on timeout (RequestError) so sync stays alive', async () => {
    const err = Object.assign(new Error('ETIMEDOUT'), { name: 'RequestError' });
    gateway.sync.mockRejectedValue(err);

    await expect(pushFile(gateway, 'app/views/pages/index.liquid')).rejects.toThrow();

    expect(logger.Error).toHaveBeenCalledWith(
      '[Sync] Failed to sync: views/pages/index.liquid',
      { exit: false, notify: false }
    );
    expect(ServerError.handler).not.toHaveBeenCalled();
  });
});

// --- deleteFile tests -----------------------------------------------------

describe('deleteFile', () => {
  let gateway;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = { delete: vi.fn() };
  });

  test('logs success when the server confirms the deletion', async () => {
    gateway.delete.mockResolvedValue(true);

    await deleteFile(gateway, 'app/authorization_policies/my_policy.liquid');

    expect(logger.Success).toHaveBeenCalledWith(
      '[Sync] Deleted: authorization_policies/my_policy.liquid'
    );
  });

  test('strips app/ prefix from the logged path', async () => {
    gateway.delete.mockResolvedValue(true);

    await deleteFile(gateway, 'app/views/partials/header.liquid');

    expect(logger.Success).toHaveBeenCalledWith('[Sync] Deleted: views/partials/header.liquid');
  });

  // This is the regression test for the bug: deleteFile had no error handling
  // at all, so a 422 would produce an unhandled rejection and hang the queue.
  test('logs a friendly error and throws on a 422 deletion restriction (error field)', async () => {
    const msg =
      'cannot be deleted — referenced by the following pages: views/pages/my_page.html.liquid. ' +
      'Remove the authorization_policy entry from these page files first.';
    gateway.delete.mockRejectedValue(make422(msg));

    await expect(
      deleteFile(gateway, 'app/authorization_policies/my_policy.liquid')
    ).rejects.toThrow();

    expect(logger.Error).toHaveBeenCalledWith(
      `[Sync] Failed to delete: authorization_policies/my_policy.liquid\n${msg}`,
      { exit: false, notify: false }
    );
    expect(ServerError.handler).not.toHaveBeenCalled();
  });

  test('logs a friendly error and throws on a 422 with an errors array', async () => {
    gateway.delete.mockRejectedValue(
      make422WithErrors([
        'cannot be deleted — referenced by the following form configurations: form_configurations/my_form.liquid.',
        'Remove the email_notifications entry from these form files first.'
      ])
    );

    await expect(
      deleteFile(gateway, 'app/notifications/email_notifications/my_email.liquid')
    ).rejects.toThrow();

    expect(logger.Error).toHaveBeenCalledWith(
      '[Sync] Failed to delete: notifications/email_notifications/my_email.liquid\n' +
        'cannot be deleted — referenced by the following form configurations: form_configurations/my_form.liquid., ' +
        'Remove the email_notifications entry from these form files first.',
      { exit: false, notify: false }
    );
  });

  test('delegates non-422 StatusCodeErrors to ServerError.handler', async () => {
    const err = Object.assign(new Error('Internal Server Error'), {
      name: 'StatusCodeError',
      statusCode: 500
    });
    gateway.delete.mockRejectedValue(err);

    // Must NOT throw — ServerError.handler handles the error and (when mocked) returns.
    await deleteFile(gateway, 'app/views/partials/foo.liquid');

    expect(ServerError.handler).toHaveBeenCalledWith(err);
    expect(logger.Error).not.toHaveBeenCalled();
  });

  test('logs without exiting on network error (RequestError) so sync stays alive', async () => {
    const err = Object.assign(new Error('ECONNREFUSED'), { name: 'RequestError' });
    gateway.delete.mockRejectedValue(err);

    await expect(deleteFile(gateway, 'app/views/partials/foo.liquid')).rejects.toThrow();

    expect(logger.Error).toHaveBeenCalledWith(
      '[Sync] Failed to delete: views/partials/foo.liquid',
      { exit: false, notify: false }
    );
    expect(ServerError.handler).not.toHaveBeenCalled();
  });
});

// --- asset sync tests (sendAsset via sendFile) -----------------------------

// Regression tests for the 403 crash: the presigned upload authorization is
// fetched once at sync start and expires server-side. sendAsset used to call
// logger.Error without { exit: false } on any upload failure, so an expired
// authorization killed the whole watch process with "Upload failed with
// status 403". Now a 403 refreshes the authorization and retries once, and no
// asset upload failure ever exits the process.
describe('asset sync', () => {
  const assetPath = 'app/assets/style/main.css';

  let gateway;

  beforeEach(() => {
    // sendAsset schedules the debounced manifest flush on success; fake timers keep
    // that 1s timer from firing during a later test.
    vi.useFakeTimers();
    vi.clearAllMocks();
    manifestGenerateForAssets.mockReturnValue({ files: {} });
    presignDirectory.mockResolvedValue({
      url: 'https://s3.example.com/bucket',
      fields: { key: 'assets/${filename}' }
    });
    gateway = {
      getInstance: vi.fn().mockResolvedValue({ id: 'inst-1' }),
      sendManifest: vi.fn().mockResolvedValue({})
    };
  });

  afterEach(async () => {
    // Let the pending flush run instead of cancelling it: the debounce is module
    // level, and cancelling its timer behind its back leaves it thinking one is
    // still scheduled, so it would never fire again in any later test.
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  });

  test('uploads the asset and flushes the manifest on success', async () => {
    uploadFileFormData.mockResolvedValue(true);

    await sendFile(gateway, assetPath);

    expect(uploadFileFormData).toHaveBeenCalledTimes(1);
    expect(logger.Success).toHaveBeenCalledWith(`[Sync] Synced asset: ${assetPath}`);
    expect(gateway.sendManifest).toHaveBeenCalled();
    expect(logger.Error).not.toHaveBeenCalled();
  });

  test('refreshes the upload authorization and retries once on 403', async () => {
    uploadFileFormData.mockRejectedValueOnce(uploadError(403)).mockResolvedValueOnce(true);

    await sendFile(gateway, assetPath);

    // Initial fetch at sendFile start + one refresh after the 403.
    expect(presignDirectory).toHaveBeenCalledTimes(2);
    expect(uploadFileFormData).toHaveBeenCalledTimes(2);
    expect(logger.Success).toHaveBeenCalledWith(`[Sync] Synced asset: ${assetPath}`);
    // The refresh is silent — debug-only trace, no user-facing warning or error.
    expect(logger.Warn).not.toHaveBeenCalled();
    expect(logger.Error).not.toHaveBeenCalled();
  });

  test('logs without exiting and throws when the 403 persists after a refresh', async () => {
    uploadFileFormData.mockRejectedValue(uploadError(403));

    await expect(sendFile(gateway, assetPath)).rejects.toMatchObject({ alreadyLogged: true });

    // Exactly one retry — no infinite refresh loop.
    expect(uploadFileFormData).toHaveBeenCalledTimes(2);
    expect(logger.Error).toHaveBeenCalledWith(
      `[Sync] Failed to sync ${assetPath}: Upload failed with status 403`,
      { exit: false, notify: false }
    );
  });

  test('logs without exiting and throws on non-403 upload failures, with no retry', async () => {
    uploadFileFormData.mockRejectedValue(uploadError(500));

    await expect(sendFile(gateway, assetPath)).rejects.toMatchObject({ alreadyLogged: true });

    expect(uploadFileFormData).toHaveBeenCalledTimes(1);
    expect(presignDirectory).toHaveBeenCalledTimes(1);
    expect(logger.Error).toHaveBeenCalledWith(
      `[Sync] Failed to sync ${assetPath}: Upload failed with status 500`,
      { exit: false, notify: false }
    );
  });

  test('normalizes Windows backslash paths in messages and throws with exit disabled', async () => {
    uploadFileFormData.mockRejectedValue(uploadError(403));
    const windowsPath = 'modules\\community\\public\\assets\\style\\notification.css';

    await expect(sendFile(gateway, windowsPath)).rejects.toMatchObject({ alreadyLogged: true });

    expect(logger.Error).toHaveBeenCalledWith(
      '[Sync] Failed to sync modules/community/public/assets/style/notification.css: Upload failed with status 403',
      { exit: false, notify: false }
    );
  });

  test('sends an API error from the authorization refresh through the centralized handler', async () => {
    // The refresh talks to the API, so its failures need the handler's guidance —
    // a 401 has to tell the user to refresh their token, not just print the status.
    const unauthorized = Object.assign(new Error('Request failed with status 401'), {
      name: 'StatusCodeError',
      statusCode: 401
    });
    uploadFileFormData.mockRejectedValue(uploadError(403));
    // The initial fetch succeeds; the refresh the 403 triggers is what fails.
    gateway.getInstance.mockResolvedValueOnce({ id: 'inst-1' }).mockRejectedValue(unauthorized);

    await expect(sendFile(gateway, assetPath)).rejects.toMatchObject({ alreadyLogged: true });

    expect(ServerError.handler).toHaveBeenCalledWith(unauthorized);
  });

  test('derives the S3 key per asset without mutating the shared authorization', async () => {
    // presignDirectory hands back the same object every call, so a key written back
    // into it would surface as a wrong key on the second upload.
    uploadFileFormData.mockResolvedValue(true);

    await sendFile(gateway, assetPath);

    expect(uploadFileFormData).toHaveBeenLastCalledWith(assetPath, {
      url: 'https://s3.example.com/bucket',
      fields: { key: 'assets/style/${filename}' }
    });

    await sendFile(gateway, 'modules/community/public/assets/images/logo.png');

    expect(uploadFileFormData).toHaveBeenLastCalledWith('modules/community/public/assets/images/logo.png', {
      url: 'https://s3.example.com/bucket',
      fields: { key: 'assets/modules/community/images/${filename}' }
    });
  });

  test('keeps the batch for the next flush when registering the assets fails', async () => {
    uploadFileFormData.mockResolvedValue(true);
    gateway.sendManifest.mockRejectedValueOnce(new Error('502 Bad Gateway'));

    // The asset itself uploaded — only registering it failed.
    await expect(sendFile(gateway, assetPath)).rejects.toThrow('502 Bad Gateway');

    gateway.sendManifest.mockResolvedValue({});
    await sendFile(gateway, 'app/assets/style/other.css');

    // The asset that was dropped is registered along with the new one, and was not
    // re-uploaded to get there.
    expect(manifestGenerateForAssets).toHaveBeenLastCalledWith([assetPath, 'app/assets/style/other.css']);
    expect(uploadFileFormData).toHaveBeenCalledTimes(2);
  });

  test('keeps the batch when the manifest cannot be built', async () => {
    // Building the manifest stats every file, so an asset deleted right after its
    // upload makes the build fail rather than the request.
    uploadFileFormData.mockResolvedValue(true);
    manifestGenerateForAssets.mockImplementationOnce(() => {
      throw Object.assign(new Error(`ENOENT: no such file or directory, stat '${assetPath}'`), { code: 'ENOENT' });
    });

    await expect(sendFile(gateway, assetPath)).rejects.toThrow('ENOENT');
    expect(gateway.sendManifest).not.toHaveBeenCalled();

    await sendFile(gateway, assetPath);

    expect(gateway.sendManifest).toHaveBeenCalledTimes(1);
  });

  test('logs instead of throwing when the debounced flush fails', async () => {
    // This flush fires from a timer, where a rejection would go unhandled and kill
    // the process — the crash this whole path exists to prevent.
    uploadFileFormData.mockResolvedValue(true);
    gateway.sendManifest.mockRejectedValue(new Error('502 Bad Gateway'));

    await expect(sendFile(gateway, assetPath)).rejects.toThrow('502 Bad Gateway');
    await vi.advanceTimersByTimeAsync(1000);

    expect(logger.Error).toHaveBeenCalledWith('[Sync] Failed to update assets manifest: 502 Bad Gateway', {
      exit: false,
      notify: false
    });

    // Drain the retained batch so it does not leak into the next test.
    gateway.sendManifest.mockResolvedValue({});
    await sendFile(gateway, assetPath);
  });
});

// --- start() tests --------------------------------------------------------

describe('start', () => {
  const env = {
    MARKETPLACE_EMAIL: 'test@example.com',
    MARKETPLACE_TOKEN: 'test-token',
    MARKETPLACE_URL: 'https://test.example.com',
    CONCURRENCY: 1
  };

  let mockGatewayInstance;
  let exitSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGatewayInstance = {
      ping: vi.fn().mockResolvedValue([]),
      getInstance: vi.fn().mockResolvedValue({ id: 'inst-1' })
    };
    vi.mocked(Gateway).mockImplementation(function() { return mockGatewayInstance; });
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
    ServerError.isNetworkError.mockReturnValue(false);
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  test('returns watcher on successful ping', async () => {
    const result = await start(env, false, false);
    expect(result).toHaveProperty('watcher');
    expect(mockGatewayInstance.ping).toHaveBeenCalled();
  });

  test('calls ServerError.handler and exits on network error during ping', async () => {
    const networkErr = Object.assign(new Error('Connection refused'), { name: 'RequestError' });
    mockGatewayInstance.ping.mockRejectedValue(networkErr);
    ServerError.isNetworkError.mockReturnValue(true);

    await expect(start(env, false, false)).rejects.toThrow('process.exit called');

    expect(ServerError.handler).toHaveBeenCalledWith(networkErr);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('re-throws non-network errors from ping', async () => {
    const genericErr = new Error('Something unexpected');
    mockGatewayInstance.ping.mockRejectedValue(genericErr);
    ServerError.isNetworkError.mockReturnValue(false);

    await expect(start(env, false, false)).rejects.toThrow('Something unexpected');
    expect(exitSpy).not.toHaveBeenCalled();
    expect(ServerError.handler).not.toHaveBeenCalled();
  });

  test('calls ServerError.handler and exits on network error during fetchDirectUploadData', async () => {
    const networkErr = Object.assign(new Error('ECONNREFUSED'), { name: 'RequestError' });
    mockGatewayInstance.getInstance.mockRejectedValue(networkErr);
    ServerError.isNetworkError.mockReturnValue(true);

    await expect(start(env, true, false)).rejects.toThrow('process.exit called');

    expect(ServerError.handler).toHaveBeenCalledWith(networkErr);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // Regression test for the EMFILE crash. chokidar v4+ dropped fsevents, so on
  // macOS each watched directory consumes a file descriptor; large projects hit
  // the OS limit and chokidar emits an 'error' event. Before the fix, start()
  // registered no 'error' listener, so Node threw on the unhandled event and
  // crashed pos-cli with a raw stack trace.
  test('registers an error handler so an EMFILE watcher error does not crash the process', async () => {
    const { watcher } = await start(env, false, false);

    const emfile = Object.assign(new Error('EMFILE: too many open files, watch'), {
      errno: -24,
      syscall: 'watch',
      code: 'EMFILE',
      filename: null
    });

    // On a real EventEmitter, emitting 'error' with no listener throws synchronously.
    // The fix wires .on('error', ...), so this must NOT throw and must report listeners.
    let hadListeners;
    expect(() => {
      hadListeners = watcher.emit('error', emfile);
    }).not.toThrow();
    expect(hadListeners).toBe(true);

    // Let the async handler run.
    await Promise.resolve();

    expect(logger.Error).toHaveBeenCalledWith(
      expect.stringContaining('OS file-watch limit was reached (EMFILE)'),
      { exit: false, notify: false }
    );
    // Must not exit the process — sync should stay alive.
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

// --- watchIgnored tests ---------------------------------------------------

describe('watchIgnored', () => {
  test('ignores .DS_Store files anywhere in the tree', () => {
    expect(watchIgnored('app/.DS_Store')).toBe(true);
    expect(watchIgnored('modules/foo/public/.DS_Store')).toBe(true);
  });

  test('ignores node_modules and .git directories (huge, never synced — main EMFILE driver)', () => {
    expect(watchIgnored('modules/foo/node_modules/dep/index.js')).toBe(true);
    expect(watchIgnored('app/.git/config')).toBe(true);
    expect(watchIgnored('node_modules')).toBe(true);
  });

  test('handles Windows-style backslash separators', () => {
    expect(watchIgnored('modules\\foo\\node_modules\\dep\\index.js')).toBe(true);
    expect(watchIgnored('app\\.DS_Store')).toBe(true);
  });

  test('does not ignore real source files', () => {
    expect(watchIgnored('app/views/pages/index.liquid')).toBe(false);
    expect(watchIgnored('modules/foo/public/views/partials/header.liquid')).toBe(false);
    // A file whose name merely contains "node_modules" is not in such a directory.
    expect(watchIgnored('app/views/node_modules_guide.liquid')).toBe(false);
  });
});

// --- handleWatcherError tests ---------------------------------------------

describe('handleWatcherError', () => {
  beforeEach(() => vi.clearAllMocks());

  test.each(['EMFILE', 'ENFILE', 'ENOSPC'])(
    'logs an actionable, non-exiting message for resource-exhaustion error %s',
    async code => {
      await handleWatcherError(Object.assign(new Error('boom'), { code }));

      expect(logger.Error).toHaveBeenCalledWith(
        expect.stringContaining(`OS file-watch limit was reached (${code})`),
        { exit: false, notify: false }
      );
    }
  );

  test('logs a generic non-exiting message for other watcher errors', async () => {
    await handleWatcherError(Object.assign(new Error('weird failure'), { code: 'EOTHER' }));

    expect(logger.Error).toHaveBeenCalledWith(
      '[Sync] File watcher error: weird failure',
      { exit: false, notify: false }
    );
  });
});
