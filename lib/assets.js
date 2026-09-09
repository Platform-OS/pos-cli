import packAssets from './assets/packAssets.js';
import { manifestGenerate } from './assets/manifest.js';
import logger from './logger.js';
import { uploadFile } from './s3UploadFile.js';
import { presignUrl, presignDirectory, isDirectUploadUnavailable } from './presignUrl.js';
import files from './files.js';
import ServerError from './ServerError.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const waitForUnpack = async fileUrl => {
  logger.Debug('Waiting for assets to be propagated to CDN');

  let fileExists = false;
  let counter = 0;
  do {
    logger.Debug(`Waiting for: ${fileUrl} to be deleted.`);
    counter += 1;
    if (fileExists) await sleep(1000);
    try {
      const response = await fetch(fileUrl, { method: 'HEAD' });
      fileExists = response.ok;
    } catch (error) {
      fileExists = false;
      await logger.Error(error);
    }
  } while (fileExists && counter < 90);
};

// Whether this instance can take a direct asset upload at all. An instance with no object
// storage configured cannot presign one (isDirectUploadUnavailable); its assets have to
// travel inside the release archive instead, which is what the default strategy already
// does for `--old-assets-upload`. Everything else is left for the caller to report.
//
// The policy this signs is discarded — presigning creates nothing, it only signs.
const canPresignAssetUpload = async gateway => {
  const instance = await gateway.getInstance();
  try {
    await presignDirectory(`instances/${instance.id}/assets`);
    return true;
  } catch (e) {
    if (!isDirectUploadUnavailable(e)) throw e;
    return false;
  }
};

const deployAssets = async (gateway, { releaseId } = {}) => {
  logger.Debug('Generating and uploading new assets manifest...');
  const assetsArchiveName = './tmp/assets.zip';
  const instance = await gateway.getInstance();
  const now = Math.floor(new Date());
  const remoteAssetsArchiveName = `instances/${instance.id}/assets/${now}.assets_deploy.zip`;
  logger.Debug(remoteAssetsArchiveName);
  try {
    await packAssets(assetsArchiveName);
    const data = await presignUrl(remoteAssetsArchiveName, assetsArchiveName);
    logger.Debug(data);
    logger.Debug(assetsArchiveName);
    await uploadFile(assetsArchiveName, data.uploadUrl);
    logger.Debug('Assets uploaded to S3.');
    await waitForUnpack(data.accessUrl);
    const manifest = await manifestGenerate();
    logger.Debug(manifest);
    files.writeJSON('tmp/assets_manifest.json', manifest);
    const response = await gateway.sendManifest(manifest, releaseId);
    logger.Debug('Uploading assets');
    return response;
  } catch (e) {
    logger.Debug(e);
    logger.Debug(e.message);
    logger.Debug(e.stack);
    if (ServerError.isNetworkError(e)) {
      await logger.Error('Deploy assets failed.');
      await ServerError.handler(e);
    } else {
      await logger.Error(`Deploy assets failed: ${e.message || e}`);
    }
  }
};

export { deployAssets, canPresignAssetUpload };
