const request = require('request-promise'),
  ora = require('ora');

const packAssets = require('./assets/packAssets'),
  manifestGenerate = require('./assets/manifest').manifestGenerate,
  logger = require('./logger'),
  uploadFile = require('./s3UploadFile').uploadFile,
  presignUrl = require('./presignUrl').presignUrl;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const waitForUnpack = async fileUrl => {
  logger.Warn('Waiting for assets to be propagated to CDN');

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
    logger.Warn('Assets uploaded to S3.');
    await waitForUnpack(data.accessUrl);
    ora({ text: 'Generating and uploading new assets manifest...', stream: process.stdout, spinner: 'bouncingBar' }).start();
    const manifest = await manifestGenerate();
    logger.Debug(manifest);
    await gateway.sendManifest(manifest);
    logger.Success('Deploy finished.');
  } catch (e) {
    logger.Debug(e.message);
    logger.Debug(e.stack);
    logger.Error('Deploy assets failed.');
  }
};

module.exports = {
  deployAssets: deployAssets
};
