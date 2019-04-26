const request = require('request-promise'),
  generateManifest = require('./assets/generateManifest'),
  logger = require('./logger'),
  packAssets = require('./assets/packAssets'),
  uploadFile = require('./s3UploadFile'),
  presignUrl = require('./presignUrl');

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const waitForUnpack = async fileUrl => {
  let fileExists = false;
  let counter = 0;
  do {
    logger.Debug(`waiting for: ${fileUrl}`);
    counter += 1;
    if (fileExists) await sleep(1000);
    fileExists = await request
      .head(fileUrl)
      .then(() => true)
      .catch({ statusCode: 403 }, () => false)
      .catch(error => logger.Error(error));
  } while (fileExists && counter < 60);
};

const deployAssets = async gateway => {
  const assetsArchiveName = './tmp/assets.zip';
  const instance = await gateway.getInstance();
  const now = Math.floor(new Date() / 1000);
  const remoteAssetsArchiveName = `instances/${instance.id}/assets/${now}.assets_deploy.zip`;
  logger.Debug(remoteAssetsArchiveName);
  try {
    packAssets(assetsArchiveName);
    const data = await presignUrl(remoteAssetsArchiveName, assetsArchiveName);
    logger.Debug(data);
    await uploadFile(assetsArchiveName, data.uploadUrl);
    logger.Debug('UPLOADED');
    await waitForUnpack(data.accessUrl);
    const manifest = generateManifest();
    logger.Debug(manifest);
    await gateway.sendManifest(manifest);
  } catch (e) {
    logger.Debug(e.message);
    logger.Error('Deploy assets failed');
  }
};

module.exports = {
  deployAssets: deployAssets
};
