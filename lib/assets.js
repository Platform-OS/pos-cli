const request = require('request-promise'),
  ora = require('ora');

const packAssets = require('./assets/packAssets'),
  generateManifest = require('./assets/generateManifest'),
  logger = require('./logger'),
  uploadFile = require('./s3UploadFile'),
  presignUrl = require('./presignUrl');

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const waitForUnpack = async fileUrl => {
  ora({ text: 'Unpacking assets to CDN...', stream: process.stdout, spinner: 'bouncingBar' }).start();

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
      .catch(error => logger.Error(error));
  } while (fileExists && counter < 90);
};

const deployAssets = async gateway => {
  const assetsArchiveName = './tmp/assets.zip';
  const instance = await gateway.getInstance();
  const now = Math.floor(new Date() / 1000);
  const remoteAssetsArchiveName = `instances/${instance.id}/assets/${now}.assets_deploy.zip`;
  logger.Debug(remoteAssetsArchiveName);
  try {
    await packAssets(assetsArchiveName);
    const data = await presignUrl(remoteAssetsArchiveName, assetsArchiveName);
    logger.Debug(data);
    await uploadFile(assetsArchiveName, data.uploadUrl);
    logger.Debug('Assets uploaded to S3.');
    await waitForUnpack(data.accessUrl);
    const manifest = generateManifest();
    ora({ text: 'Generating and uploading new manifest...', stream: process.stdout, spinner: 'bouncingBar' }).start();
    logger.Debug(manifest);
    await gateway.sendManifest(manifest);
    logger.Success('Deploy finished.');
  } catch (e) {
    logger.Debug(e.message);
    logger.Error('Deploy assets failed.');
  }
};

module.exports = {
  deployAssets: deployAssets
};
