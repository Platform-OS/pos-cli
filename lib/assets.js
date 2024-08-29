const request = require('request-promise');
const packAssets = require('./assets/packAssets'),
  manifestGenerate = require('./assets/manifest').manifestGenerate,
  logger = require('./logger'),
  uploadFile = require('./s3UploadFile').uploadFile,
  presignUrl = require('./presignUrl').presignUrl;
  const files = require('./files');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const waitForUnpack = async fileUrl => {
  logger.Debug('Waiting for assets to be propagated to CDN');

  let fileExists = false;
  let counter = 0;
  do {
    logger.Debug(`Waiting for: ${fileUrl} to be deleted.`);
    counter += 1;
    if (fileExists) await sleep(1000);
    fileExists = await request
      .head(fileUrl)
      .then(() => true)
      .catch({ statusCode: 403 }, () => false)
      .catch({ statusCode: 404 }, () => false)
      .catch(error => logger.Error(error));
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

module.exports = {
  deployAssets: deployAssets
};
