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
vi.mock('chokidar', () => ({
  default: { watch: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis() }) }
}));
vi.mock('livereload', () => ({ default: { createServer: vi.fn() } }));
vi.mock('async', () => ({ default: { queue: vi.fn() } }));
vi.mock('#lib/proxy.js', () => ({ default: vi.fn() }));
vi.mock('#lib/files.js', () => ({ default: { getIgnoreList: vi.fn().mockReturnValue([]) } }));
vi.mock('#lib/directories.js', () => ({
  default: { APP: 'app', LEGACY_APP: 'marketplace_builder', toWatch: vi.fn().mockReturnValue([]) }
}));
vi.mock('#lib/watch-files-extensions.js', () => ({ default: ['liquid', 'yml'] }));
vi.mock('#lib/assets/manifest.js', () => ({ manifestGenerateForAssets: vi.fn() }));
vi.mock('#lib/s3UploadFile.js', () => ({ uploadFileFormData: vi.fn() }));
vi.mock('#lib/presignUrl.js', () => ({ presignDirectory: vi.fn() }));
vi.mock('#lib/shouldBeSynced.js', () => ({ default: vi.fn() }));
vi.mock('#lib/settings.js', () => ({ loadSettingsFileForModule: vi.fn().mockReturnValue({}) }));
vi.mock('#lib/templates.js', () => ({ fillInTemplateValues: vi.fn().mockReturnValue('') }));

// --- static imports (resolved after mocks) --------------------------------

import fs from 'fs';
import logger from '#lib/logger.js';
import ServerError from '#lib/ServerError.js';
import Gateway from '#lib/proxy.js';
import { pushFile, deleteFile, start } from '#lib/watch.js';

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
});
