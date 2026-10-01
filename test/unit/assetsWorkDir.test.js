/**
 * Where a deploy's assets are packed, and whose credentials sign the upload. Both used to be
 * fixed — `./tmp/assets.zip`, and whatever `MARKETPLACE_*` held when `presignUrl` ran — which is
 * safe only while one deploy runs at a time.
 */
import path from 'path';
import { describe, test, expect, vi, beforeEach } from 'vitest';

const packAssets = vi.fn().mockResolvedValue(1);
const presignUrl = vi.fn().mockResolvedValue({ uploadUrl: 'https://s3.example.com/put', accessUrl: 'https://cdn.example.com/a.zip' });
const presignDirectory = vi.fn().mockResolvedValue({});
const uploadFile = vi.fn().mockResolvedValue('ok');
const manifestGenerate = vi.fn().mockResolvedValue({ 'a.css': 'hash' });
const writeJSON = vi.fn();

vi.mock('#lib/assets/packAssets.js', () => ({ default: (...args) => packAssets(...args) }));
vi.mock('#lib/assets/manifest.js', () => ({ manifestGenerate: (...args) => manifestGenerate(...args) }));
vi.mock('#lib/s3UploadFile.js', () => ({ uploadFile: (...args) => uploadFile(...args) }));
vi.mock('#lib/files.js', () => ({ default: { writeJSON: (...args) => writeJSON(...args) } }));
vi.mock('#lib/presignUrl.js', () => ({
  presignUrl: (...args) => presignUrl(...args),
  presignDirectory: (...args) => presignDirectory(...args),
  isDirectUploadUnavailable: error => error?.statusCode === 501
}));
vi.mock('#lib/logger.js', () => ({
  default: { Debug: vi.fn(), Warn: vi.fn(), Info: vi.fn(), Error: vi.fn().mockResolvedValue(undefined) }
}));

const { deployAssets, canPresignAssetUpload } = await import('#lib/assets.js');

// Only what the asset path reads off it: the CDN wait is skipped by an accessUrl that 404s.
const gateway = {
  url: 'https://staging.example.com',
  token: 'staging-token',
  getInstance: async () => ({ id: 7 }),
  sendManifest: async () => ({ ok: true })
};

beforeEach(() => {
  vi.clearAllMocks();
  packAssets.mockResolvedValue(1);
  presignUrl.mockResolvedValue({ uploadUrl: 'https://s3.example.com/put', accessUrl: 'https://cdn.example.com/a.zip' });
  presignDirectory.mockResolvedValue({});
  manifestGenerate.mockResolvedValue({ 'a.css': 'hash' });
  // waitForUnpack polls until the uploaded zip is gone; "already gone" is one HEAD.
  vi.stubGlobal('fetch', async () => ({ ok: false }));
});

describe('the directory a deploy packs into', () => {
  test('is the one it was given, for both the zip and the manifest', async () => {
    const workDir = path.join('tmp', 'pos-cli-mcp-deploy', 'release-abc');

    await deployAssets(gateway, { releaseId: 1, workDir });

    expect(packAssets).toHaveBeenCalledWith(path.join(workDir, 'assets.zip'));
    expect(writeJSON).toHaveBeenCalledWith(path.join(workDir, 'assets_manifest.json'), { 'a.css': 'hash' });
  });

  // Every CLI deploy has put them here and there is only ever one of those at a time.
  test('is tmp when it was given none', async () => {
    await deployAssets(gateway, { releaseId: 1 });

    expect(packAssets).toHaveBeenCalledWith(path.join('tmp', 'assets.zip'));
    expect(writeJSON).toHaveBeenCalledWith(path.join('tmp', 'assets_manifest.json'), expect.anything());
  });

  test('two deploys given different directories do not pack over each other', async () => {
    await deployAssets(gateway, { releaseId: 1, workDir: path.join('tmp', 'one') });
    await deployAssets(gateway, { releaseId: 2, workDir: path.join('tmp', 'two') });

    const [first, second] = packAssets.mock.calls.map(([target]) => target);
    expect(first).not.toBe(second);
  });
});

describe('the credentials that sign the upload', () => {
  test('are the Gateway\'s, not whatever the environment holds', async () => {
    vi.stubEnv('MARKETPLACE_URL', 'https://somewhere-else.example.com');
    vi.stubEnv('MARKETPLACE_TOKEN', 'another-token');

    await deployAssets(gateway, { releaseId: 1 });

    expect(presignUrl.mock.calls[0][2]).toEqual({ url: gateway.url, token: gateway.token });
    vi.unstubAllEnvs();
  });

  test('are the Gateway\'s when asking whether a direct upload is possible at all', async () => {
    await canPresignAssetUpload(gateway);

    expect(presignDirectory).toHaveBeenCalledWith('instances/7/assets', { url: gateway.url, token: gateway.token });
  });

  // The one answer that means "this instance has no object storage"; everything else is a failure
  // the caller has to see.
  test('a 501 means the assets belong somewhere else, and anything else is raised', async () => {
    presignDirectory.mockRejectedValueOnce(Object.assign(new Error('no object storage'), { statusCode: 501 }));
    expect(await canPresignAssetUpload(gateway)).toBe(false);

    presignDirectory.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { statusCode: 403 }));
    await expect(canPresignAssetUpload(gateway)).rejects.toThrow('Forbidden');
  });
});
