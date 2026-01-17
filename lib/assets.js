import packAssets from './assets/packAssets.js';
import { manifestGenerate } from './assets/manifest.js';
import logger from './logger.js';
import { uploadFile } from './s3UploadFile.js';
import { presignUrl } from './presignUrl.js';
import files from './files.js';

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
      logger.Error(error);
    }
  } while (fileExists && counter < 90);
};

const deployAssets = async gateway => {
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
    logger.Debug(assetsArchiveName)
    await uploadFile(assetsArchiveName, data.uploadUrl);
    logger.Debug('Assets uploaded to S3.');
    await waitForUnpack(data.accessUrl);
    const manifest = await manifestGenerate();
    logger.Debug(manifest);
    files.writeJSON('tmp/assets_manifest.json', manifest);
    await gateway.sendManifest(manifest);
    logger.Debug('Uploading assets');
  } catch (e) {
    logger.Debug(e);
    logger.Debug(e.message);
    logger.Debug(e.stack);
    logger.Error('Deploy assets failed.');
  }
};

export { deployAssets };
