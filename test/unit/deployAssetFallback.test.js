/**
 * An instance with no object storage configured has nothing to presign an upload to and
 * answers 501 `direct_upload_unavailable`, so deploy takes its assets inside the release
 * archive instead — the same thing `--old-assets-upload` does, which the release import
 * already stores body by body.
 *
 * Before this, the presign request got no answer at all — the connection was dropped — so
 * `deployAssets` logged "Deploy assets failed" and the deploy finished having silently
 * deployed no assets.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('#lib/logger.js', () => ({
  default: {
    Debug: vi.fn(),
    Warn: vi.fn(),
    Error: vi.fn().mockResolvedValue(undefined),
    Info: vi.fn(),
    Success: vi.fn()
  }
}));
vi.mock('#lib/logger/report.js', () => ({ default: vi.fn() }));
vi.mock('#lib/ora.js', () => ({
  default: () => ({ start: vi.fn(), stop: vi.fn(), text: '' })
}));
vi.mock('#lib/ServerError.js', () => ({
  default: { handler: vi.fn().mockResolvedValue(undefined), isNetworkError: vi.fn().mockReturnValue(false) }
}));
vi.mock('#lib/proxy.js', () => ({ default: vi.fn() }));
vi.mock('#lib/archive.js', () => ({ makeArchive: vi.fn() }));
vi.mock('#lib/push.js', () => ({ push: vi.fn(), printDeployReport: vi.fn() }));
vi.mock('#lib/files.js', () => ({ default: { getAssets: vi.fn(), writeJSON: vi.fn() } }));
vi.mock('#lib/deploy/waitForAssetReport.js', () => ({ default: vi.fn().mockResolvedValue(null) }));
vi.mock('#lib/deploy/defaultStrategy.js', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('#lib/presignUrl.js', async () => ({
  ...(await vi.importActual('#lib/presignUrl.js')),
  presignDirectory: vi.fn(),
  presignUrl: vi.fn()
}));
// canPresignAssetUpload stays real — it is what reads the instance's answer — while the
// upload it guards is stubbed out.
vi.mock('#lib/assets.js', async () => ({
  ...(await vi.importActual('#lib/assets.js')),
  deployAssets: vi.fn().mockResolvedValue({})
}));

import logger from '#lib/logger.js';
import Gateway from '#lib/proxy.js';
import files from '#lib/files.js';
import { makeArchive } from '#lib/archive.js';
import { push } from '#lib/push.js';
import { presignDirectory } from '#lib/presignUrl.js';
import { deployAssets } from '#lib/assets.js';
import defaultStrategy from '#lib/deploy/defaultStrategy.js';
import directAssetsUploadStrategy from '#lib/deploy/directAssetsUploadStrategy.js';

const statusError = status =>
  Object.assign(new Error(`presignDirectory failed with status ${status}`), { statusCode: status });

describe('deploying to an instance that cannot presign an asset upload', () => {
  const env = { MARKETPLACE_URL: 'https://test.example.com', VERBOSE: false };
  const authData = { email: 'test@example.com', token: 'test-token', url: env.MARKETPLACE_URL };
  const params = { partialDeploy: false };
  const warning =
    'This instance has no object storage configured, so assets cannot be uploaded directly — deploying them inside the release archive instead.';

  let gateway;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = { getInstance: vi.fn().mockResolvedValue({ id: 1 }) };
    vi.mocked(Gateway).mockImplementation(function() { return gateway; });
    files.getAssets.mockResolvedValue(['app/assets/style/main.css']);
    makeArchive.mockResolvedValue(3);
    push.mockResolvedValue({ releaseId: 1, gateway, report: {} });
  });

  test('hands the deploy to the strategy that archives the assets', async () => {
    presignDirectory.mockRejectedValue(statusError(501));

    await directAssetsUploadStrategy({ env, authData, params });

    expect(defaultStrategy).toHaveBeenCalledWith({ env, authData, params });
    expect(logger.Warn).toHaveBeenCalledWith(warning);
    // The decision is made before anything is built or sent, so this strategy neither
    // archives without the assets nor uploads them anywhere.
    expect(makeArchive).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(deployAssets).not.toHaveBeenCalled();
  });

  test('presigns against the deploying instance own asset directory', async () => {
    presignDirectory.mockRejectedValue(statusError(501));

    await directAssetsUploadStrategy({ env, authData, params });

    expect(presignDirectory).toHaveBeenCalledWith('instances/1/assets');
  });

  test('uploads directly, as before, when the instance can presign', async () => {
    presignDirectory.mockResolvedValue({ url: 'https://s3.example.com/bucket', fields: {} });

    await directAssetsUploadStrategy({ env, authData, params });

    expect(defaultStrategy).not.toHaveBeenCalled();
    expect(makeArchive).toHaveBeenCalledWith(env, { withoutAssets: true });
    expect(deployAssets).toHaveBeenCalledTimes(1);
    expect(logger.Warn).not.toHaveBeenCalledWith(warning);
  });

  test('does not ask at all when the deploy carries no assets', async () => {
    files.getAssets.mockResolvedValue([]);

    await directAssetsUploadStrategy({ env, authData, params });

    expect(presignDirectory).not.toHaveBeenCalled();
    expect(defaultStrategy).not.toHaveBeenCalled();
    expect(makeArchive).toHaveBeenCalledWith(env, { withoutAssets: true });
  });

  // Only the 501 means "the assets belong somewhere else". A refused or expired
  // authorization is a failure to report, and quietly re-routing the assets would hide it.
  test('fails the deploy on a presign error that is not the 501', async () => {
    presignDirectory.mockRejectedValue(statusError(403));

    await directAssetsUploadStrategy({ env, authData, params });

    expect(defaultStrategy).not.toHaveBeenCalled();
    expect(makeArchive).not.toHaveBeenCalled();
    expect(logger.Error).toHaveBeenCalledWith(
      'Deploy failed. Error: presignDirectory failed with status 403'
    );
  });
});
